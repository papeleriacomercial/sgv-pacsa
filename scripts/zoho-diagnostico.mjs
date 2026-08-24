// Qué hay del otro lado, antes de escribir una línea de integración.
//
// Contesta la única pregunta que decide el diseño: **dónde vive el RUC en los
// contactos de Zoho Books** y en cuántos está puesto. De eso depende si el
// enganche con las cuentas del SGV es directo o hay que normalizar.
//
//   node scripts/zoho-diagnostico.mjs
//
// **No imprime datos de clientes.** De cada valor muestra su *forma* —los
// dígitos se vuelven 9 y las letras A— así que se ve el formato del RUC sin
// que salga ningún RUC. Los secretos se leen del entorno y nunca se muestran.

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------

function entorno() {
  let texto;
  try {
    texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    salir("No encontré .env.local en la raíz del proyecto.");
  }

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
  ].filter((k) => !vars[k]);

  if (faltan.length) {
    salir(
      `Faltan en .env.local: ${faltan.join(", ")}.\n` +
        "Ver el paso a paso de Zoho en docs/15-zoho.md.",
    );
  }

  return { ...vars, ZOHO_DOMINIO: vars.ZOHO_DOMINIO || "zoho.com" };
}

function salir(mensaje) {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

/** La forma del dato, no el dato: 8-123-4567 sale como 9-999-9999. */
function forma(valor) {
  if (valor === null || valor === undefined || valor === "") return "(vacío)";
  return String(valor)
    .replace(/[0-9]/g, "9")
    .replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "A")
    .slice(0, 40);
}

/** Un RUC panameño trae dígitos y guiones, y casi nunca menos de cinco. */
function pareceRuc(valor) {
  const s = String(valor ?? "");
  const digitos = (s.match(/[0-9]/g) ?? []).length;
  return digitos >= 5 && /[0-9]/.test(s) && !/@/.test(s) && s.length <= 30;
}

// ---------------------------------------------------------------------------

const env = entorno();
const CUENTAS = `https://accounts.${env.ZOHO_DOMINIO}`;
const API = `https://www.zohoapis.${env.ZOHO_DOMINIO.replace(/^zoho\./, "")}`;

async function accessToken() {
  const cuerpo = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const r = await fetch(`${CUENTAS}/oauth/v2/token`, {
    method: "POST",
    body: cuerpo,
  });
  const datos = await r.json();

  if (!datos.access_token) {
    salir(
      "Zoho no dio token de acceso.\n  Respuesta: " +
        JSON.stringify(datos) +
        "\n  Suele ser el centro de datos equivocado o un refresh token de otra organización.",
    );
  }
  return datos.access_token;
}

async function pedir(token, ruta, params = {}) {
  const url = new URL(`${API}/books/v3${ruta}`);
  url.searchParams.set("organization_id", env.ZOHO_ORG_ID);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const r = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const datos = await r.json();

  if (datos.code && datos.code !== 0) {
    salir(`Zoho respondió ${datos.code}: ${datos.message} (en ${ruta})`);
  }
  return datos;
}

// ---------------------------------------------------------------------------

const token = await accessToken();
console.log("\n  Conexión con Zoho Books: correcta.\n");

// --- 1. Cuántos clientes hay ------------------------------------------------

const lista = await pedir(token, "/contacts", {
  per_page: "200",
  contact_type: "customer",
});
const contactos = lista.contacts ?? [];
const total = lista.page_context?.total ?? contactos.length;

console.log(`  CLIENTES`);
console.log(`  ${total} en total · ${contactos.length} traídos para revisar\n`);

if (contactos.length === 0) {
  salir("No hay clientes que revisar.");
}

// --- 2. Qué campos vienen llenos -------------------------------------------

const relleno = new Map();
for (const c of contactos) {
  for (const [k, v] of Object.entries(c)) {
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    relleno.set(k, (relleno.get(k) ?? 0) + 1);
  }
}

console.log(`  CAMPOS CON ALGO (de ${contactos.length})\n`);
for (const [campo, veces] of [...relleno.entries()].sort((a, b) => b[1] - a[1])) {
  const pct = Math.round((veces / contactos.length) * 100);
  console.log(`    ${String(veces).padStart(4)}  ${String(pct).padStart(3)}%  ${campo}`);
}

// --- 3. Dónde puede estar el RUC -------------------------------------------
//
// La ficha de lista no trae campos personalizados, así que hay que abrir
// algunas. Cinco alcanzan para ver el patrón.

console.log(`\n  BUSCANDO EL RUC — abriendo 5 fichas completas\n`);

const candidatos = new Map();

for (const c of contactos.slice(0, 5)) {
  const detalle = await pedir(token, `/contacts/${c.contact_id}`);
  const ficha = detalle.contact ?? {};

  const planos = { ...ficha };
  for (const cf of ficha.custom_fields ?? []) {
    planos[`custom_fields → ${cf.label ?? cf.api_name}`] = cf.value;
  }
  delete planos.custom_fields;

  for (const [k, v] of Object.entries(planos)) {
    if (typeof v === "object") continue;
    if (!pareceRuc(v)) continue;
    if (!candidatos.has(k)) candidatos.set(k, []);
    candidatos.get(k).push(forma(v));
  }
}

if (candidatos.size === 0) {
  console.log("    Ningún campo parece un RUC. Habría que mirar una ficha a mano.\n");
} else {
  for (const [campo, formas] of candidatos) {
    console.log(`    ${campo}`);
    console.log(`      ${formas.join("   ")}\n`);
  }
  console.log("    (9 = dígito, A = letra. Los valores reales no se imprimen.)\n");
}

// --- 4. Cuánta facturación hay para cruzar ---------------------------------

const desde = new Date();
desde.setMonth(desde.getMonth() - 12);
const fecha = desde.toISOString().slice(0, 10);

const facturas = await pedir(token, "/invoices", {
  per_page: "1",
  date_start: fecha,
});

console.log(`  FACTURACIÓN`);
console.log(
  `  ${facturas.page_context?.total ?? "?"} facturas desde ${fecha}\n`,
);

console.log(
  "  Listo. Pégame esta salida entera: no lleva ningún dato de cliente.\n",
);
