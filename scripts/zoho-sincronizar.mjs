// Trae de Zoho Books la cartera de los vendedores de calle y su facturación.
//
//   node scripts/zoho-sincronizar.mjs           ver qué haría, sin escribir
//   node scripts/zoho-sincronizar.mjs --aplicar escribir de verdad
//
// La regla de pertenencia y el porqué de cada decisión están en
// docs/05-modulos/7.6-clientes-y-facturacion.md.
//
// **Books manda.** El espejo `clientes_zoho` se rehace entero; lo que el
// vendedor escribe vive en `cuentas` y no se toca — salvo el enlace.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const APLICAR = process.argv.includes("--aplicar");
const MESES = 12;

// ---------------------------------------------------------------------------

function entorno() {
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const vars = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }

  const faltan = [
    "ZOHO_ORG_ID",
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_REFRESH_TOKEN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !vars[k]);

  if (faltan.length) {
    console.error(`\n  Faltan en .env.local: ${faltan.join(", ")}\n`);
    if (faltan.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      console.error(
        "  La clave de servicio está en el panel de Supabase, en\n" +
          "  Project Settings → API → service_role. Es la única que puede\n" +
          "  escribir sin sesión de usuario, que es lo que hace esta pasada.\n",
      );
    }
    process.exit(1);
  }

  return { ...vars, ZOHO_DOMINIO: vars.ZOHO_DOMINIO || "zoho.com" };
}

const env = entorno();

// --- Zoho ------------------------------------------------------------------

async function zohoToken() {
  const r = await fetch(`https://accounts.${env.ZOHO_DOMINIO}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      refresh_token: env.ZOHO_REFRESH_TOKEN,
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!d.access_token) {
    console.error("\n  Zoho no dio token:", JSON.stringify(d), "\n");
    process.exit(1);
  }
  return d.access_token;
}

const token = await zohoToken();

/** Zoho pagina de 200 en 200 y `total` no siempre viene: hay que recorrer. */
async function zohoTodo(ruta, params = {}, cota = 60) {
  const filas = [];
  let pagina = 1;
  let hay = true;

  while (hay && pagina <= cota) {
    const u = new URL(`https://www.zohoapis.com/books/v3${ruta}`);
    u.searchParams.set("organization_id", env.ZOHO_ORG_ID);
    u.searchParams.set("per_page", "200");
    u.searchParams.set("page", String(pagina));
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

    const r = await fetch(u, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const d = await r.json();
    if (d.code && d.code !== 0) {
      console.error(`\n  Zoho respondió ${d.code}: ${d.message}\n`);
      process.exit(1);
    }

    filas.push(...(d[ruta.slice(1)] ?? []));
    hay = d.page_context?.has_more_page ?? false;
    pagina += 1;
  }
  return filas;
}

// --- Supabase --------------------------------------------------------------

async function sb(ruta, opciones = {}) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, {
    ...opciones,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opciones.prefer ?? "return=representation",
      ...(opciones.headers ?? {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) {
    console.error(`\n  Supabase ${r.status} en ${ruta}:\n  ${texto}\n`);
    process.exit(1);
  }
  return texto ? JSON.parse(texto) : null;
}

// ---------------------------------------------------------------------------
// 1. Quién es quién
// ---------------------------------------------------------------------------

const equivalencias = await sb(
  "/vendedores_zoho?select=nombre_zoho,perfil_id&deleted_at=is.null",
);

if (equivalencias.length === 0) {
  console.error(
    "\n  `vendedores_zoho` está vacía: sin ella no se sabe de quién es\n" +
      "  cada factura. Ver docs/05-modulos/7.6-clientes-y-facturacion.md.\n",
  );
  process.exit(1);
}

const perfilDe = new Map(
  equivalencias.map((e) => [e.nombre_zoho.trim(), e.perfil_id]),
);

console.log(`\n  ${perfilDe.size} vendedores de calle reconocidos.\n`);

// ---------------------------------------------------------------------------
// 2. La facturación del año
// ---------------------------------------------------------------------------

const desde = new Date();
desde.setMonth(desde.getMonth() - MESES);
const fechaDesde = desde.toISOString().slice(0, 10);

const facturas = await zohoTodo("/invoices", { date_start: fechaDesde });
console.log(`  ${facturas.length} facturas desde ${fechaDesde}.`);

const porCliente = new Map();
for (const f of facturas) {
  if (!porCliente.has(f.customer_id)) {
    porCliente.set(f.customer_id, {
      vendedores: new Set(),
      fechas: [],
      total: 0,
    });
  }
  const x = porCliente.get(f.customer_id);
  x.vendedores.add((f.salesperson_name ?? "").trim());
  x.fechas.push(f.date);
  x.total += Number(f.total ?? 0);
}

// ---------------------------------------------------------------------------
// 3. La regla de pertenencia
//
// Un solo vendedor en todas sus facturas, y que ese vendedor sea de calle.
// Lo demás es de la casa: lo atiende Verónica desde el CRM y no entra aquí.
// ---------------------------------------------------------------------------

const deCalle = new Map();
let deLaCasa = 0;
let mezclados = 0;

for (const [id, x] of porCliente) {
  if (x.vendedores.size > 1) {
    mezclados += 1;
    continue;
  }
  const nombre = [...x.vendedores][0];
  const perfil = perfilDe.get(nombre);
  if (!perfil) {
    deLaCasa += 1;
    continue;
  }
  deCalle.set(id, { ...x, nombre, perfil });
}

console.log(
  `  ${deCalle.size} clientes de calle · ${deLaCasa} de la casa · ${mezclados} con más de un vendedor\n`,
);

// ---------------------------------------------------------------------------
// 4. El ritmo de compra
//
// Mediana de los días entre facturas, y solo con tres o más: dos compras dan
// un intervalo, y un intervalo no es un ritmo.
// ---------------------------------------------------------------------------

function cadencia(fechas) {
  if (fechas.length < 3) return null;

  const dias = [...new Set(fechas)]
    .sort()
    .map((f) => Date.parse(`${f}T12:00:00Z`));
  if (dias.length < 3) return null;

  const huecos = [];
  for (let i = 1; i < dias.length; i++) {
    huecos.push(Math.round((dias[i] - dias[i - 1]) / 86_400_000));
  }
  huecos.sort((a, b) => a - b);

  const medio = Math.floor(huecos.length / 2);
  const mediana =
    huecos.length % 2
      ? huecos[medio]
      : Math.round((huecos[medio - 1] + huecos[medio]) / 2);

  return mediana >= 1 && mediana <= 365 ? mediana : null;
}

// ---------------------------------------------------------------------------
// 5. El RUC, que es la llave
// ---------------------------------------------------------------------------

const contactos = await zohoTodo("/contacts", { contact_type: "customer" });
const fichaDe = new Map(contactos.map((c) => [c.contact_id, c]));

// El campo personalizado del RUC: se descubre en vez de quemarlo, por si algún
// día lo recrean con otro identificador.
const claveRuc = contactos
  .flatMap(Object.keys)
  .find((k) => /^cf_[0-9]+$/.test(k));

/** Igual que `public.normalizar_ruc`: sin sufijo DV, sin guiones ni espacios. */
function rucComparable(bruto) {
  const s = String(bruto ?? "")
    .replace(/\s*DV\s*[0-9]+\s*$/i, "")
    .replace(/[^0-9A-Za-z]/g, "");
  return s || null;
}

// ---------------------------------------------------------------------------
// 6. Armar el espejo
// ---------------------------------------------------------------------------

const espejo = [];
let sinFicha = 0;
let sinRuc = 0;

for (const [id, x] of deCalle) {
  const ficha = fichaDe.get(id);
  if (!ficha) {
    sinFicha += 1;
    continue;
  }

  const ruc = claveRuc ? (ficha[claveRuc] ?? null) : null;
  if (!rucComparable(ruc)) sinRuc += 1;

  const fechas = [...x.fechas].sort();

  espejo.push({
    id: randomUUID(),
    contacto_id: id,
    nombre: (ficha.contact_name ?? ficha.company_name ?? "Sin nombre").trim(),
    ruc: ruc ? String(ruc).trim() : null,
    vendedor_zoho: x.nombre,
    perfil_id: x.perfil,
    facturas_12m: x.fechas.length,
    total_12m: Math.round(x.total * 100) / 100,
    primera_compra: fechas[0],
    ultima_compra: fechas[fechas.length - 1],
    cadencia_observada: cadencia(x.fechas),
  });
}

const conCadencia = espejo.filter((e) => e.cadencia_observada !== null).length;

console.log(`  ESPEJO`);
console.log(`  ${espejo.length} clientes`);
console.log(`  ${espejo.length - sinRuc} con RUC · ${sinRuc} sin RUC`);
console.log(`  ${conCadencia} con ritmo de compra deducible\n`);
if (sinFicha) console.log(`  (${sinFicha} facturaron pero ya no están en el maestro)\n`);

const porVendedor = new Map();
for (const e of espejo) {
  porVendedor.set(e.vendedor_zoho, (porVendedor.get(e.vendedor_zoho) ?? 0) + 1);
}
for (const [v, n] of [...porVendedor].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${v}`);
}

// ---------------------------------------------------------------------------
// 7. Cruzar con las cuentas del SGV
// ---------------------------------------------------------------------------

const cuentas = await sb(
  "/cuentas?select=id,nombre,ruc,zoho_contacto_id&deleted_at=is.null",
);

const porContacto = new Map();
const porRuc = new Map();
for (const c of cuentas) {
  if (c.zoho_contacto_id) porContacto.set(c.zoho_contacto_id, c.id);
  const r = rucComparable(c.ruc);
  if (r && !porRuc.has(r)) porRuc.set(r, c.id);
}

let enlazadas = 0;
let porCrear = 0;

for (const e of espejo) {
  // El enlace explícito manda sobre el RUC: sobrevive a que alguien lo corrija.
  const ya = porContacto.get(e.contacto_id);
  if (ya) {
    e.cuenta_id = ya;
    enlazadas += 1;
    continue;
  }

  const r = rucComparable(e.ruc);
  const porLlave = r ? porRuc.get(r) : null;
  if (porLlave) {
    e.cuenta_id = porLlave;
    e.enlazar = porLlave;
    enlazadas += 1;
    continue;
  }

  e.crear = true;
  porCrear += 1;
}

console.log(`\n  CRUCE CON EL SGV`);
console.log(`  ${enlazadas} enganchan con cuentas que ya existen`);
console.log(`  ${porCrear} son clientes que el SGV no conocía\n`);

if (!APLICAR) {
  console.log("  Nada se escribió. Para hacerlo:\n");
  console.log("    node scripts/zoho-sincronizar.mjs --aplicar\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 8. Escribir
// ---------------------------------------------------------------------------

// Las cuentas nuevas primero, para que el espejo pueda apuntarlas.
const nuevas = espejo
  .filter((e) => e.crear)
  .map((e) => {
    const id = randomUUID();
    e.cuenta_id = id;
    return {
      id,
      nombre: e.nombre,
      ruc: e.ruc,
      tipo: "cliente",
      origen: "facturacion",
      vendedor_id: e.perfil_id,
      zoho_contacto_id: e.contacto_id,
      // Sin cadencia: la observada se propone desde el espejo y la decide el
      // vendedor. Escribirla aquí sería sustituir su criterio por el promedio.
    };
  });

for (let i = 0; i < nuevas.length; i += 200) {
  await sb("/cuentas", {
    method: "POST",
    body: JSON.stringify(nuevas.slice(i, i + 200)),
    prefer: "return=minimal",
  });
}
console.log(`  ${nuevas.length} cuentas creadas.`);

// El enlace explícito en las que ya existían.
let marcadas = 0;
for (const e of espejo) {
  if (!e.enlazar) continue;
  await sb(`/cuentas?id=eq.${e.enlazar}`, {
    method: "PATCH",
    body: JSON.stringify({ zoho_contacto_id: e.contacto_id }),
    prefer: "return=minimal",
  });
  marcadas += 1;
}
console.log(`  ${marcadas} cuentas existentes enlazadas.`);

// Y el espejo, entero. Books manda: se reemplaza, no se parchea.
const filas = espejo.map((e) => ({
  id: e.id,
  contacto_id: e.contacto_id,
  nombre: e.nombre,
  ruc: e.ruc,
  vendedor_zoho: e.vendedor_zoho,
  perfil_id: e.perfil_id,
  facturas_12m: e.facturas_12m,
  total_12m: e.total_12m,
  primera_compra: e.primera_compra,
  ultima_compra: e.ultima_compra,
  cadencia_observada: e.cadencia_observada,
  cuenta_id: e.cuenta_id ?? null,
  sincronizado_en: new Date().toISOString(),
}));

for (let i = 0; i < filas.length; i += 200) {
  await sb("/clientes_zoho?on_conflict=contacto_id", {
    method: "POST",
    body: JSON.stringify(filas.slice(i, i + 200)),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

console.log(`  ${filas.length} filas de espejo escritas.\n`);
console.log("  Listo.\n");
