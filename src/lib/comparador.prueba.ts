/**
 * Las cuentas del Comparador — §7.10.
 *
 * SE PRUEBA ESTO Y NO OTRA COSA porque acá se calcula dinero que un vendedor le enseña a un cliente
 * en la pantalla del celular. Un número mal en esta pantalla no da error: da una cifra creíble y
 * equivocada, dicha en voz alta delante del comprador.
 *
 * Los números del primer caso están calculados a mano y dan redondos a propósito: una prueba cuyo
 * resultado esperado salió del propio código no prueba nada.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compararRendimiento, SEMANAS_DEL_ANO } from './comparador.ts'

const casi = (obtenido: number | null, esperado: number, que: string) => {
  assert.notEqual(obtenido, null, `${que}: salió vacío`)
  assert.ok(Math.abs((obtenido as number) - esperado) < 1e-9, `${que}: ${obtenido} ≠ ${esperado}`)
}

const CLIENTE = {
  precioCaja: 30,
  rollosCaja: 50,
  metrosRollo: 45,
  cajasPedido: 100,
  semanasEntrePedidos: 8,
}
const NUESTRO = { precioCaja: 36, rollosCaja: 50, metrosRollo: 60 }

test('con todos los datos, las cifras salen como se calculan a mano', () => {
  const r = compararRendimiento(CLIENTE, NUESTRO)

  casi(r.metrosPorCajaCliente, 2250, 'metros por caja del cliente') // 50 × 45
  casi(r.metrosPorCajaNuestro, 3000, 'metros por caja nuestros') //    50 × 60
  casi(r.costoPorMetroCliente, 30 / 2250, 'costo por metro del cliente')
  casi(r.costoPorMetroNuestro, 0.012, 'costo por metro nuestro') //    36 ÷ 3000

  casi(r.cajasEquivalentes, 75, 'cajas equivalentes') //               225 000 ÷ 3000
  casi(r.costoPedidoActual, 3000, 'lo que paga hoy') //                100 × 30
  casi(r.costoPedidoNuestro, 2700, 'lo que pagaría') //                 75 × 36
  casi(r.ahorroPorPedido, 300, 'ahorro por pedido')

  casi(r.pedidosAlAno, 6.5, 'pedidos al año') //                        52 ÷ 8
  casi(r.metrosAlAno, 1_462_500, 'metros al año')
  casi(r.gastoAnoActual, 19_500, 'gasto al año como compra hoy')
  casi(r.gastoAnoNuestro, 17_550, 'gasto al año con nosotros')
  casi(r.diferenciaAlAno, 1_950, 'diferencia al año')
})

test('la duración propuesta coincide con la actual cuando los datos cuadran', () => {
  // Es la comprobación del anexo: si estas dos se separan, hay un dato mal capturado. La pantalla
  // la usa para avisar antes de que la hoja salga.
  const r = compararRendimiento(CLIENTE, NUESTRO)
  casi(r.semanasQueDura, CLIENTE.semanasEntrePedidos, 'semanas que dura')
})

test('las cajas se redondean hacia arriba, nunca hacia abajo', () => {
  // HACIA ABAJO SE LE ENTREGARÍA MENOS PAPEL DEL QUE CONSUME, que es justo lo que la hoja promete
  // no hacer. 101 × 2250 ÷ 3000 = 75,75.
  const r = compararRendimiento({ ...CLIENTE, cajasPedido: 101 }, NUESTRO)
  assert.equal(r.cajasEquivalentes, 76)
})

test('un dato que falta deja el resultado vacío, no en cero', () => {
  // Un cero se lee como «no paga nada». La hoja tiene que poder salir a medio llenar.
  const r = compararRendimiento({ ...CLIENTE, precioCaja: null }, NUESTRO)
  assert.equal(r.costoPorMetroCliente, null)
  assert.equal(r.costoPedidoActual, null)
  assert.equal(r.gastoAnoActual, null)
  assert.equal(r.diferenciaAlAno, null)
  // Y lo que no dependía de ese dato sigue saliendo.
  casi(r.costoPorMetroNuestro, 0.012, 'costo por metro nuestro')
  casi(r.cajasEquivalentes, 75, 'cajas equivalentes')
})

test('un cero en el divisor no produce infinito ni NaN', () => {
  // EL FALLO QUE ESTA PRUEBA CUIDA es visible: un «∞» o un «NaN» en la pantalla, delante del
  // comprador. Cero rollos por caja es un dato que un cliente puede dictar por error.
  for (const roto of [
    { ...CLIENTE, rollosCaja: 0 },
    { ...CLIENTE, metrosRollo: 0 },
    { ...CLIENTE, semanasEntrePedidos: 0 },
  ]) {
    const r = compararRendimiento(roto, NUESTRO)
    for (const [campo, valor] of Object.entries(r)) {
      assert.ok(
        valor === null || Number.isFinite(valor),
        `${campo} salió ${valor} con ${JSON.stringify(roto)}`
      )
    }
  }
})

test('sin ningún dato del cliente, nada se inventa', () => {
  const vacio = {
    precioCaja: null,
    rollosCaja: null,
    metrosRollo: null,
    cajasPedido: null,
    semanasEntrePedidos: null,
  }
  const r = compararRendimiento(vacio, NUESTRO)
  assert.equal(r.costoPorMetroCliente, null)
  assert.equal(r.cajasEquivalentes, null)
  assert.equal(r.diferenciaAlAno, null)
  // Lo nuestro sí se puede calcular: es lo único que la hoja garantiza.
  casi(r.metrosPorCajaNuestro, 3000, 'metros por caja nuestros')
})

test('el año son las mismas 52 semanas que usa la plantilla', () => {
  // Si algún día se cambia acá y no en el Excel, la pantalla y el archivo dirían cosas distintas
  // delante del cliente. Esta prueba es el recordatorio de que son dos sitios.
  assert.equal(SEMANAS_DEL_ANO, 52)
})
