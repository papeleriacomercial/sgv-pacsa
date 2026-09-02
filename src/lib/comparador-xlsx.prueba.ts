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

test('la plantilla cabe impresa en una sola hoja carta', () => {
  // «Ya dos páginas rompe esto, el cliente no lo va a imprimir... es importante que lo pueda
  // imprimir y llevárselo a una tercera persona. Usualmente es el jefe que aprueba.» — el usuario,
  // 2 de septiembre de 2026. La hoja se lee en pantalla pero se DECIDE en papel, así que el tamaño
  // impreso es un requisito y no una preferencia.
  const zip = unzipSync(new Uint8Array(readFileSync(PLANTILLA)))
  const hoja = strFromU8(zip['xl/worksheets/sheet1.xml'])

  const filas = [...hoja.matchAll(/<row[^>]*r="(\d+)"[^>]*?(?:\/>|>.*?<\/row>)/gs)]
  const ultima = Math.max(...filas.map((m) => Number(m[1])))

  // PRIMERO: QUE SE PUEDA MEDIR. Una fila en blanco sin formato propio no genera elemento `<row>`,
  // y Excel igual le da su alto al imprimir. Sumar sólo lo escrito dio una vez 10,02" para una hoja
  // que medía 11,27" — cabía en la aritmética y no en el papel. Si falta una fila, esta prueba se
  // niega a medir en vez de dar un número tranquilizador.
  const sinEscribir = []
  for (let f = 1; f <= ultima; f++) {
    if (!filas.some((m) => Number(m[1]) === f)) sinEscribir.push(f)
  }
  assert.deepEqual(sinEscribir, [], 'estas filas no están escritas y su alto no se puede medir')

  const alto = filas.reduce((s, m) => s + Number((m[0].match(/ht="([\d.]+)"/) || [])[1] ?? 15), 0)
  const margenes = strFromU8(zip['xl/worksheets/sheet1.xml']).match(/<pageMargins[^>]*\/>/)![0]
  // `[0-9.]` y no `\d`: dentro de una plantilla de texto la barra invertida se pierde y el patrón
  // acabaría buscando la letra «d». Pasó al escribir esta misma prueba, y no dio error de sintaxis:
  // dio `null` al buscar el margen.
  const margen = (lado: string) =>
    Number(margenes.match(new RegExp(`${lado}="([0-9.]+)"`))![1])

  const altoUtil = (11 - margen('top') - margen('bottom')) * 72
  assert.ok(alto <= altoUtil, `la hoja mide ${(alto / 72).toFixed(2)}" y caben ${(altoUtil / 72).toFixed(2)}"`)

  // El ancho de las columnas que se imprimen. Un carácter de ancho son 7 píxeles más 5 de relleno.
  const ancho = ['2', '3', '4'].reduce((s, col) => {
    const c = hoja.match(new RegExp(`<col[^>]*min="${col}"[^>]*/>`))![0]
    return s + Number(c.match(/width="([\d.]+)"/)![1]) * 7 + 5
  }, 0)
  const anchoUtil = (8.5 - margen('left') - margen('right')) * 96
  assert.ok(ancho <= anchoUtil, `las columnas miden ${(ancho / 96).toFixed(2)}" y caben ${(anchoUtil / 96).toFixed(2)}"`)

  // Carta, no A4. Y el interruptor sin el cual los «ajustar a una página» no hacen nada.
  assert.match(hoja, /<pageSetup[^>]*paperSize="1"/)
  assert.match(hoja, /<pageSetUpPr fitToPage="true"\/>/)
})

test('ninguna línea de texto se sale del ancho imprimible', () => {
  // No hay celdas combinadas a propósito: en Excel el texto largo se derrama sobre las columnas
  // vacías de la derecha, y dentro de una celda combinada **se cortaría en silencio**. Pero el
  // derrame también tiene fin: lo que pase del ancho de B+C+D se pierde al imprimir.
  const zip = unzipSync(new Uint8Array(readFileSync(PLANTILLA)))
  const hoja = strFromU8(zip['xl/worksheets/sheet1.xml'])
  const compartidas = [
    ...strFromU8(zip['xl/sharedStrings.xml']).matchAll(/<si>(.*?)<\/si>/gs),
  ].map((m) => m[1].replace(/<[^>]+>/g, ''))

  const CABEN = 100
  const largas: string[] = []
  for (const m of hoja.matchAll(/<c r="(B\d+)"([^>]*)>(.*?)<\/c>/gs)) {
    const v = (m[3].match(/<v>(.*?)<\/v>/s) || [])[1]
    const enLinea = (m[3].match(/<is>.*?<t[^>]*>(.*?)<\/t>.*?<\/is>/s) || [])[1]
    const texto = enLinea ?? (/t="s"/.test(m[2]) ? compartidas[Number(v)] : '')
    if (texto && texto.length > CABEN) largas.push(`${m[1]} (${texto.length})`)
  }
  assert.deepEqual(largas, [], `estas líneas se cortarían al imprimir, el ancho es ${CABEN}`)
})

test('la hoja dice quién la entregó, y no se llama su vendedor', async () => {
  // «Todavía no somos sus vendedores... todavía no le estamos vendiendo.» — el usuario, 2 de
  // septiembre de 2026. La hoja se entrega en una visita a alguien que hoy le compra a otro, y
  // darse por su proveedor en el encabezado es empezar mintiendo. **La prueba cuida las palabras**
  // porque el rótulo es lo primero que el cliente lee de nosotros.
  servir(readFileSync(PLANTILLA))
  const { porNombre } = await abrir(
    await generarComparador({
      nuestro: NUESTRO,
      cliente: {},
      vendedor: { nombre: 'Ana Ruiz', telefono: '6000-0000' },
    })
  )
  assert.equal(porNombre.COMPARADOR_VENDEDOR, 'Vendedor que le visita: Ana Ruiz · 6000-0000')
  assert.doesNotMatch(String(porNombre.COMPARADOR_VENDEDOR), /Su vendedor/)
})

test('lo que falta de la firma no deja separadores sueltos', async () => {
  // UN «·» SOLO DELATA QUE FALTA UN DATO, y esta hoja es lo único que la casa deja sobre la mesa.
  servir(readFileSync(PLANTILLA))
  const sinTelefono = await abrir(
    await generarComparador({
      nuestro: NUESTRO,
      cliente: {},
      vendedor: { nombre: 'Ana Ruiz', telefono: null },
    })
  )
  assert.equal(sinTelefono.porNombre.COMPARADOR_VENDEDOR, 'Vendedor que le visita: Ana Ruiz')

  // Sin nombre no sale ni el rótulo: «Vendedor que le visita:» a secas es peor que el silencio.
  servir(readFileSync(PLANTILLA))
  const sinNadie = await abrir(
    await generarComparador({
      nuestro: NUESTRO,
      cliente: {},
      vendedor: { nombre: null, telefono: '6000-0000' },
    })
  )
  assert.equal(sinNadie.porNombre.COMPARADOR_VENDEDOR, null)
})

test('el logo está a la izquierda y no encima del título', async () => {
  // «El logo estando a la derecha quedó pisando el título de la línea número uno.» Una imagen flota
  // por encima de la cuadrícula: si se ancla donde hay texto, lo tapa. Acá se ancla en la columna B
  // de la fila 1, **que se dejó vacía a propósito**, y el título vive en la fila 2.
  const zip = unzipSync(new Uint8Array(readFileSync(PLANTILLA)))
  const dibujo = strFromU8(zip['xl/drawings/drawing1.xml'])
  assert.match(dibujo, /<xdr:col>1<\/xdr:col>/, 'el logo tiene que anclar en la columna B')
  assert.match(dibujo, /<xdr:row>0<\/xdr:row>/, 'y en la primera fila')

  const hoja = strFromU8(zip['xl/worksheets/sheet1.xml'])
  const fila1 = hoja.match(/<row[^>]*r="1"[^>]*?(?:\/>|>.*?<\/row>)/s)![0]
  assert.ok(!/<v>|<is>/.test(fila1), 'la fila del logo tiene que estar vacía o el logo la pisa')
})

test('el logo viaja dentro del archivo y está bien declarado', async () => {
  // Un paquete de Excel es un zip con reglas: si la imagen está pero la relación o el tipo de
  // contenido no, Excel no muestra un hueco — **avisa que el archivo está dañado y ofrece
  // repararlo**, delante del cliente. Por eso se comprueban las cuatro piezas y no solo la imagen.
  servir(readFileSync(PLANTILLA))
  const blob = await generarComparador({ nuestro: NUESTRO, cliente: {} })
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()))

  for (const pieza of [
    'xl/media/image1.png',
    'xl/drawings/drawing1.xml',
    'xl/drawings/_rels/drawing1.xml.rels',
    'xl/worksheets/_rels/sheet1.xml.rels',
  ]) {
    assert.ok(zip[pieza]?.length, `falta ${pieza}`)
  }

  const hoja = strFromU8(zip['xl/worksheets/sheet1.xml'])
  assert.match(hoja, /<drawing r:id="rId1"\/><\/worksheet>/, 'el dibujo va al final de la hoja')
  assert.match(strFromU8(zip['[Content_Types].xml']), /drawing\+xml/)
  assert.match(strFromU8(zip['xl/worksheets/_rels/sheet1.xml.rels']), /drawings\/drawing1\.xml/)
  assert.match(strFromU8(zip['xl/drawings/_rels/drawing1.xml.rels']), /media\/image1\.png/)
})

test('todos los nombres apuntan a la hoja que existe', () => {
  // Los nombres se escribieron una vez con «Comparación» y la hoja se llama «Comparacion». Apuntaban
  // a una hoja inexistente, y el archivo se abría igual: la celda simplemente no se llenaba.
  const zip = unzipSync(new Uint8Array(readFileSync(PLANTILLA)))
  const libro = strFromU8(zip['xl/workbook.xml'])
  const laHoja = libro.match(/<sheet name="([^"]+)"/)![1]

  const ajenos: string[] = []
  for (const m of libro.matchAll(/<definedName name="([^"]+)"[^>]*>'([^']+)'!/g)) {
    if (m[2] !== laHoja) ajenos.push(`${m[1]} → ${m[2]}`)
  }
  assert.deepEqual(ajenos, [], `la hoja se llama «${laHoja}»`)
})
