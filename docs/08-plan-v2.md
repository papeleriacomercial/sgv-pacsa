# Plan v2 — Replanteamiento tras las primeras pantallas

**Fecha:** 2026-08-21

Después de usar las primeras pantallas, el negocio replanteó parte del alcance. Este
documento concilia los requerimientos nuevos con los originales de `00-vision.md`, mide el
impacto sobre lo ya construido, y reemplaza el plan de cinco tramos de `07-estado.md`.

**Los requerimientos originales no mencionados en el replanteamiento siguen vigentes.**
Están listados al final para que no se pierdan.

---

## 1. El cambio de fondo

El replanteamiento no agrega funciones sueltas: **cambia el sujeto del sistema.**

Hasta ahora el sistema giraba alrededor del **prospecto** — alguien a quien todavía no le
vendes. El vendedor lo trabajaba hasta ganarlo o perderlo, y ahí se acababa.

Ahora gira alrededor de la **cuenta**: un punto con el que tienes una relación, sea
prospecto o cliente, y que se sigue trabajando después de la primera venta. La venta deja
de ser el final y pasa a ser un cambio de estado.

Casi todo lo demás se deriva de eso: por qué "visita" pasa a "seguimiento", por qué el
pipeline necesita nombre y fecha de cierre, y por qué aparecen los reportes.

---

## 2. Conciliación con la visión original

### 2.1 Lo que cambia de nombre

| Antes | Ahora | Alcance del cambio |
|---|---|---|
| Prospectos | **Cuentas** | Tabla `prospectos` → `cuentas`, rutas, menú, textos |
| Registrar visita | **Registrar seguimiento** | Tabla `visitas` → `seguimientos`, pantalla, textos |
| Agenda | **Seguimientos** | Ruta y menú |
| Pipeline | **Oportunidades** | Ruta y menú, reubicado después de Cuentas |

No son cambios cosméticos. §17 exige que el sistema se llame por dentro como se llama por
fuera, y `02-modelo-datos.md` fija que la nomenclatura de la base es la misma de la
interfaz. Dejar la tabla `prospectos` sirviendo una pantalla llamada Cuentas rompe esa
regla y confunde a quien lea el código en seis meses.

**Se hace ahora porque hoy hay nueve filas de datos de prueba en toda la base.** Este
cambio nunca va a ser más barato.

### 2.2 Lo que entra en conflicto con la visión y hay que zanjar

Estos cuatro puntos no son ambigüedades de redacción: son contradicciones reales entre lo
acordado antes y lo pedido ahora. Cada uno necesita una decisión explícita.

#### A. Qué es un "cliente"

§2 y §4 de la visión dicen que **cliente** es un espejo de solo lectura traído de Zoho, y
que *"los clientes activos y su historial de compras viven en Zoho; toda la prospección
nace y vive en el CRM de campo"*.

El replanteamiento pide que el vendedor marque a mano una cuenta como cliente al cerrar la
primera venta. Son dos definiciones distintas de la misma palabra.

> **Propuesta.** `tipo_cuenta` es la marca del vendedor: *"a este ya le vendí"*. Zoho sigue
> siendo la verdad de la facturación. Cuando exista la integración, Zoho **confirma o
> corrige** la marca, no la reemplaza. Si un vendedor marca cliente y Zoho no tiene
> facturas, eso es un hallazgo, no un error a esconder.

#### B. Etapa de la cuenta contra tipo de cuenta

Hoy la cuenta tiene `etapa` — nuevo, contactado, cotizado, negociación, ganado, perdido — y
la oportunidad tiene su propia etapa igual.

Con `tipo_cuenta` y con oportunidades que ahora tienen nombre y fecha de cierre, **la etapa
de la cuenta queda sin trabajo claro**. Una cuenta con tres oportunidades en tres etapas
distintas, ¿en qué etapa está?

> **Propuesta.** La etapa vive **solo en la oportunidad**. La cuenta lleva `tipo_cuenta`
> (prospecto/cliente) y `volumen` (alta/media/baja). El motivo de pérdida y la fecha de
> recontacto se mudan también a la oportunidad, que es lo que de verdad se gana o se pierde.
>
> Es el cambio más profundo del replanteamiento y el que más código toca. También es el que
> vuelve coherente todo lo demás: se pierde una venta, no un local.

#### C. Volumen manual contra potencial calculado

§7.5 define un **puntaje de potencial de 1 a 5** calculado por el modelo de gemelos, desde
la facturación de Zoho. El replanteamiento pide un campo **Alta / Media / Baja** que llena
el vendedor.

> **Propuesta.** Conviven. `volumen` es el juicio del vendedor, disponible desde el día uno.
> `potencial` será el número calculado cuando exista §7.6. Comparar los dos es en sí mismo
> un dato: dónde el olfato del vendedor acierta y dónde no.

#### D. El color en el mapa

§17 fija que **el color significa estado**. El replanteamiento pide colorear los pines según
el filtro elegido: tipo de cuenta, vendedor, días sin contacto en gama de claro a oscuro.

> **Propuesta.** El mapa es la excepción, y se acota: **el color codifica la variable que el
> usuario eligió, y la leyenda es obligatoria y siempre visible.** Fuera del mapa, el color
> sigue significando estado. Sin leyenda, la vista no se muestra.

### 2.3 Catálogo abierto de categorías

El replanteamiento pide que al escribir una categoría nueva de comercio, quede guardada y
aparezca después en una lista desplegable.

Esto contradice D-004, que fijó todos los catálogos como enums cerrados. Y con razón:
**este catálogo es distinto**, porque crece con el uso y nadie puede enumerarlo por
adelantado.

> **Propuesta.** Tabla `categorias_comercio`, **global y no por vendedor**. Global porque
> §7.6 necesita que `tipo_comercio` sea comparable con la clasificación de Zoho, y un
> catálogo por usuario se fragmenta en tres versiones de "minisuper" la primera semana.
> Gerencia puede fusionar duplicados y desactivar los que sobren.

---

## 3. Lo que faltaba y el replanteamiento destapó

Tres huecos reales en lo ya construido, que no son requerimientos nuevos sino defectos:

1. **No se sabe si una cuenta quedó sin coordenadas.** `seguimientos` tiene `sin_gps`, pero
   la cuenta no. Una cuenta creada sin señal simplemente tiene el campo vacío y no hay forma
   de listarlas ni de arreglarlas.
2. **No hay manera de agregar coordenadas después.** Ni desde una visita posterior, ni
   señalando el punto en el mapa.
3. **No hay ubicación en texto.** Solo latitud y longitud, que no sirven para agrupar por
   poblado ni para leer de un vistazo dónde queda.

---

## 4. Impacto sobre lo construido

| Pieza | Impacto |
|---|---|
| `prospectos` (23 columnas) | Renombrar a `cuentas`, quitar etapa y motivo, agregar tipo, volumen, ubicación, marca de GPS |
| `visitas` (18 columnas) | Renombrar a `seguimientos`, agregar `oportunidad_id` |
| `compromisos` | Renombrar la llave foránea |
| `oportunidades` (14 columnas) | Agregar nombre, fecha estimada de cierre, motivo de pérdida, fecha de recontacto |
| `descartes`, `auditoria`, `perfiles` | Sin cambios |
| `buscar_duplicados`, `estado_de_puntos`, `auditar_prospecto` | Reescribir por los renombrados |
| 13 pantallas | Todas tocadas por el vocabulario; 6 cambian de fondo |
| Bucket de fotos `visitas` | **Se queda con ese nombre.** Renombrarlo obliga a mover los archivos y no aporta nada |

**Nada de esto se pierde.** Las políticas RLS, las restricciones verificadas, el semáforo,
los duplicados, el modo de captura y las pruebas siguen valiendo: cambian de nombre, no de
lógica.

---

## 5. Plan por etapas

### Etapa A — Vocabulario y modelo de cuentas

Renombrar `prospectos` → `cuentas` y `visitas` → `seguimientos`, con todas sus llaves,
funciones y pantallas. Agregar `tipo_cuenta` y mover la etapa a la oportunidad.

**Va primero por una razón de costo:** cada etapa posterior toca estas mismas tablas y
pantallas. Hacerlo después significa escribir dos veces el mismo código.

**Se ve al final:** lo mismo de hoy, con los nombres correctos y un campo Cliente/Prospecto.

### Etapa B — La cuenta completa

- Catálogo autoalimentado de categorías de comercio.
- Volumen de venta: alta, media, baja.
- Ubicación en texto —ciudad y dirección— sugerida desde las coordenadas y confirmada por
  el vendedor.
- Marca de cuenta sin coordenadas, y dos formas de arreglarlo: tomar la ubicación de un
  seguimiento nuevo, o señalar el punto en el mapa.
- Vista con días desde el último contacto y días hasta el próximo compromiso.

### Etapa C — Filtros y colorización

Un solo motor de filtros que sirve a la lista y al mapa: tipo de cuenta, categoría,
producto de interés, volumen, días sin contacto, próximos N días, sin clasificar, sin
ubicación, por reactivar, y por vendedor para líder y gerencia.

Colorización de los pines según el filtro elegido, con leyenda obligatoria, incluida la
gama de claro a oscuro para los rangos numéricos.

Aquí se absorben también los filtros que ya estaban pendientes de la lista y las dos piezas
de sucursales de §7.4.

### Etapa D — Seguimientos

Pantalla de Seguimientos con filtro por tipo de acción y por ventana de tiempo: vencidos,
hoy, próximos tres días, o rango elegido.

**El botón deja de marcar "ya lo hice" y pasa a registrar un seguimiento**, con la misma
captura que dentro de la cuenta, cerrando el compromiso actual y creando el siguiente.

### Etapa E — Oportunidades

- Nombre de la oportunidad y fecha estimada de cierre.
- Bitácora de avance: notas que se agregan encabezadas con fecha y hora, sin borrar las
  anteriores.
- Los seguimientos se pueden relacionar a una oportunidad y se listan debajo de la bitácora.
- **Una oportunidad con la fecha de cierre vencida no se puede modificar** hasta mover esa
  fecha hacia adelante.

### Etapa F — Ventas y reportes

- Pantalla temporal para capturar la venta mensual por vendedor de 2026.
- Reportes del mes vigente, desglosados por semana y por vendedor: cuentas nuevas,
  oportunidades nuevas con su monto estimado, cantidad de seguimientos por tipo,
  oportunidades abiertas con subtotal por línea de producto, y venta acumulada.
- El líder ve a sus vendedores; gerencia ve a los vendedores y al líder.

**Se hace antes de Zoho a propósito:** la pantalla temporal permite tener los reportes
funcionando y validados con datos reales mientras la integración se construye.

### Etapa G — Zoho

Lectura de las facturas de venta por vendedor, que reemplaza la captura manual de la
Etapa F.

**Es la primera pieza que necesita credenciales de servidor**, fuera del navegador. Hasta
hoy todo el sistema funciona con la llave pública y el RLS.

### Etapa H — Piloto y modo offline

El antiguo Tramo 5. Dos semanas con un vendedor real, y el endurecimiento del modo offline
con su cola de sincronización.

---

## 6. Requerimientos originales que siguen vigentes

No se mencionan en el replanteamiento y **permanecen en el plan**:

| Módulo | Estado |
|---|---|
| §7.2 Oficina: bandejas de cotización y alta de clientes | Pendiente |
| §7.3 Tablero de gerencia con "Requiere tu atención" | Parcial, lo cubre la Etapa F |
| §7.4 Búsqueda de prospectos | Construido; sucursales y filtros en la Etapa C |
| §7.5 Calificación y modelo de gemelos | Bloqueado por Zoho |
| §7.6 Inteligencia comercial | Bloqueado por la depuración de Zoho |
| §7.7 Reposición predictiva, muestras, competencia | Pendiente. La captura de competencia ya funciona |
| §7.8 Hilos de consulta anclados al registro | Pendiente |
| §7.9 Grupos comerciales | Pendiente |
| Solicitud de cotización con aprobación de precios | Pendiente |
| Lectura del SGP: estado y fecha de entrega | Pendiente |
| Validación de duplicados, descartes, auditoría | Construidos |
| Modo offline | Etapa H |

**El cuello de botella no cambió:** la depuración del maestro de clientes y productos de
Zoho sigue bloqueando §7.5, §7.6 y §7.7, y ahora también la Etapa G. No es programación.

---

## 7. Decisiones que hacen falta antes de la Etapa A

1. **¿La etapa se muda a la oportunidad?** (punto 2.2.B). Es el cambio más profundo y todo
   lo demás depende de él.
2. **¿`tipo_cuenta` lo marca el vendedor y Zoho lo confirma después?** (punto 2.2.A).
3. **¿Catálogo de categorías global, con gerencia depurando?** (punto 2.3).
4. **¿La regla de la oportunidad vencida es exactamente así?** Con la fecha pasada, lo único
   editable es la propia fecha; al moverla al futuro, se libera el resto.
