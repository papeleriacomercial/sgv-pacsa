/**
 * Correr un día calendario — §7.1, el reporte de actividad.
 *
 * EL DEFECTO QUE ESTO CUIDA no se ve leyendo el código y sólo aparece en algunos días del mes:
 * `new Date("2026-09-03")` es medianoche **UTC**, que en Panamá es todavía el 2 de septiembre a
 * las siete de la noche. Sumarle un día devuelve el 3 cuando se pedía el 4, y la flecha de
 * «siguiente» no avanza.
 *
 * Se prueba en los bordes, que es donde rompe: fin de mes, fin de año, y febrero de un año
 * bisiesto. **Un día cualquiera pasa aunque la función esté mal**, que es lo que la haría parecer
 * probada sin estarlo.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correrDias } from './fechas.ts'

test('avanza y retrocede un día normal', () => {
  assert.equal(correrDias('2026-09-03', 1), '2026-09-04')
  assert.equal(correrDias('2026-09-03', -1), '2026-09-02')
  assert.equal(correrDias('2026-09-03', 0), '2026-09-03')
})

test('cruza el fin de mes', () => {
  assert.equal(correrDias('2026-09-30', 1), '2026-10-01')
  assert.equal(correrDias('2026-10-01', -1), '2026-09-30')
})

test('cruza el fin de año', () => {
  assert.equal(correrDias('2026-12-31', 1), '2027-01-01')
  assert.equal(correrDias('2027-01-01', -1), '2026-12-31')
})

test('febrero: bisiesto y no bisiesto', () => {
  // 2028 es bisiesto; 2026 no.
  assert.equal(correrDias('2028-02-28', 1), '2028-02-29')
  assert.equal(correrDias('2026-02-28', 1), '2026-03-01')
})

// EL PRIMERO DEL MES ES EL QUE DELATA LA MEDIANOCHE UTC. Si la función parte del `T00:00:00` en
// vez del mediodía, retroceder desde el día 1 devuelve el mismo día 1 en una máquina al oeste de
// Greenwich, y el reporte se queda trabado sin decir por qué.
test('retroceder desde el primero del mes no se queda quieto', () => {
  for (const primero of ['2026-01-01', '2026-03-01', '2026-06-01', '2026-11-01']) {
    assert.notEqual(correrDias(primero, -1), primero, `${primero} no retrocedió`)
  }
})
