// Cruza el archivo de Badger contra lo que ya hay en el SGV, y lo cuenta.
//
//   node scripts/badger-analizar.mjs                    resumen
//   node scripts/badger-analizar.mjs --dudosos          la lista entera para revisar
//
// **No escribe nada.** Las reglas del cruce viven en badger-cruce.mjs, que es
// el mismo módulo que usa la carga: si cada uno tuviera su copia, el informe
// diría una cosa y la carga haría otra.

import { conectar, cruzar, entorno, leerBadger, normalizar } from "./badger-cruce.mjs";

const ARCHIVO = process.argv[2]?.endsWith(".ods")
  ? process.argv[2]
  : "datos/Cuentas en Badger.ods";
const SOLO_DUDOSOS = process.argv.includes("--dudosos");

const env = entorno();
const sb = conectar(env);

const { cuentas: badger, tecnicas } = leerBadger(ARCHIVO);
const cuentas = await sb(
  "/cuentas?select=id,nombre,lat,lng,poblado,contacto_telefono,vendedor_id,origen,tipo&deleted_at=is.null",
);

const { seguros, dudosos, nuevos } = cruzar(badger, cuentas);

if (SOLO_DUDOSOS) {
  console.log(`\n  ${dudosos.length} PAREJAS PARA REVISAR\n`);
  console.log("  BADGER".padEnd(46) + "SGV".padEnd(44) + "PARECIDO  MISMO DUEÑO");
  for (const d of dudosos) {
    for (const [n, x] of d.candidatos.entries()) {
      console.log(
        "  " +
          (n === 0 ? d.b.nombre : "").slice(0, 42).padEnd(44) +
          x.c.nombre.slice(0, 40).padEnd(42) +
          `${Math.round(x.punto * 100)}%`.padStart(6) +
          (x.mismoDueno ? "     sí" : "     no") +
          (x.mismoTel ? "  · mismo teléfono" : ""),
      );
    }
  }
  console.log("");
  process.exit(0);
}

console.log(`\n  BADGER: ${badger.length} cuentas · ${tecnicas.length} técnicas descartadas`);
console.log(`  SGV:    ${cuentas.length} cuentas\n`);

console.log(`  RESULTADO DEL CRUCE`);
console.log(`    ${seguros.length} seguros`);
console.log(`    ${dudosos.length} dudosos`);
console.log(`    ${nuevos.length} sin correspondencia\n`);

const aportan = seguros.filter(
  (s) => (s.c.lat === null || s.c.lng === null) && s.b.lat !== null,
);
const conPoblado = seguros.filter((s) => s.b.poblado).length;
console.log(`  De los seguros, ${aportan.length} le ponen coordenadas a una cuenta que no las tiene`);
console.log(`  y ${conPoblado} traen además el poblado.\n`);

const porTipo = new Map();
const nuevosConPoblado = nuevos.filter((n) => n.poblado).length;
for (const n of nuevos) porTipo.set(n.tipo, (porTipo.get(n.tipo) ?? 0) + 1);
console.log(`  LOS ${nuevos.length} SIN CORRESPONDENCIA`);
for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${t}`);
}
console.log(`\n  ${nuevosConPoblado} de ellos traen poblado.`);

// Cuántos dudosos se resolverían solos si se aflojara una regla concreta.
let soloPorDueno = 0;
let soloPorPuntaje = 0;
for (const d of dudosos) {
  const m = d.candidatos[0];
  if (!m) continue;
  const alto = m.punto >= 0.99 || m.mismoTel;
  if (alto && !m.mismoDueno) soloPorDueno += 1;
  if (!alto && m.mismoDueno && m.punto >= 0.66) soloPorPuntaje += 1;
}
console.log(`\n  DE LOS ${dudosos.length} DUDOSOS`);
console.log(`    ${soloPorDueno} coinciden de nombre pero son de otro vendedor`);
console.log(`    ${soloPorPuntaje} son del mismo vendedor y se parecen bastante (66% o más)`);
console.log(`    ${dudosos.length - soloPorDueno - soloPorPuntaje} son dudosos de verdad\n`);

void normalizar;
