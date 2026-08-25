// Deshace lo que trajo `zoho-sincronizar.mjs`, para poder volver a empezar.
//
//   node scripts/zoho-revertir.mjs            ver qué borraría, sin borrar
//   node scripts/zoho-revertir.mjs --aplicar  borrar de verdad
//
// **No borra trabajo de nadie.** Una cuenta que llegó desde Books pero que ya
// tiene un seguimiento, un compromiso, una oportunidad o pertenece a una lista
// **no se toca**: alguien la trabajó, y eso ya no es dato importado. Se avisa
// cuáles quedaron y por qué.
//
// El espejo `clientes_zoho` sí se vacía entero: se rehace en cada pasada, no
// contiene nada que nadie haya escrito.

import { readFileSync } from "node:fs";

const APLICAR = process.argv.includes("--aplicar");

function entorno() {
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const vars = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const faltan = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (k) => !vars[k],
  );
  if (faltan.length) {
    console.error(`\n  Faltan en .env.local: ${faltan.join(", ")}\n`);
    process.exit(1);
  }
  return vars;
}

const env = entorno();

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

const importadas = await sb(
  "/cuentas?select=id,nombre&origen=eq.facturacion&deleted_at=is.null",
);

if (importadas.length === 0) {
  console.log("\n  No hay cuentas venidas de la facturación. Nada que deshacer.\n");
  process.exit(0);
}

const ids = new Set(importadas.map((c) => c.id));

/** Qué cuentas ya tienen trabajo encima y por lo tanto no se tocan. */
const conTrabajo = new Map();
async function marcar(tabla, campo, motivo) {
  const filas = await sb(`/${tabla}?select=${campo}&deleted_at=is.null`);
  for (const f of filas) {
    const id = f[campo];
    if (!ids.has(id)) continue;
    if (!conTrabajo.has(id)) conTrabajo.set(id, new Set());
    conTrabajo.get(id).add(motivo);
  }
}

await marcar("seguimientos", "cuenta_id", "seguimiento");
await marcar("compromisos", "cuenta_id", "compromiso");
await marcar("oportunidades", "cuenta_id", "venta");

// `listas_cuentas` no tiene borrado lógico: es una relación, se quita o no está.
for (const f of await sb("/listas_cuentas?select=cuenta_id")) {
  if (!ids.has(f.cuenta_id)) continue;
  if (!conTrabajo.has(f.cuenta_id)) conTrabajo.set(f.cuenta_id, new Set());
  conTrabajo.get(f.cuenta_id).add("lista");
}

const borrables = importadas.filter((c) => !conTrabajo.has(c.id));
const intocables = importadas.filter((c) => conTrabajo.has(c.id));

console.log(`\n  ${importadas.length} cuentas venidas de la facturación.`);
console.log(`  ${borrables.length} se pueden borrar sin perder nada.`);
console.log(`  ${intocables.length} ya tienen trabajo encima y se quedan.\n`);

for (const c of intocables.slice(0, 15)) {
  console.log(`    ${c.nombre.slice(0, 48).padEnd(50)} ${[...conTrabajo.get(c.id)].join(", ")}`);
}
if (intocables.length > 15) console.log(`    … y ${intocables.length - 15} más\n`);

// También hay que soltar el enlace de las cuentas que ya existían y solo se
// marcaron con su contacto de Zoho.
const enlazadas = await sb(
  "/cuentas?select=id&origen=neq.facturacion&zoho_contacto_id=not.is.null&deleted_at=is.null",
);
console.log(`  ${enlazadas.length} cuentas propias quedarían sin su enlace a Books.\n`);

if (!APLICAR) {
  console.log("  Nada se borró. Para hacerlo:\n");
  console.log("    node scripts/zoho-revertir.mjs --aplicar\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------

// El espejo entero: no guarda nada que nadie haya escrito.
await sb("/clientes_zoho?id=not.is.null", {
  method: "DELETE",
  prefer: "return=minimal",
});
console.log("  Espejo vaciado.");

for (let i = 0; i < borrables.length; i += 100) {
  const lote = borrables.slice(i, i + 100).map((c) => c.id);
  await sb(`/cuentas?id=in.(${lote.join(",")})`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
}
console.log(`  ${borrables.length} cuentas borradas.`);

if (enlazadas.length) {
  await sb("/cuentas?zoho_contacto_id=not.is.null", {
    method: "PATCH",
    body: JSON.stringify({ zoho_contacto_id: null }),
    prefer: "return=minimal",
  });
  console.log(`  ${enlazadas.length} enlaces soltados.`);
}

console.log("\n  Listo. Se puede volver a sincronizar desde cero.\n");
