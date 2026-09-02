/**
 * El archivo que recibe el cliente — §7.10.
 *
 * SE ARMA CON EL GENERADOR DE VERDAD y se lee de vuelta **por nombre de celda**, nunca por
 * dirección. Si estas pruebas leyeran «la celda C22», seguirían pasando el día que un nombre
 * apuntara al sitio equivocado — que es exactamente el fallo silencioso contra el que se diseñó el
 * generador.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { generarComparador } from './comparador-xlsx.ts'

const PLANTILLA = 'public/plantillas/comparador-rollos-termicos.xlsx'

/**
 * El generador pide la plantilla por HTTP porque en el celular corre dentro del navegador.
 * `servir` le pasa un archivo del disco, o una versión alterada para probar las defensas.
 */
function servir(bytes: Uint8Array | Buffer) {
  globalThis.fetch = (async () => ({ ok: true, arrayBuffer: async () => bytes })) as unknown as typeof fetch
}

const NUESTRO = { precioCaja: 36, rollosCaja: 50, metrosRollo: 60, calibre: 55 }

/** Abre el archivo generado y devuelve el valor de cada celda, indexado por nombre definido. */
async function abrir(blob: Blob) {
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const compartidas = [
    ...strFromU8(zip['xl/sharedStrings.xml']).matchAll(/<si>(.*?)<\/si>/gs),
  ].map((m) => m[1].replace(/<[^>]+>/g, ''))
  const hoja = strFromU8(zip['xl/worksheets/sheet1.xml'])

  const celda: Record<string, string | null> = {}
  for (const m of hoja.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
    const [, ref, atributos, cuerpo] = m
    // LA CELDA AUTO-CERRADA ES LA CELDA VACÍA. Leerla mal fue un error real de una comprobación
    // anterior: el patrón se comía el valor de la celda siguiente y reportaba un dato inexistente.
    if (cuerpo === undefined) {
      celda[ref] = null
      continue
    }
    const v = (cuerpo.match(/<v>(.*?)<\/v>/s) || [])[1]
    const enLinea = (cuerpo.match(/<is>.*?<t[^>]*>(.*?)<\/t>.*?<\/is>/s) || [])[1]
    const tipo = (atributos.match(/t="([^"]+)"/) || [])[1]
    celda[ref] =
      enLinea !== undefined ? enLinea : tipo === 's' ? compartidas[Number(v)] : (v ?? null)
  }

  const porNombre: Record<string, string | null> = {}
  for (const m of strFromU8(zip['xl/workbook.xml']).matchAll(
    /<definedName name="([^"]+)">.*?\$([A-Z]+)\$(\d+)<\/definedName>/g
  )) {
    porNombre[m[1]] = celda[m[2] + m[3]] ?? null
  }
  return { porNombre, hoja, libro: strFromU8(zip['xl/workbook.xml']) }
}

test('nuestros datos siempre se escriben, el calibre incluido', async () => {
  servir(readFileSync(PLANTILLA))
  const { porNombre } = await abrir(await generarComparador({ nuestro: NUESTRO, cliente: {} }))

  assert.equal(porNombre.NUESTRO_PRECIO_CAJA, '36')
  assert.equal(porNombre.NUESTRO_ROLLOS_CAJA, '50')
  assert.equal(porNombre.NUESTRO_METROS_ROLLO, '60')
  assert.equal(porNombre.NUESTRO_CALIBRE, '55')
})

test('sin datos del cliente quedan los del ejemplo, y la nota lo dice', async () => {
  // Es la excepción del documento: «se envía la hoja con valores de ejemplo claramente marcados
  // como tales».
  servir(readFileSync(PLANTILLA))
  const { porNombre } = await abrir(await generarComparador({ nuestro: NUESTRO, cliente: {} }))

  assert.equal(porNombre.CLIENTE_PRECIO_CAJA, '30')
  assert.equal(porNombre.CLIENTE_ROLLOS_CAJA, '50')
  assert.match(String(porNombre.COMPARADOR_NOTA_EJEMPLO), /solo un ejemplo/)
})

test('con datos parciales, los que faltan quedan vacíos y no con el ejemplo', async () => {
  // LA REGLA MENOS OBVIA DEL MÓDULO. Escribir sólo lo que el cliente dio dejaría lo demás con el
  // valor de ejemplo, y él leería «50 rollos por caja» junto a su precio real, como si fuera suyo.
  // Los números de esta prueba son distintos a los del ejemplo a propósito: con los mismos, la
  // prueba no podría distinguir un acierto de un error.
  servir(readFileSync(PLANTILLA))
  const { porNombre } = await abrir(
    await generarComparador({
      nuestro: NUESTRO,
      cliente: { precioCaja: 27.5, metrosRollo: 38, cajasPedido: 12, semanasEntrePedidos: 6 },
    })
  )

  assert.equal(porNombre.CLIENTE_PRECIO_CAJA, '27.5')
  assert.equal(porNombre.CLIENTE_METROS_ROLLO, '38')
  assert.equal(porNombre.CLIENTE_CAJAS_PEDIDO, '12')
  assert.equal(porNombre.CLIENTE_SEMANAS, '6')
  assert.equal(porNombre.CLIENTE_ROLLOS_CAJA, null, 'el que no dio tiene que quedar vacío')
  assert.match(String(porNombre.COMPARADOR_NOTA_EJEMPLO), /los que usted nos indicó/)
})

test('ninguna fórmula viaja con su resultado guardado', async () => {
  // Sin esto el cliente abre la hoja y ve los números del ejemplo al lado de sus propios datos,
  // porque Excel muestra el último resultado guardado hasta que recalcula.
  servir(readFileSync(PLANTILLA))
  const { hoja, libro } = await abrir(await generarComparador({ nuestro: NUESTRO, cliente: {} }))

  const conCache: string[] = []
  for (const m of hoja.matchAll(/<c r="([A-Z]+\d+)"[^>]*>(.*?)<\/c>/gs)) {
    if (/<f[ >]/.test(m[2]) && /<v>/.test(m[2])) conCache.push(m[1])
  }
  assert.deepEqual(conCache, [], 'estas fórmulas traen resultado guardado')
  assert.match(libro, /fullCalcOnLoad="true"/)
})

test('si la plantilla pierde un nombre de celda, el archivo no se genera', async () => {
  // UN ARCHIVO MAL ARMADO QUE SE VE BIEN ES PEOR QUE UN ERROR: el vendedor lo mandaría sin mirarlo.
  const zip = unzipSync(new Uint8Array(readFileSync(PLANTILLA)))
  zip['xl/workbook.xml'] = strToU8(
    strFromU8(zip['xl/workbook.xml']).replace(/<definedName name="NUESTRO_CALIBRE">.*?<\/definedName>/, '')
  )
  servir(zipSync(zip, { level: 0 }))

  await assert.rejects(
    () => generarComparador({ nuestro: NUESTRO, cliente: {} }),
    /NUESTRO_CALIBRE/,
    'tenía que negarse a generar el archivo'
  )
})
