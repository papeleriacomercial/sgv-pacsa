/**
 * El archivo del Comparador de Rendimiento — §7.10, etapa 1.
 *
 * NO DIBUJA EL ARCHIVO: RELLENA LA PLANTILLA. Abre `public/plantillas/comparador-rollos-termicos.xlsx`,
 * cambia los diez valores que le tocan y la vuelve a cerrar. **Es el mismo archivo**, así que no
 * puede verse distinto — y el día que el negocio quiera cambiar un color, un texto o el orden de una
 * sección, lo hace en Excel y este archivo no se entera. Decisión del usuario del 1 de septiembre de
 * 2026, camino A.
 *
 * SE ESCRIBE POR NOMBRE DE CELDA, NO POR DIRECCIÓN, y ésa es la decisión que evita el fallo
 * silencioso. Si acá dijera «la celda C19», el día que alguien inserte un renglón en la plantilla
 * **el precio se escribiría en el sitio equivocado y nadie se daría cuenta**: el archivo saldría bien
 * formado, con el número en otro lado. La plantilla lleva nombres definidos —lo que Excel llama
 * rangos con nombre— y Excel los mueve solos al insertar filas.
 *
 * Y SI UN NOMBRE NO APARECE, ESTO SE DETIENE. Un archivo mal armado que se ve bien es peor que un
 * error: el vendedor lo mandaría sin mirarlo.
 *
 * CORRE EN EL CELULAR, NO EN EL SERVIDOR. Lo obliga el requisito de trabajar **sin señal en la
 * calle**: si lo armara el servidor, sin internet no habría archivo. Es el mismo camino que ya usa la
 * cotización en PDF.
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import type { DatosDelCliente, NuestraOferta } from '@/lib/comparador'

/** Dónde vive la plantilla, servida como archivo estático. */
export const RUTA_PLANTILLA = '/plantillas/comparador-rollos-termicos.xlsx'

/** Lo que hace falta para armar el archivo. */
export type DatosDelComparador = {
  /** Los nuestros. **Son los únicos obligatorios**: la hoja nunca sale en blanco completo. */
  nuestro: NuestraOferta
  /** Los del cliente. Cualquiera puede faltar. */
  cliente: Partial<DatosDelCliente>
  /** Para quién es la hoja. Va en el encabezado. */
  nombreCliente?: string | null
  /** Cuándo se preparó. Va en el encabezado. */
  fecha?: Date
  /**
   * Quién la entregó, con su teléfono.
   *
   * **Es la mitad que cierra el circuito.** Si el que aprueba decide comprar, tiene que poder llamar
   * sin volver a preguntar quién trajo el papel.
   */
  vendedor?: { nombre?: string | null; telefono?: string | null }
}

/** Los nombres que la plantilla tiene que traer. Si falta uno, el archivo no se genera. */
const CELDAS_DE_VALOR = [
  'CLIENTE_PRECIO_CAJA',
  'CLIENTE_ROLLOS_CAJA',
  'CLIENTE_METROS_ROLLO',
  'CLIENTE_CAJAS_PEDIDO',
  'CLIENTE_SEMANAS',
  'NUESTRO_PRECIO_CAJA',
  'NUESTRO_ROLLOS_CAJA',
  'NUESTRO_METROS_ROLLO',
  'NUESTRO_CALIBRE',
] as const

const CELDAS_DE_TEXTO = [
  'COMPARADOR_ENCABEZADO',
  'COMPARADOR_VENDEDOR',
  'COMPARADOR_NOTA_EJEMPLO',
] as const

/**
 * La nota que explica de dónde salen los números de la sección 1.
 *
 * **La plantilla dice «son solo un ejemplo», y eso deja de ser cierto en cuanto el vendedor escribe
 * un dato del cliente.** Una hoja que llama «ejemplo» a lo que el cliente acaba de dictar es una
 * hoja que le está diciendo que no le creyeron.
 */
const NOTA_SON_EJEMPLO =
  'Los números que vienen escritos son solo un ejemplo: reemplácelos por los suyos.'
const NOTA_SON_SUYOS =
  'Los números de esta sección son los que usted nos indicó. Puede corregirlos cuando quiera.'

/**
 * Resuelve los nombres definidos de la plantilla a direcciones de celda.
 *
 * Un nombre se guarda como `'Comparacion'!$C$19`; acá se queda con la parte que importa.
 */
function leerNombres(libroXml: string): Record<string, string> {
  const nombres: Record<string, string> = {}
  for (const m of libroXml.matchAll(/<definedName name="([^"]+)"[^>]*>([^<]+)<\/definedName>/g)) {
    const celda = m[2].split('!').pop()?.replace(/\$/g, '')
    if (celda) nombres[m[1]] = celda
  }
  return nombres
}

/** El texto escapado para XML. Un `&` o un `<` sin escapar rompe el archivo entero. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Escribe un valor en una celda de la hoja.
 *
 * SE CONSERVA EL ESTILO DE LA CELDA —el atributo `s`— y se reemplaza sólo el contenido. Es lo que
 * hace que la celda amarilla siga amarilla y el precio siga con su formato de dólares.
 *
 * **Un valor nulo deja la celda vacía**, no en cero. La diferencia importa: un cero se lee como «no
 * paga nada», y la hoja tiene que poder salir con los datos del cliente en blanco para que él los
 * llene cuando el vendedor ya no está.
 */
function escribirCelda(
  hoja: string,
  celda: string,
  valor: number | string | null,
  esTexto: boolean
): string {
  const patron = new RegExp(`<c r="${celda}"([^>]*?)(?:/>|>(.*?)</c>)`, 's')
  const encontrada = hoja.match(patron)
  if (!encontrada) {
    throw new Error(
      `La plantilla del comparador no tiene la celda ${celda}. No se generó el archivo para no mandarlo mal armado.`
    )
  }

  const atributos = encontrada[1] ?? ''
  const estilo = (atributos.match(/\bs="\d+"/) || [''])[0]

  if (valor === null || valor === '' || (typeof valor === 'number' && !Number.isFinite(valor))) {
    return hoja.replace(patron, `<c r="${celda}" ${estilo}/>`)
  }

  if (esTexto) {
    // `inlineStr` y no la tabla de cadenas compartidas: el texto viaja dentro de la celda, así que
    // no hay que tocar `sharedStrings.xml` ni recontar índices. Excel y Google Sheets lo leen igual.
    return hoja.replace(
      patron,
      `<c r="${celda}" ${estilo} t="inlineStr"><is><t xml:space="preserve">${escapar(String(valor))}</t></is></c>`
    )
  }

  return hoja.replace(patron, `<c r="${celda}" ${estilo} t="n"><v>${valor}</v></c>`)
}

/** «1 de septiembre de 2026», que es como se lee una fecha en una hoja que va a un cliente. */
function fechaLegible(fecha: Date): string {
  return fecha.toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Junta lo que haya, separado por puntos medios, y descarta lo vacío.
 *
 * **Un separador suelto delata que falta un dato.** «Ana Ruiz ·  · » en una hoja que va a un cliente
 * se lee como descuido, y este documento es lo único que la casa deja sobre la mesa.
 */
const renglon = (partes: (string | null | undefined)[]): string =>
  partes.map((p) => p?.trim()).filter((p): p is string => !!p).join(' · ')

/**
 * Quién entregó la hoja.
 *
 * **NO DICE «SU VENDEDOR».** Lo cortó el usuario el 2 de septiembre de 2026: *«todavía no somos sus
 * vendedores... todavía no le estamos vendiendo»*. La hoja se entrega en una visita a alguien que
 * todavía le compra a otro, y darse por su proveedor en el encabezado es empezar mintiendo.
 *
 * **Sin nombre no sale nada**, ni siquiera el rótulo: «Vendedor que le visita:» a secas es peor que
 * el silencio. Y si tiene nombre pero no teléfono sale igual — el nombre solo ya sirve para
 * preguntar por él.
 */
function renglonVendedor(vendedor: DatosDelComparador['vendedor']): string {
  const nombre = vendedor?.nombre?.trim()
  if (!nombre) return ''
  return `Vendedor que le visita: ${renglon([nombre, vendedor?.telefono])}`
}

/**
 * El renglón del encabezado: para quién es la hoja y de cuándo.
 *
 * **Sin esto, dos hojas de dos clientes distintos son indistinguibles a los tres días** — y el
 * seguimiento a tres días es la única señal que este módulo tiene.
 */
function textoEncabezado(datos: DatosDelComparador): string {
  const partes: string[] = []
  if (datos.nombreCliente?.trim()) partes.push(`Preparado para ${datos.nombreCliente.trim()}`)
  partes.push(fechaLegible(datos.fecha ?? new Date()))
  return partes.join(' · ')
}

/**
 * Arma el archivo del comparador.
 *
 * Devuelve un `Blob` listo para compartir con el botón nativo del celular, igual que la cotización.
 */
export async function generarComparador(datos: DatosDelComparador): Promise<Blob> {
  const respuesta = await fetch(RUTA_PLANTILLA)
  if (!respuesta.ok) {
    throw new Error('No se pudo abrir la plantilla del comparador.')
  }
  const zip = unzipSync(new Uint8Array(await respuesta.arrayBuffer()))

  const nombres = leerNombres(strFromU8(zip['xl/workbook.xml']))
  const faltantes = [...CELDAS_DE_VALOR, ...CELDAS_DE_TEXTO].filter((n) => !nombres[n])
  if (faltantes.length > 0) {
    throw new Error(
      `La plantilla del comparador perdió estos nombres de celda: ${faltantes.join(', ')}. ` +
        'No se generó el archivo para no escribir los números en el sitio equivocado.'
    )
  }

  let hoja = strFromU8(zip['xl/worksheets/sheet1.xml'])

  // NUESTROS DATOS SIEMPRE SE ESCRIBEN. La hoja nunca sale en blanco completo — es la primera regla
  // del documento de requerimientos.
  hoja = escribirCelda(hoja, nombres.NUESTRO_PRECIO_CAJA, datos.nuestro.precioCaja ?? null, false)
  hoja = escribirCelda(hoja, nombres.NUESTRO_ROLLOS_CAJA, datos.nuestro.rollosCaja ?? null, false)
  hoja = escribirCelda(hoja, nombres.NUESTRO_METROS_ROLLO, datos.nuestro.metrosRollo ?? null, false)
  // EL CALIBRE SÍ PUEDE IR VACÍO, a diferencia de los otros tres. Es declarativo: no entra en
  // ninguna fórmula, así que una celda en blanco no rompe nada. **Y una celda en blanco es
  // preferible a un calibre inventado** en una hoja que existe justamente para señalar que la
  // competencia rotula sin declarar la unidad.
  hoja = escribirCelda(hoja, nombres.NUESTRO_CALIBRE, datos.nuestro.calibre ?? null, false)

  // LOS DEL CLIENTE, O TODOS O NINGUNO. **Nunca mezclados**, y ésta es la decisión menos obvia de
  // este archivo:
  //
  //   · Si el cliente **no dijo nada**, la hoja sale con los valores de ejemplo que trae la
  //     plantilla — como pide el documento— y la nota de arriba sigue diciendo que son un ejemplo.
  //   · Si dijo **aunque sea un dato**, se escriben los cinco: los que dio con su número y los que
  //     no, vacíos.
  //
  // **Escribir sólo los que dio dejaría los otros con el valor de ejemplo**, y el cliente vería
  // «50 rollos por caja» junto a su precio real, presentado como suyo. Un dato inventado que se lee
  // como propio es peor que una celda vacía: la vacía se nota, el inventado no.
  const delCliente = {
    CLIENTE_PRECIO_CAJA: datos.cliente.precioCaja ?? null,
    CLIENTE_ROLLOS_CAJA: datos.cliente.rollosCaja ?? null,
    CLIENTE_METROS_ROLLO: datos.cliente.metrosRollo ?? null,
    CLIENTE_CAJAS_PEDIDO: datos.cliente.cajasPedido ?? null,
    CLIENTE_SEMANAS: datos.cliente.semanasEntrePedidos ?? null,
  }
  const dijoAlgo = Object.values(delCliente).some((v) => v !== null && Number.isFinite(v))

  if (dijoAlgo) {
    for (const [nombre, valor] of Object.entries(delCliente)) {
      hoja = escribirCelda(hoja, nombres[nombre], valor, false)
    }
  }

  hoja = escribirCelda(hoja, nombres.COMPARADOR_ENCABEZADO, textoEncabezado(datos), true)
  hoja = escribirCelda(hoja, nombres.COMPARADOR_VENDEDOR, renglonVendedor(datos.vendedor) || null, true)
  hoja = escribirCelda(
    hoja,
    nombres.COMPARADOR_NOTA_EJEMPLO,
    dijoAlgo ? NOTA_SON_SUYOS : NOTA_SON_EJEMPLO,
    true
  )

  zip['xl/worksheets/sheet1.xml'] = strToU8(hoja)

  return new Blob([zipSync(zip, { level: 6 }) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Cómo se llama el archivo que recibe el cliente.
 *
 * **Lleva el nombre del cliente adentro** porque va a caer en una carpeta de descargas junto a otros
 * archivos, y «comparador.xlsx» no se distingue de nada. Se limpian los caracteres que Windows no
 * admite en un nombre.
 */
export function nombreDelArchivo(nombreCliente?: string | null): string {
  const limpio = (nombreCliente ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-')
  return limpio ? `Comparación de costo — ${limpio}.xlsx` : 'Comparación de costo.xlsx'
}
