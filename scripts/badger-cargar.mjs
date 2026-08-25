// Carga en el SGV lo que trae el archivo de Badger.
//
//   node scripts/badger-cargar.mjs            ver qué haría, sin escribir
//   node scripts/badger-cargar.mjs --aplicar  escribir de verdad
//
// Hace dos cosas, y **solo con lo que no admite duda**:
//
//   1. A las cuentas que engancharon seguro les pone las coordenadas —y el
//      poblado, si es del vendedor del interior—.
//   2. Crea las cuentas de Badger que no existen en el SGV, que son sobre todo
//      **prospectos**: gente a la que se visita y todavía no compra, y que por
//      eso no aparece en ninguna factura.
//
// Las parejas dudosas no se tocan: se revisan a mano. Las reglas del cruce
// están en badger-cruce.mjs.

import { randomUUID } from "node:crypto";
import {
  conectar,
  cruzar,
  entorno,
  leerBadger,
  VENDEDORES,
} from "./badger-cruce.mjs";

const APLICAR = process.argv.includes("--aplicar");
const ARCHIVO = process.argv[2]?.endsWith(".ods")
  ? process.argv[2]
  : "datos/Cuentas en Badger.ods";

const env = entorno();
const sb = conectar(env);

const { cuentas: badger, tecnicas } = leerBadger(ARCHIVO);
const cuentas = await sb(
  "/cuentas?select=id,nombre,lat,lng,poblado,direccion,contacto_nombre,contacto_telefono,contacto_correo,tipo_comercio,volumen,vendedor_id,origen&deleted_at=is.null",
);

const { seguros, dudosos, nuevos } = cruzar(badger, cuentas);

console.log(`\n  ${badger.length} cuentas en Badger · ${tecnicas.length} técnicas fuera`);
console.log(`  ${seguros.length} seguros · ${dudosos.length} dudosos · ${nuevos.length} nuevos\n`);

// ---------------------------------------------------------------------------
// 1. Coordenadas a las que engancharon
//
// **Solo se rellenan huecos.** Nunca se pisa lo que el vendedor haya escrito:
// si él corrigió el teléfono o movió el punto, sabe algo que Badger no.
// ---------------------------------------------------------------------------

const retoques = [];

for (const s of seguros) {
  const cambios = {};

  if (s.c.lat === null && s.b.lat !== null) {
    cambios.lat = s.b.lat;
    cambios.lng = s.b.lng;
  }
  if (!s.c.poblado && s.b.poblado) cambios.poblado = s.b.poblado;
  if (!s.c.direccion && s.b.direccion) cambios.direccion = s.b.direccion;
  if (!s.c.contacto_nombre && s.b.contacto) cambios.contacto_nombre = s.b.contacto;
  if (!s.c.contacto_telefono && s.b.telefono) cambios.contacto_telefono = s.b.telefono;
  if (!s.c.contacto_correo && s.b.correo) cambios.contacto_correo = s.b.correo;
  if (!s.c.tipo_comercio && s.b.segmento) cambios.tipo_comercio = s.b.segmento;
  if (!s.c.volumen && s.b.volumen) cambios.volumen = s.b.volumen;

  if (Object.keys(cambios).length) retoques.push({ id: s.c.id, cambios, nombre: s.c.nombre });
}

const conCoordenadas = retoques.filter((r) => "lat" in r.cambios).length;
const conPoblado = retoques.filter((r) => "poblado" in r.cambios).length;

console.log(`  RETOQUES A CUENTAS QUE YA EXISTÍAN`);
console.log(`    ${retoques.length} cuentas ganan algún dato`);
console.log(`    ${conCoordenadas} de ellas, su ubicación en el mapa`);
console.log(`    ${conPoblado} además el poblado\n`);

// ---------------------------------------------------------------------------
// 2. Las que el SGV no conocía
// ---------------------------------------------------------------------------

const perfilDe = new Map(VENDEDORES);
const sinDueno = nuevos.filter((n) => !perfilDe.get(n.dueno));

/**
 * Los que Badger llama «cliente» y no engancharon con nada se quedan fuera.
 *
 * Un prospecto que no está en el SGV es un prospecto nuevo y punto: si no ha
 * comprado, no puede estar en Zoho. Pero un **cliente** que no engancha es
 * sospechoso — o su nombre en Badger es muy distinto del de Zoho, y crearlo
 * duplicaría una cuenta que ya existe con su facturación encima, o es cartera
 * de la casa que dejamos fuera a propósito.
 *
 * Duplicar un cliente es caro de deshacer: la facturación se queda en uno y el
 * trabajo de campo en el otro. Se revisan a mano.
 */
const clientesEnDuda = nuevos.filter(
  (n) => perfilDe.get(n.dueno) && n.tipo === "cliente",
);

const aCrear = nuevos
  .filter((n) => perfilDe.get(n.dueno) && n.tipo !== "cliente")
  .map((n) => ({
    id: randomUUID(),
    nombre: n.nombre,
    tipo: n.tipo,
    origen: "badger",
    vendedor_id: perfilDe.get(n.dueno),
    lat: n.lat,
    lng: n.lng,
    poblado: n.poblado,
    direccion: n.direccion,
    contacto_nombre: n.contacto,
    contacto_telefono: n.telefono,
    contacto_correo: n.correo,
    tipo_comercio: n.segmento,
    volumen: n.volumen,
    // La columna no admite nulo: sin interés marcado va la lista vacía,
    // que además es lo cierto — no es que se desconozca, es que no hay.
    productos_interes: n.interes ?? [],
    // Lo que quedó pendiente en Badger se guarda como nota, no como
    // compromiso: un compromiso lo asume una persona en una fecha, y aquí no
    // hay ni quién ni cuándo. Inventarlo llenaría la agenda de deudas falsas.
    notas: n.proximo ? `Venía de Badger con: ${n.proximo}` : null,
  }));

const porTipo = new Map();
for (const c of aCrear) porTipo.set(c.tipo, (porTipo.get(c.tipo) ?? 0) + 1);

console.log(`  CUENTAS NUEVAS`);
for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${t}`);
}
console.log(`    ${aCrear.filter((c) => c.lat !== null).length} con ubicación`);
console.log(`    ${aCrear.filter((c) => c.poblado).length} con poblado`);
console.log(`    ${aCrear.filter((c) => c.contacto_nombre).length} con nombre de contacto`);
if (sinDueno.length) {
  console.log(`\n    ${sinDueno.length} sin dueño reconocido, se quedan fuera`);
}
console.log(
  `    ${clientesEnDuda.length} marcados «cliente» sin enganche, se quedan para revisar`,
);

if (!APLICAR) {
  console.log("\n  Nada se escribió. Para hacerlo:\n");
  console.log("    node scripts/badger-cargar.mjs --aplicar\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------

for (const r of retoques) {
  await sb(`/cuentas?id=eq.${r.id}`, {
    method: "PATCH",
    body: JSON.stringify(r.cambios),
    prefer: "return=minimal",
  });
}
console.log(`\n  ${retoques.length} cuentas actualizadas.`);

for (let i = 0; i < aCrear.length; i += 200) {
  await sb("/cuentas", {
    method: "POST",
    body: JSON.stringify(aCrear.slice(i, i + 200)),
    prefer: "return=minimal",
  });
}
console.log(`  ${aCrear.length} cuentas creadas.`);

console.log("\n  Listo.\n");
