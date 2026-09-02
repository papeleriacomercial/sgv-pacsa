/**
 * Las cuentas del Comparador de Rendimiento — §7.10.
 *
 * **Viven acá y no dentro del generador del archivo**, y esa es la única decisión de fondo de este
 * módulo: la pantalla de la etapa 2 va a mostrar el resultado en vivo mientras el vendedor teclea, y
 * el archivo lo va a llevar en fórmulas. **Si las cuentas se escriben dos veces, un día la pantalla
 * dice una cosa y el archivo otra** — delante del cliente, que es el peor momento posible.
 *
 * LO QUE ESTE ARCHIVO NO HACE: no calcula nada para el `.xlsx`. La hoja lleva sus propias fórmulas
 * vivas, que es lo que permite que el cliente cambie un número y vea el resultado moverse. Acá se
 * calcula **lo mismo**, para la pantalla — y por eso los dos tienen que decir lo mismo.
 */

/** Lo que se sabe de un producto: el nuestro o el que el cliente compra hoy. */
export type DatosDeProducto = {
  /** Lo que cuesta una caja. */
  precioCaja: number | null
  /** Cuántos rollos trae la caja. */
  rollosCaja: number | null
  /** Cuántos metros de papel trae cada rollo. */
  metrosRollo: number | null
}

/**
 * Lo nuestro. **Es un producto, no sólo tres números**, y por eso lleva el calibre.
 *
 * EL CALIBRE NO ENTRA EN NINGUNA CUENTA: se declara. Y aun así es el dato que sostiene todo el
 * argumento — un papel de 48 gramos por metro cuadrado da más metros que uno de 55 en el mismo
 * diámetro de rollo, que es exactamente la razón por la que nuestra caja rinde más. Sin decirlo, la
 * hoja pide que le crean; diciéndolo, se puede comprobar.
 */
export type NuestraOferta = DatosDeProducto & {
  /** Gramos por metro cuadrado. Hoy se ofrecen 48 y 55. */
  calibre: number | null
}

/** Lo que el cliente quiso decir. **Ninguno es obligatorio**: ésa es la razón de ser del módulo. */
export type DatosDelCliente = DatosDeProducto & {
  /** Cuántas cajas compra en cada pedido. */
  cajasPedido: number | null
  /** Cada cuántas semanas repite el pedido. */
  semanasEntrePedidos: number | null
}

/** El resultado. **Cada campo es `null` cuando falta un dato para calcularlo**, nunca cero. */
export type Comparacion = {
  metrosPorCajaCliente: number | null
  metrosPorCajaNuestro: number | null
  costoPorMetroCliente: number | null
  costoPorMetroNuestro: number | null
  cajasEquivalentes: number | null
  /** Cuánto le duraría nuestro pedido, en semanas. Es una comprobación, no un argumento de venta. */
  semanasQueDura: number | null
  costoPedidoActual: number | null
  costoPedidoNuestro: number | null
  ahorroPorPedido: number | null
  pedidosAlAno: number | null
  metrosAlAno: number | null
  gastoAnoActual: number | null
  gastoAnoNuestro: number | null
  diferenciaAlAno: number | null
}

/**
 * Divide, y devuelve `null` si no se puede.
 *
 * **Toda división de este módulo pasa por acá.** Es la regla del documento de requerimientos —
 * *«toda división está protegida contra valores cero o vacíos»*— y no es una precaución teórica: el
 * cliente puede dar el precio y no los rollos, o los rollos y no los metros. **Un `Infinity` o un
 * `NaN` que llegue a la pantalla es un número sin sentido delante del comprador**, y en la hoja
 * sería un `#¡DIV/0!` que termina la conversación.
 */
function dividir(arriba: number | null, abajo: number | null): number | null {
  if (arriba === null || abajo === null) return null
  if (!Number.isFinite(arriba) || !Number.isFinite(abajo)) return null
  if (abajo === 0) return null
  return arriba / abajo
}

/** Multiplica, con la misma regla: si falta un dato, no hay resultado. */
function multiplicar(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return a * b
}

/** Resta, con la misma regla. */
function restar(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return a - b
}

/**
 * Las semanas del año que se usan para anualizar.
 *
 * **Cincuenta y dos, igual que la hoja.** Está acá como constante con nombre para que el día que
 * alguien decida usar otro número, se cambie en un sitio y se note que también hay que cambiarlo en
 * la plantilla.
 */
export const SEMANAS_DEL_ANO = 52

/**
 * Compara lo que el cliente compra hoy contra lo nuestro.
 *
 * **Un solo escenario: equiparar metros.** Se calcula cuántas cajas nuestras cubren exactamente los
 * mismos metros que el cliente consume hoy, en el mismo tiempo y con la misma frecuencia. **No hay
 * escenarios alternativos**, y es deliberado: ninguna cifra de la comparación puede salir más alta
 * que la del cliente, porque **un solo número mayor le da el argumento para cerrar la
 * conversación**.
 */
export function compararRendimiento(
  cliente: DatosDelCliente,
  nuestro: DatosDeProducto
): Comparacion {
  const metrosPorCajaCliente = multiplicar(cliente.rollosCaja, cliente.metrosRollo)
  const metrosPorCajaNuestro = multiplicar(nuestro.rollosCaja, nuestro.metrosRollo)

  const metrosDelPedido = multiplicar(cliente.cajasPedido, metrosPorCajaCliente)

  // SE REDONDEA HACIA ARRIBA PORQUE NO SE VENDEN CAJAS PARTIDAS. Y hacia arriba y no hacia el más
  // cercano: hacia abajo se le entregaría **menos papel del que consume**, que es exactamente lo
  // que la hoja promete no hacer.
  const equivalentesExactas = dividir(metrosDelPedido, metrosPorCajaNuestro)
  const cajasEquivalentes = equivalentesExactas === null ? null : Math.ceil(equivalentesExactas)

  const costoPedidoActual = multiplicar(cliente.cajasPedido, cliente.precioCaja)
  const costoPedidoNuestro = multiplicar(cajasEquivalentes, nuestro.precioCaja)

  const pedidosAlAno = dividir(SEMANAS_DEL_ANO, cliente.semanasEntrePedidos)

  return {
    metrosPorCajaCliente,
    metrosPorCajaNuestro,
    costoPorMetroCliente: dividir(cliente.precioCaja, metrosPorCajaCliente),
    costoPorMetroNuestro: dividir(nuestro.precioCaja, metrosPorCajaNuestro),
    cajasEquivalentes,
    // Cuánto dura lo que le proponemos, contra el ritmo al que consume hoy. Tiene que dar
    // prácticamente igual a sus semanas actuales: si se separan de forma notoria, **hay un dato mal
    // capturado**, y ésa es toda la utilidad de esta línea.
    semanasQueDura: dividir(
      multiplicar(cajasEquivalentes, metrosPorCajaNuestro),
      dividir(metrosDelPedido, cliente.semanasEntrePedidos)
    ),
    costoPedidoActual,
    costoPedidoNuestro,
    ahorroPorPedido: restar(costoPedidoActual, costoPedidoNuestro),
    pedidosAlAno,
    metrosAlAno: multiplicar(metrosDelPedido, pedidosAlAno),
    gastoAnoActual: multiplicar(costoPedidoActual, pedidosAlAno),
    gastoAnoNuestro: multiplicar(costoPedidoNuestro, pedidosAlAno),
    diferenciaAlAno: restar(
      multiplicar(costoPedidoActual, pedidosAlAno),
      multiplicar(costoPedidoNuestro, pedidosAlAno)
    ),
  }
}
