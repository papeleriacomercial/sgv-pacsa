// Borra del almacenamiento el PDF de una o varias cotizaciones.
//
//   node scripts/borrar-pdf.mjs COT-260914-6EF6 COT-260914-8EA2
//   node scripts/borrar-pdf.mjs --seco COT-260914-6EF6      enseña qué haría, sin borrar
//
// **Esto NO se deshace.** El resto del sistema usa borrado lógico —`deleted_at`— pero en Storage
// no existe tal cosa: lo que se borra, se fue. Por eso el guion **exige que la cotización ya esté
// borrada lógicamente** antes de tocar su archivo: si alguien se equivoca de código, el guion se
// planta en vez de dejar un expediente vivo sin su documento.
//
// Nació el 14 de septiembre de 2026 para limpiar dos cotizaciones de prueba, y se dejó escrito
// porque va a hacer falta otra vez: mientras no haya un ambiente de pruebas, probar el envío de
// documentos crea documentos reales.

import { readFileSync } from "node:fs";

const SECO = process.argv.includes("--seco");
const CODIGOS = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (CODIGOS.length === 0) {
  console.error("\n  Falta el código. Ej: node scripts/borrar-pdf.mjs COT-260914-6EF6\n");
  process.exit(1);
}

const env = {};
for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const cabeceras = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const lista = CODIGOS.map((c) => `"${c}"`).join(",");
const filas = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/cotizaciones` +
    `?select=codigo,pdf_path,deleted_at&codigo=in.(${lista})`,
  { headers: cabeceras },
).then((r) => r.json());

if (!Array.isArray(filas) || filas.length === 0) {
  console.error(`\n  No se encontró ninguna cotización con esos códigos.\n`);
  process.exit(1);
}

// **El seguro.** Borrar el papel de un documento vivo dejaría el expediente mostrando una
// cotización que no se puede abrir, y nadie sabría por qué.
const vivas = filas.filter((f) => f.deleted_at === null);
if (vivas.length) {
  console.error(`\n  ALTO: estas cotizaciones NO están borradas todavía:`);
  for (const v of vivas) console.error(`    ${v.codigo}`);
  console.error(`\n  Bórralas primero. No se tocó ningún archivo.\n`);
  process.exit(1);
}

const rutas = filas.filter((f) => f.pdf_path).map((f) => f.pdf_path);

console.log(`\n  ${filas.length} cotizaciones, ${rutas.length} archivos:`);
for (const f of filas) console.log(`    ${f.codigo}  ->  ${f.pdf_path ?? "(sin archivo)"}`);

if (SECO) {
  console.log(`\n  Pasada en seco: no se borró nada.\n`);
  process.exit(0);
}

const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/cotizaciones`, {
  method: "DELETE",
  headers: cabeceras,
  body: JSON.stringify({ prefixes: rutas }),
});

if (!r.ok) {
  console.error(`\n  Falló el borrado: ${r.status}`);
  console.error(`  ${(await r.text()).slice(0, 300)}\n`);
  process.exit(1);
}

console.log(`\n  ${rutas.length} archivos borrados. Esto no se deshace.\n`);
