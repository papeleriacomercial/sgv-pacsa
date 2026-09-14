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
 *
 * **Desde D-071 ya no hay bandejas:** la oficina y gerencia reciben los encargos por correo, y el
 * enrutamiento vive en `CORREO_DESTINO`, con sus propias pruebas. Por eso se borraron las cuatro
 * pruebas que repartían solicitudes entre bandejas, junto con `esDeMiBandeja()`.
 *
 * Lo que sobrevive es lo que sigue siendo verdad: el formulario le dice al vendedor quién va a
 * atenderlo, y eso tiene que salir de la regla en vez de escribirse aparte.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATIENDE,
  ROL_QUE_ATIENDE,
  TIPOS_SOLICITUD,
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
