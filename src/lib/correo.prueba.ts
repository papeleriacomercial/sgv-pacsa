/**
 * El correo que se le deja escrito al vendedor — §7.2, oficina y administración.
 *
 * EL DEFECTO QUE ESTO CUIDA no se ve leyendo el código, porque el correo lo arma la aplicación y
 * lo revisa un humano en su Gmail **después** de que la pantalla ya cambió. Si el destinatario
 * sale mal, nadie se entera hasta que la oficina reclama que no le llegó nada — y para entonces
 * el vendedor jura que lo mandó, y tiene razón.
 *
 * Desde D-071 estas direcciones son el único camino por el que la oficina se entera de un
 * encargo: no hay bandeja donde encontrarlo si el correo va al lugar equivocado.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CORREO_DESTINO,
  correoDeDocumento,
  correoDeSolicitud,
  enlaceGmail,
  enlaceMailto,
  type DestinoCorreo,
} from './correo.ts'

const CUENTA = {
  nombre: 'Almacen La Fiesta',
  ruc: '8-123-4567',
  corregimiento: 'Aguadulce',
  contactoNombre: 'María Pérez',
  contactoTelefono: '6123-4567',
  url: 'https://sgv-pacsa.vercel.app/cuentas/abc',
}

const cuerpoDe = (c: { cuerpo: string }) => c.cuerpo
const paraDe = (c: { para: string }) => c.para

test('cada clase de encargo tiene su dirección, y ninguna se repite por error', () => {
  const tipos: DestinoCorreo[] = [
    'cotizacion',
    'muestra',
    'pedido',
    'orden_venta',
    'precio',
  ]

  for (const t of tipos) {
    assert.match(CORREO_DESTINO[t], /^[^@\s]+@[^@\s]+\.[a-z]+$/, `${t} no tiene dirección válida`)
  }

  // Las muestras van con las cotizaciones **a propósito**: las atiende la misma persona.
  assert.equal(CORREO_DESTINO.muestra, CORREO_DESTINO.cotizacion)
  assert.equal(CORREO_DESTINO.orden_venta, CORREO_DESTINO.pedido)

  // Pero cotizaciones, órdenes y precios son tres buzones distintos. Si dos se igualaran, la
  // asistente empezaría a recibir precios especiales que son de gerencia.
  const buzones = new Set([
    CORREO_DESTINO.cotizacion,
    CORREO_DESTINO.pedido,
    CORREO_DESTINO.precio,
  ])
  assert.equal(buzones.size, 3, 'dos clases de encargo cayeron en el mismo buzón')
})

test('una muestra viaja al buzón de cotizaciones, con lo que la oficina necesita', () => {
  const d = correoDeSolicitud({
    tipo: 'muestra',
    rotulo: 'Muestra',
    cuenta: CUENTA,
    vendedor: 'Albert Batista',
    detalle: 'Dos resmas de bond para que las pruebe.',
    monto: null,
    paraCuando: null,
  })

  assert.equal(paraDe(d), 'papeleriacomercial.cotizaciones@gmail.com')

  const cuerpo = cuerpoDe(d)
  for (const dato of ['Almacen La Fiesta', '8-123-4567', 'María Pérez', 'Albert Batista']) {
    assert.ok(cuerpo.includes(dato), `falta «${dato}» en el cuerpo`)
  }
  assert.ok(cuerpo.includes('Dos resmas de bond'), 'no viajó lo que pidió el vendedor')
})

test('un precio especial va a gerencia, no a la oficina', () => {
  const d = correoDeSolicitud({
    tipo: 'precio',
    rotulo: 'Precio o condición especial',
    cuenta: CUENTA,
    vendedor: 'Albert Batista',
    detalle: 'Pide 10% por volumen.',
  })

  assert.equal(paraDe(d), 'papeleriacomercial@gmail.com')
  assert.notEqual(paraDe(d), CORREO_DESTINO.cotizacion)
})

test('el documento lleva el enlace al PDF, que es lo único que no puede faltar', () => {
  const d = correoDeDocumento({
    tipo: 'cotizacion',
    rotulo: 'Cotización',
    codigo: 'COT-0142',
    cuenta: CUENTA,
    vendedor: 'Albert Batista',
    renglones: [
      { cantidad: 20, unidad: 'cajas', nombre: 'Papel bond 8½×11' },
      { cantidad: 6, unidad: 'resmas', nombre: 'Papel carta de color' },
    ],
    total: 480,
    condicion: 'Contado',
    notas: 'Pregunta si hay descuento por volumen.',
    enlace: 'https://ejemplo.supabase.co/firmado/COT-0142.pdf',
  })

  const cuerpo = cuerpoDe(d)
  assert.equal(paraDe(d), 'papeleriacomercial.cotizaciones@gmail.com')
  assert.ok(cuerpo.includes('https://ejemplo.supabase.co/firmado/COT-0142.pdf'))
  assert.ok(cuerpo.includes('Papel bond'), 'no viajaron los renglones')
  assert.ok(cuerpo.includes('descuento por volumen'), 'no viajó la nota del vendedor')
  assert.ok(cuerpo.includes('480'), 'no viajó el total')
})

test('sin enlace el correo sale igual, diciendo dónde está el documento', () => {
  const d = correoDeDocumento({
    tipo: 'orden_venta',
    rotulo: 'Orden de venta',
    codigo: 'ORD-0007',
    cuenta: CUENTA,
    vendedor: 'Albert Batista',
    renglones: [{ cantidad: 1, unidad: 'und', nombre: 'Engrapadora' }],
    total: 12,
    enlace: null,
  })

  assert.equal(paraDe(d), 'papeleriacomercial.ordenes@gmail.com')
  assert.ok(cuerpoDe(d).includes('expediente'), 'no dice dónde encontrar el documento')
})

test('un pedido de veinte renglones no revienta el largo del correo', () => {
  // EL DEFECTO QUE ESTO CUIDA: `mailto` se corta solo, **en silencio**, alrededor de los dos mil
  // caracteres. Un pedido largo llegaría mutilado sin que nadie lo note — y lo que se pierde es
  // el final, que es donde va el enlace al documento.
  const muchos = Array.from({ length: 20 }, (_, i) => ({
    cantidad: i + 1,
    unidad: 'cajas',
    nombre: `Producto de nombre bastante largo para llenar el cuerpo número ${i + 1}`,
  }))

  const d = correoDeDocumento({
    tipo: 'cotizacion',
    rotulo: 'Cotización',
    codigo: 'COT-0200',
    cuenta: CUENTA,
    vendedor: 'Albert Batista',
    renglones: muchos,
    total: 3200,
    enlace: 'https://ejemplo.supabase.co/firmado/COT-0200.pdf',
  })

  const cuerpo = cuerpoDe(d)
  assert.ok(cuerpo.length <= 1600, `el cuerpo quedó en ${cuerpo.length} caracteres`)
  assert.ok(cuerpo.includes('20 renglones'), 'no avisa que el detalle está en el documento')
  // Lo que jamás puede perderse al recortar.
  assert.ok(cuerpo.includes('COT-0200.pdf'), 'se perdió el enlace al recortar')
  assert.ok(cuerpo.includes('3,200') || cuerpo.includes('3200'), 'se perdió el total')
})

test('el correo se puede abrir en Gmail o en el de omisión, y los dos llevan lo mismo', () => {
  // EL DEFECTO QUE ESTO CUIDA es el que pasó de verdad: un iPhone con Apple Mail por omisión
  // mandó una cotización desde una cuenta de iCloud personal. Ahora se intenta Gmail primero, y
  // si esa dirección saliera mal construida el vendedor no vería nada al tocar el botón —ni
  // error ni correo— porque un esquema desconocido falla en silencio.
  const c = correoDeSolicitud({
    tipo: 'muestra',
    rotulo: 'Muestra',
    cuenta: CUENTA,
    vendedor: 'Albert Batista',
    detalle: 'Dos resmas, a ver si le sirven.',
  })

  const gmail = enlaceGmail(c)
  const omision = enlaceMailto(c)

  assert.ok(gmail.startsWith('googlegmail:///co?to='), 'el esquema de Gmail está mal formado')
  assert.ok(omision.startsWith('mailto:papeleriacomercial.cotizaciones@gmail.com?'))

  // Los dos caminos tienen que llevar al mismo sitio y decir lo mismo. Si se separan, el correo
  // dependería de qué aplicación abrió el teléfono, que es exactamente lo que no puede pasar.
  for (const enlace of [gmail, omision]) {
    const d = decodeURIComponent(enlace)
    assert.ok(d.includes('papeleriacomercial.cotizaciones@gmail.com'), 'destinatario distinto')
    assert.ok(d.includes('Dos resmas'), 'cuerpo distinto')
    assert.ok(d.includes('Almacen La Fiesta'), 'cliente distinto')
  }
})

test('el correo dice los tres niveles, no sólo el corregimiento', () => {
  // EL CASO REAL QUE LO DESTAPÓ: el correo decía «Dónde: Carlos Santana Ávila» y nada más.
  // Es un corregimiento de Santiago con nombre de persona, así que a quien lo recibe no le ubica
  // nada — y el expediente sí mostraba los tres niveles. Lo cazó el usuario leyendo un correo
  // que ya había llegado a la oficina.
  const lejos = correoDeSolicitud({
    tipo: 'muestra',
    rotulo: 'Muestra',
    cuenta: {
      nombre: 'mini centro gloria',
      corregimiento: 'Carlos Santana Ávila',
      distrito: 'Santiago',
      provincia: 'Veraguas',
    },
    vendedor: 'Albert Batista',
    detalle: 'Una caja de rollos.',
  })

  assert.ok(
    cuerpoDe(lejos).includes('Dónde: Carlos Santana Ávila · Santiago, Veraguas'),
    'el cuerpo no lleva el distrito y la provincia',
  )

  // **El asunto lleva el distrito y no el corregimiento**, porque se lee de reojo en la bandeja:
  // «Santiago» lo ubica cualquiera.
  assert.ok(lejos.asunto.includes('(Santiago)'), 'el asunto no ayuda a ubicar de un vistazo')

  // Y cuando el corregimiento se llama igual que su distrito, no se repite.
  const cerca = correoDeSolicitud({
    tipo: 'muestra',
    rotulo: 'Muestra',
    cuenta: {
      nombre: 'Almacen La Fiesta',
      corregimiento: 'Aguadulce',
      distrito: 'Aguadulce',
      provincia: 'Coclé',
    },
    vendedor: 'Albert Batista',
    detalle: 'Dos resmas.',
  })

  assert.ok(cuerpoDe(cerca).includes('Dónde: Aguadulce, Coclé'))
  assert.ok(!cuerpoDe(cerca).includes('Aguadulce · Aguadulce'), 'repitió el nombre')
})
