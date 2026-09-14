// Carga los límites de los corregimientos de Panamá. Se corre una vez.
//
//   node scripts/corregimientos-cargar.mjs            baja y carga
//   node scripts/corregimientos-cargar.mjs --seco     baja y cuenta, sin escribir
//
// **La fuente es el Smithsonian Tropical Research Institute**, división de 2020, 699
// corregimientos, licencia CC-BY-SA-4.0 — que obliga a dar crédito y por eso queda escrito acá y
// en `docs/17-ubicacion-y-zona.md`. Su capa trae provincia, distrito, corregimiento y el código
// del censo en la misma fila, así que un solo cálculo llena los tres campos de una cuenta.
//
// **Falta la oficial del IGN Tommy Guardia (2025, 730 corregimientos).** Su servidor público
// entrega los nombres pero no la geometría; hay que pedirla. Cuando llegue, se recarga esta misma
// tabla y nada más cambia.
//
// ============================================================================================
// POR QUÉ SE SIMPLIFICA LA GEOMETRÍA
// ============================================================================================
//
// El archivo crudo pesa cientos de megas: son contornos a resolución de mapa topográfico, con
// vértices cada pocos metros. Para decir en qué corregimiento cayó una tienda **esa precisión no
// aporta nada** y sí cuesta en cada consulta.
//
// Se simplifica a ~20 metros de tolerancia, que mueve los bordes menos de lo que se mueve un GPS
// de teléfono. **Lo que no se hace es simplificar cada polígono por su cuenta**: eso abre huecos y
// solapes entre vecinos —un punto en la frontera caería en dos corregimientos o en ninguno— así
// que la simplificación la hace PostGIS con `ST_SimplifyPreserveTopology`, que respeta el borde.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SECO = process.argv.includes("--seco");

const CACHE = "datos/corregimientos-2024.geojson";
const SERVIDOR =
  "https://services2.arcgis.com/HRY6x8qt5qjGnAA9/arcgis/rest/services/Panama_Corregimientos_Boundaries_2024/FeatureServer/0";

const env = {};
for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// --- 1. El archivo ----------------------------------------------------------

async function bajar() {
  if (existsSync(CACHE)) {
    console.log("  (ya estaba bajado)");
    return JSON.parse(readFileSync(CACHE, "utf8"));
  }

  const rasgos = [];
  const PASO = 60;
  for (let offset = 0; ; offset += PASO) {
    const url =
      `${SERVIDOR}/query?where=1%3D1&outFields=ID_CORR,Provincia,Distrito,Corregimiento,Cabecera` +
      `&returnGeometry=true&outSR=4326&geometryPrecision=6&f=geojson` +
      `&resultOffset=${offset}&resultRecordCount=${PASO}`;
    const j = await fetch(url).then((r) => r.json());
    if (j.error) throw new Error(JSON.stringify(j.error));
    const lote = j.features ?? [];
    rasgos.push(...lote);
    process.stdout.write(`\r  bajando… ${rasgos.length}`);
    if (lote.length < PASO) break;
  }
  console.log("");

  const gj = { type: "FeatureCollection", features: rasgos };
  writeFileSync(CACHE, JSON.stringify(gj));
  return gj;
}

// --- 2. La carga ------------------------------------------------------------

const sb = (ruta, opciones = {}) =>
  fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, {
    ...opciones,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  });

console.log("\n  Trayendo los corregimientos…");
const capa = await bajar();
console.log(`  ${capa.features.length} corregimientos\n`);

// Todos tienen que traer los cuatro datos, o la cuenta que caiga ahí queda a medias.
const incompletos = capa.features.filter(
  (f) =>
    !f.properties?.ID_CORR ||
    !f.properties?.Provincia ||
    !f.properties?.Distrito ||
    !f.properties?.Corregimiento ||
    !f.geometry,
);
if (incompletos.length) {
  console.error(`  ${incompletos.length} rasgos sin datos completos. No se carga nada.`);
  process.exit(1);
}

const provincias = new Set(capa.features.map((f) => f.properties.Provincia));
const distritos = new Set(
  capa.features.map((f) => `${f.properties.Provincia}|${f.properties.Distrito}`),
);
console.log(`  ${provincias.size} provincias · ${distritos.size} distritos\n`);

if (SECO) {
  console.log("  Pasada en seco: no se escribió nada.\n");
  process.exit(0);
}

// **Se llama a `cargar_corregimiento`, que es una función con nombre y tipos**, y no a una que
// ejecute SQL: la geometría hay que construirla en el servidor —PostgREST no convierte GeoJSON— y
// el camino corto habría sido una puerta abierta para siempre. La simplificación también vive
// allá, porque hacerla polígono por polígono abre huecos entre vecinos.

let puestos = 0;

for (const f of capa.features) {
  const p = f.properties;

  const r = await sb("/rpc/cargar_corregimiento", {
    method: "POST",
    body: JSON.stringify({
      p_codigo: p.ID_CORR,
      p_provincia: p.Provincia,
      p_distrito: p.Distrito,
      p_corregimiento: p.Corregimiento,
      p_cabecera: p.Cabecera === "Sí" || p.Cabecera === "Si",
      p_geojson: JSON.stringify(f.geometry),
    }),
  });

  if (!r.ok) {
    console.error(`\n  Falló en ${p.Corregimiento} (${p.ID_CORR}): ${r.status}`);
    console.error(`  ${(await r.text()).slice(0, 400)}`);
    process.exit(1);
  }

  puestos += 1;
  if (puestos % 25 === 0 || puestos === capa.features.length) {
    process.stdout.write(`\r  cargando… ${puestos} de ${capa.features.length}`);
  }
}

console.log(`\n\n  ${puestos} corregimientos en la base.\n`);
