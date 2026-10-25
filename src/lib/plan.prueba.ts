/**
 * Las reglas del plan diario — docs/18-plan-diario.md.
 *
 * LO QUE ESTAS PRUEBAS CUIDAN son dos cosas que no se ven leyendo el código y que, si se rompen, no
 * dan ningún error:
 *
 * **1. Que reparto y cobro sigan devolviendo nulo y no cero.** No hay tabla que registre una entrega
 * ni un cobro. El día que alguien «arregle» `avanceDe` para que devuelva 0 en vez de nulo —porque un
 * nulo incomoda al escribir la pantalla— el vendedor va a ver «0/3» toda la tarde sobre un reparto
 * que sí hizo, y gerencia lo va a leer como que no trabajó. Es el mismo defecto que el proyecto
 * hermano lleva contado siete veces: un cero que parece un dato.
 *
 * **2. Que una meta incumplida no se pueda cerrar sin motivo.** Es lo único que el cierre exige, y es
 * la razón de ser del rediseño: el cierre semanal pedía tres párrafos de texto libre y terminó lleno
 * de frases puestas por salir del paso —*«yo estaba agarrando eso de poner cualquier frase ahí»*, el
 * usuario—. Un catálogo cerrado se puede contar; una caja de texto, no. Si esta validación se afloja,
 * volvemos ahí sin que nada falle.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  avanceDe,
  faltaDeLaRendicion,
  loQueQuedaDebiendo,
  type AvanceDeHoy,
} from './plan.ts'

const AVANCE: AvanceDeHoy = {
  llamadas: 7,
  visitas: 4,
  cotizaciones: 2,
  seguimientosPendientes: 1,
  seguimientosDespachados: 5,
}

// ---------------------------------------------------------------------------
// Lo que el sistema puede contar solo
// ---------------------------------------------------------------------------

test('lo que deja rastro se cuenta solo', () => {
  assert.equal(avanceDe('llamar_frio', AVANCE), 7)
  assert.equal(avanceDe('visitar', AVANCE), 4)
  assert.equal(avanceDe('entregar_cotizacion', AVANCE), 2)
})

test('el reparto y el cobro devuelven NULO, nunca cero', () => {
  // Si esto empieza a dar 0, la pantalla va a decir «0/3» sobre un trabajo
  // hecho y nadie va a entender por qué. Nulo se dibuja como «—».
  assert.equal(avanceDe('reparto', AVANCE), null)
  assert.equal(avanceDe('cobrar', AVANCE), null)
})

test('un día sin nada hecho da cero y no nulo, que son cosas distintas', () => {
  const enBlanco: AvanceDeHoy = {
    llamadas: 0,
    visitas: 0,
    cotizaciones: 0,
    seguimientosPendientes: 0,
    seguimientosDespachados: 0,
  }
  // Acá el cero SÍ es un dato: hay tabla, se miró, y no hubo ninguna.
  assert.equal(avanceDe('visitar', enBlanco), 0)
  assert.equal(avanceDe('reparto', enBlanco), null)
})

// ---------------------------------------------------------------------------
// Qué se puede cerrar y qué no
// ---------------------------------------------------------------------------

test('una meta cumplida se cierra sin explicar nada', () => {
  assert.equal(
    faltaDeLaRendicion({ hizo: '10', motivo: null, motivoOtro: '' }, 10),
    null,
  )
  // Pasarse de la meta también está cumplido.
  assert.equal(
    faltaDeLaRendicion({ hizo: '14', motivo: null, motivoOtro: '' }, 10),
    null,
  )
})

test('una meta incumplida sin motivo no cierra', () => {
  const falta = faltaDeLaRendicion(
    { hizo: '4', motivo: null, motivoOtro: '' },
    10,
  )
  assert.equal(falta, 'Falta decir qué pasó.')
})

test('«otra cosa» obliga a escribir qué fue', () => {
  assert.equal(
    faltaDeLaRendicion({ hizo: '4', motivo: 'otra_cosa', motivoOtro: '' }, 10),
    'Escribe qué fue lo que pasó.',
  )
  assert.equal(
    faltaDeLaRendicion(
      { hizo: '4', motivo: 'otra_cosa', motivoOtro: '  ' },
      10,
    ),
    'Escribe qué fue lo que pasó.',
    'un texto de espacios no es una explicación',
  )
  assert.equal(
    faltaDeLaRendicion(
      { hizo: '4', motivo: 'otra_cosa', motivoOtro: 'Se dañó el portón' },
      10,
    ),
    null,
  )
})

test('un motivo del catálogo no pide texto', () => {
  assert.equal(
    faltaDeLaRendicion(
      { hizo: '4', motivo: 'falto_tiempo', motivoOtro: '' },
      10,
    ),
    null,
  )
})

test('sin número no se cierra, y cero sí es un número', () => {
  assert.equal(
    faltaDeLaRendicion({ hizo: '', motivo: null, motivoOtro: '' }, 5),
    'Falta decir cuántas hiciste.',
  )
  assert.equal(
    faltaDeLaRendicion({ hizo: '   ', motivo: null, motivoOtro: '' }, 5),
    'Falta decir cuántas hiciste.',
  )
  assert.equal(
    faltaDeLaRendicion({ hizo: 'tres', motivo: null, motivoOtro: '' }, 5),
    'Lo que hiciste tiene que ser un número.',
  )
  // Cero con su motivo es una rendición legítima: el día se fue en otra cosa.
  assert.equal(
    faltaDeLaRendicion(
      { hizo: '0', motivo: 'se_alargo_una_visita', motivoOtro: '' },
      5,
    ),
    null,
  )
})

test('una rendición que no llegó se trata como incompleta', () => {
  assert.equal(
    faltaDeLaRendicion(undefined, 5),
    'Falta decir cuántas hiciste.',
  )
})

// ---------------------------------------------------------------------------
// El arrastre
// ---------------------------------------------------------------------------

test('lo que queda debiendo nunca es negativo', () => {
  assert.equal(loQueQuedaDebiendo(10, 4), 6)
  assert.equal(loQueQuedaDebiendo(10, 10), 0)
  // Un día bueno no regala el siguiente.
  assert.equal(loQueQuedaDebiendo(10, 15), 0)
})
