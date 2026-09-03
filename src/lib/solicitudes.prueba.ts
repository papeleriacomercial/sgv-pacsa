/**
 * Quién atiende cada solicitud — §7.2, oficina y administración.
 *
 * EL DEFECTO QUE ESTO CUIDA es de los que no se ven leyendo el código: la regla **existía desde el
 * primer día**, escrita en un comentario de la migración —*«pedido, cotización y muestra las atiende
 * administración; precio y condiciones, gerencia»*— y en una etiqueta que le decía al vendedor quién
 * iba a atenderlo. **Pero nadie la hacía cumplir.** La bandeja traía todo para todos, y el gerente
 * entraba a ver precios especiales y se encontraba con pedidos y cotizaciones.
 *
 * Ahora la regla es un dato, y el rótulo se deriva de ella. **Lo que estas pruebas impiden es que
 * vuelvan a ser dos cosas distintas**, que es exactamente como se separaron.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATIENDE,
  ROL_QUE_ATIENDE,
  TIPOS_SOLICITUD,
  esDeMiBandeja,
  type TipoSolicitud,
} from './catalogos.ts'

const TIPOS = Object.keys(TIPOS_SOLICITUD) as TipoSolicitud[]

test('la regla cubre todos los tipos, sin huecos', () => {
  for (const t of TIPOS) {
    assert.ok(ROL_QUE_ATIENDE[t], `${t} no dice quién lo atiende`)
  }
})

test('el rótulo sale de la regla, así que no puede contradecirla', () => {
  // Estaban escritos aparte, y así es como una regla y su etiqueta se separan sin que nadie lo note.
  assert.equal(ATIENDE.precio, 'Gerencia')
  assert.equal(ATIENDE.pedido, 'Administración')
  assert.equal(ATIENDE.cotizacion, 'Administración')
  assert.equal(ATIENDE.muestra, 'Administración')
})

test('el gerente ve precios y condiciones, no pedidos ni cotizaciones', () => {
  assert.equal(esDeMiBandeja('precio', 'gerente'), true)
  for (const ajeno of ['pedido', 'cotizacion', 'muestra'] as TipoSolicitud[]) {
    assert.equal(esDeMiBandeja(ajeno, 'gerente'), false, `${ajeno} no es del gerente`)
  }
})

test('administración ve pedidos, cotizaciones y muestras, no precios', () => {
  for (const suyo of ['pedido', 'cotizacion', 'muestra'] as TipoSolicitud[]) {
    assert.equal(esDeMiBandeja(suyo, 'administracion'), true, `${suyo} sí es de administración`)
  }
  assert.equal(esDeMiBandeja('precio', 'administracion'), false)
})

// EL LÍDER Y EL VENDEDOR NO TIENEN BANDEJA PROPIA: ven lo suyo por otras reglas, y esta separación
// no aplica. Esconderles algo aquí sería quitarles de la vista sus propias solicitudes.
test('a quien no tiene bandeja no se le esconde nada', () => {
  for (const rol of ['vendedor', 'lider', null, undefined]) {
    for (const t of TIPOS) {
      assert.equal(esDeMiBandeja(t, rol), true, `${rol} no debería perder ${t} de vista`)
    }
  }
})

test('cada tipo cae en una bandeja y sólo en una', () => {
  for (const t of TIPOS) {
    const enCuantas = ['gerente', 'administracion'].filter((r) => esDeMiBandeja(t, r)).length
    assert.equal(enCuantas, 1, `${t} cae en ${enCuantas} bandejas`)
  }
})
