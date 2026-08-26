// Trae el detalle de cada compra: qué se vendió, cuánto y a qué precio.
//
//   node scripts/zoho-historial.mjs            ver qué haría, sin escribir
//   node scripts/zoho-historial.mjs --aplicar  escribir de verdad
//
// **Zoho no manda los renglones en el listado.** Hay que abrir documento por
// documento, y son unos 2 100 en doce meses. La primera pasada tarda su rato;
// las siguientes piden solo lo modificado desde la anterior —diez o veinte
// consultas— porque la marca de agua queda en `sincronizaciones`.
//
// Corre después de `zoho-sincronizar.mjs`, que es el que crea las cuentas.
// Ver docs/05-modulos/7.6-clientes-y-facturacion.md.

import { randomUUID } from "node:crypto";
import { entorno, DE_ZOHO } from "./entorno.mjs";

const APLICAR = process.argv.includes("--aplicar");
const MESES = 12;

/** Por debajo de esto la pasada se detiene y sigue mañana. */
const CUOTA_MINIMA = 400;

/** Cuántos documentos se abren a la vez. Zoho tolera bien este ritmo. */
const EN_PARALELO = 6;

// ---------------------------------------------------------------------------

const env = entorno(DE_ZOHO);

// --- Zoho ------------------------------------------------------------------

const r0 = await fetch(`https://accounts.${env.ZOHO_DOMINIO ?? "zoho.com"}/oauth/v2/token`, {
  method: "POST",
  body: new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  }),
});
const d0 = await r0.json();
if (!d0.access_token) {
  console.error("\n  Zoho no dio token:", JSON.stringify(d0), "\n");
  process.exit(1);
}
const token = d0.access_token;

/** Cuánta cuota queda. La informa Zoho en cada respuesta. */
let cuota = Infinity;

async function zoho(ruta, params = {}) {
  const u = new URL(`https://www.zohoapis.com/books/v3${ruta}`);
  u.searchParams.set("organization_id", env.ZOHO_ORG_ID);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

  // Con DEPURAR=1 imprime la dirección exacta. Es lo que destapó que la marca
  // de agua iba en un formato que Zoho rechaza: el mensaje de error nombraba el
  // parámetro pero no decía con qué valor le estaba llegando.
  if (process.env.DEPURAR) {
    console.error(
      "    -> " + u.toString().replace(/organization_id=\d+/, "organization_id=***"),
    );
  }
  const r = await fetch(u, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  const queda = r.headers.get("x-rate-limit-remaining");
  if (queda !== null) cuota = Number(queda);

  const d = await r.json();
  if (d.code && d.code !== 0) {
    console.error(`\n  Zoho respondió ${d.code}: ${d.message} (en ${ruta})\n`);
    process.exit(1);
  }
  return d;
}

async function zohoTodo(ruta, params = {}, cota = 60) {
  const filas = [];
  let pagina = 1;
  let hay = true;
  while (hay && pagina <= cota) {
    const d = await zoho(ruta, { ...params, per_page: "200", page: String(pagina) });
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
// 1. De quién es cada cuenta, y desde cuándo hay que traer
// ---------------------------------------------------------------------------

const clientes = await sb(
  "/clientes_zoho?select=contacto_id,cuenta_id,perfil_id&deleted_at=is.null",
);

if (clientes.length === 0) {
  console.error(
    "\n  No hay clientes en el espejo. Corre antes zoho-sincronizar.mjs.\n",
  );
  process.exit(1);
}

const cuentaDe = new Map(clientes.map((c) => [c.contacto_id, c]));
console.log(`\n  ${cuentaDe.size} clientes de calle en el espejo.`);

// **El canal se decide por documento, no por cliente.** La regla de pertenencia
// de `clientes_zoho` es de cliente —si tiene más de un vendedor, no es de
// nadie— y sirve para decidir de quién es la cartera. Para medir venta es
// equivocada: si en la factura dice Javier, la vendió Javier.
const deCalle = new Set(
  (await sb("/vendedores_zoho?select=nombre_zoho&deleted_at=is.null")).map(
    (v) => v.nombre_zoho,
  ),
);

const marcas = await sb("/sincronizaciones?fuente=eq.historial&select=hasta");
const desdeGuardado = marcas[0]?.hasta ?? null;

const doceMeses = new Date();
doceMeses.setMonth(doceMeses.getMonth() - MESES);
const fechaDesde = doceMeses.toISOString().slice(0, 10);

/**
 * La marca de agua, en el formato que Zoho acepta.
 *
 * **Books quiere `yyyy-MM-ddTHH:mm:ss±HHmm` y nada más**: sin milésimas y
 * con el desfase pegado, sin los dos puntos. Postgres devuelve
 * `2026-08-25T14:23:29.127+00:00`, que trae las dos cosas que sobran, y
 * Zoho contesta «Invalid value passed for last_modified_time».
 *
 * Por eso la pasada incremental nunca llegó a correr: la primera funcionó
 * —no había marca todavía, así que filtró por fecha— y todas las siguientes
 * murieron en la primera consulta. Se comprobaron los seis formatos contra
 * la API; solo pasan los dos que cumplen esa forma exacta.
 */
function paraZoho(iso) {
  return new Date(iso).toISOString().replace(/\.\d+Z$/, "+0000");
}

// El filtro por modificación es lo que hace barata la pasada de todas las
// noches: sin él habría que volver a abrir los 2 100 documentos cada vez.
const filtro = desdeGuardado
  ? { last_modified_time: paraZoho(desdeGuardado) }
  : { date_start: fechaDesde };

console.log(
  desdeGuardado
    ? `  Trayendo lo modificado desde ${desdeGuardado.slice(0, 16).replace("T", " ")}.\n`
    : `  Primera pasada: doce meses desde ${fechaDesde}.\n`,
);

// El momento se toma **antes** de pedir nada. Si se tomara al final, lo que
// cambie mientras corre la pasada quedaría fuera para siempre.
const momento = new Date().toISOString();

// ---------------------------------------------------------------------------
// 2. Qué documentos hay que abrir
// ---------------------------------------------------------------------------

// **Todo lo que facturó la empresa, no solo lo de calle.** El espejo veía
// el 28 % de la venta ($545 881 de $1 929 369) y con eso no se puede
// contestar la primera pregunta de §7.6: cuánto vende la casa y cuánto
// genera cada vendedor.
const facturas = await zohoTodo("/invoices", filtro);
const entregas = (await zohoTodo("/salesorders", filtro)).filter(
  (o) => o.status === "void" && o.invoiced_status !== "invoiced",
);

const pendientes = [
  ...facturas.map((f) => ({
    tipo: "factura",
    ruta: `/invoices/${f.invoice_id}`,
    clave: "invoice",
    id: f.invoice_id,
    numero: f.invoice_number,
    contacto: f.customer_id,
    contactoNombre: f.customer_name ?? null,
    vendedorZoho: f.salesperson_name || null,
    fecha: f.date,
    total: Number(f.total ?? 0),
    saldo: Number(f.balance ?? 0),
    estado: f.status,
  })),
  ...entregas.map((o) => ({
    tipo: "entrega",
    ruta: `/salesorders/${o.salesorder_id}`,
    clave: "salesorder",
    id: o.salesorder_id,
    numero: o.salesorder_number,
    contacto: o.customer_id,
    contactoNombre: o.customer_name ?? null,
    vendedorZoho: o.salesperson_name || null,
    fecha: o.date,
    total: Number(o.total ?? 0),
    saldo: 0,
    estado: o.status,
  })),
];

// **Solo se abren las de los clientes de calle.** El renglón —qué producto se
// vendió— alimenta el expediente y la venta cruzada, y eso es de la cartera del
// vendedor. De la venta de la casa alcanza con la cabecera, que ya viene en el
// listado y no cuesta una consulta más.
//
// Sin esta distinción la pasada pasaría de 1 500 documentos abiertos a 4 200, y
// de trece minutos a treinta y cinco, para traer renglones que nadie mira.
const paraAbrir = pendientes.filter((p) => cuentaDe.has(p.contacto));
const soloCabecera = pendientes.filter((p) => !cuentaDe.has(p.contacto));

console.log(
  `  ${pendientes.length} documentos: ${paraAbrir.length} de calle para abrir,` +
    ` ${soloCabecera.length} de la casa solo de cabecera.`,
);
console.log(`  Cuota disponible en Zoho: ${cuota}\n`);

if (pendientes.length === 0) {
  console.log("  Nada nuevo. Listo.\n");
  process.exit(0);
}

if (!APLICAR) {
  const minutos = Math.round((paraAbrir.length * 0.49) / 60);
  console.log(`  Abrirlas tardaría unos ${minutos || 1} minutos.`);
  console.log("\n  Nada se escribió. Para hacerlo:\n");
  console.log("    node scripts/zoho-historial.mjs --aplicar\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 3. Abrirlas
// ---------------------------------------------------------------------------

const transacciones = [];
const renglones = [];
let abiertas = 0;
let cortado = false;

/** La fila de `transacciones_zoho`, con o sin renglones. */
function cabecera(p, idTx) {
  const dueno = cuentaDe.get(p.contacto);
  return {
    id: idTx,
    documento_id: p.id,
    tipo: p.tipo,
    numero: p.numero ?? null,
    contacto_id: p.contacto,
    contacto_nombre: p.contactoNombre,
    cuenta_id: dueno?.cuenta_id ?? null,
    // Sigue siendo de quién es el **cliente**, no quién firmó el documento.
    // La comisión se calcula con esto y no se mueve.
    perfil_id: dueno?.perfil_id ?? null,
    vendedor_zoho: p.vendedorZoho,
    canal: p.vendedorZoho && deCalle.has(p.vendedorZoho) ? "calle" : "casa",
    fecha: p.fecha,
    total: p.total,
    saldo: p.saldo,
    estado: p.estado ?? null,
    sincronizado_en: momento,
  };
}

// La venta de la casa entra sin abrir nada: su cabecera ya vino en el listado.
for (const p of soloCabecera) {
  transacciones.push(cabecera(p, randomUUID()));
}

for (let i = 0; i < paraAbrir.length; i += EN_PARALELO) {
  if (cuota < CUOTA_MINIMA) {
    cortado = true;
    console.log(
      `\n  Cuota baja (${cuota}). Se detiene aquí y sigue en la próxima pasada.`,
    );
    break;
  }

  const lote = paraAbrir.slice(i, i + EN_PARALELO);
  const detalles = await Promise.all(
    lote.map(async (p) => ({ p, d: await zoho(p.ruta) })),
  );

  for (const { p, d } of detalles) {
    const doc = d[p.clave] ?? {};
    const dueno = cuentaDe.get(p.contacto);
    const idTx = randomUUID();

    transacciones.push(cabecera(p, idTx));

    for (const l of doc.line_items ?? []) {
      renglones.push({
        id: randomUUID(),
        transaccion_id: idTx,
        cuenta_id: dueno?.cuenta_id ?? null,
        perfil_id: dueno?.perfil_id ?? null,
        fecha: p.fecha,
        item_id: l.item_id ?? null,
        sku: l.sku ?? null,
        nombre: (l.name ?? l.description ?? "Sin nombre").trim().slice(0, 300),
        cantidad: Number(l.quantity ?? 0),
        precio: Number(l.rate ?? 0),
        total: Number(l.item_total ?? 0),
      });
    }
  }

  abiertas += lote.length;
  if (abiertas % 200 < EN_PARALELO) {
    console.log(`  ${abiertas} de ${paraAbrir.length}… (cuota ${cuota})`);
  }
}

console.log(
  `\n  ${transacciones.length} transacciones · ${renglones.length} renglones.`,
);

// ---------------------------------------------------------------------------
// 4. Escribir
// ---------------------------------------------------------------------------

// Los renglones se borran y se vuelven a poner: un documento editado en Zoho
// puede tener hoy menos líneas que ayer, y actualizarlos uno a uno dejaría
// las viejas colgando.
const idsDoc = transacciones.map((t) => t.documento_id);
for (let i = 0; i < idsDoc.length; i += 100) {
  const lote = idsDoc.slice(i, i + 100);
  const viejas = await sb(
    `/transacciones_zoho?select=id&documento_id=in.(${lote.join(",")})`,
  );
  if (viejas.length === 0) continue;
  await sb(
    `/renglones_zoho?transaccion_id=in.(${viejas.map((v) => v.id).join(",")})`,
    { method: "DELETE", prefer: "return=minimal" },
  );
}

for (let i = 0; i < transacciones.length; i += 200) {
  await sb("/transacciones_zoho?on_conflict=documento_id,tipo", {
    method: "POST",
    body: JSON.stringify(transacciones.slice(i, i + 200)),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}
console.log(`  ${transacciones.length} transacciones escritas.`);

// El identificador de la transacción pudo cambiar al reemplazarla, así que los
// renglones se cuelgan del que quedó en la base, no del que se generó aquí.
const guardadas = new Map();
for (let i = 0; i < idsDoc.length; i += 100) {
  const lote = idsDoc.slice(i, i + 100);
  for (const t of await sb(
    `/transacciones_zoho?select=id,documento_id,tipo&documento_id=in.(${lote.join(",")})`,
  )) {
    guardadas.set(`${t.documento_id}|${t.tipo}`, t.id);
  }
}

const porDocumento = new Map(transacciones.map((t) => [t.id, `${t.documento_id}|${t.tipo}`]));
const listos = renglones
  .map((l) => ({
    ...l,
    transaccion_id: guardadas.get(porDocumento.get(l.transaccion_id)) ?? null,
  }))
  .filter((l) => l.transaccion_id);

for (let i = 0; i < listos.length; i += 400) {
  await sb("/renglones_zoho", {
    method: "POST",
    body: JSON.stringify(listos.slice(i, i + 400)),
    prefer: "return=minimal",
  });
}
console.log(`  ${listos.length} renglones escritos.`);

// La marca solo avanza si se abrió todo. Si se cortó por cuota, la próxima
// pasada vuelve a pedir desde donde estaba y recupera lo que faltó.
if (!cortado) {
  await sb("/sincronizaciones?on_conflict=fuente", {
    method: "POST",
    body: JSON.stringify({
      fuente: "historial",
      hasta: momento,
      documentos: transacciones.length,
      terminada_en: new Date().toISOString(),
    }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  console.log("  Marca de agua actualizada.");
} else {
  console.log("  Marca de agua sin mover: la próxima pasada continúa.");
}

console.log("\n  Listo.\n");
