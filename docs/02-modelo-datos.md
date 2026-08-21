# Modelo de datos

Esquema, convenciones y diccionario de campos. Las políticas de acceso de cada tabla están
en `03-seguridad-rls.md`; se diseñan al mismo tiempo que la tabla, nunca después.

Este documento especifica. Las migraciones que lo implementan se escriben en el Tramo 3.

---

## Convenciones (§16)

- `snake_case` en tablas y columnas. **Plural** en tablas. Nomenclatura en **español**.
- **IDs UUID generados en el cliente.** El celular debe poder crear registros sin conexión.
- Toda tabla lleva `created_at`, `updated_at`, `created_by` y `deleted_at`.
- **Borrado lógico** con `deleted_at`. Nunca borrado físico.
- Fechas en `timestamptz`, almacenadas en UTC y presentadas en `America/Panama`.
- Montos en `numeric(12,2)`, en USD.
- **RLS activado en la misma migración que crea la tabla.**
- Trigger `tocar_updated_at()` en toda tabla.

---

## Catálogos

Se implementan como **tipos enum**, no como tablas de catálogo. Son catálogos cerrados: que
agregar una opción exija una migración versionada es la garantía de que nadie los cambia
desde el dashboard. El costo es que un cambio requiere despliegue; se acepta a propósito
(ver D-004 en `06-decisiones.md`).

### `rol_usuario`

Ya existe. `gerente` · `lider` · `vendedor` · `administracion`.

### `etapa_prospecto`

```
nuevo · contactado · cotizado · negociacion · ganado · perdido
```

**`negociacion` es deliberadamente una etapa ancha.** Adentro caben la espera de aprobación
de gerencia, la prueba de producto para validar calidad, y la negociación de volumen y
precio. No se subdivide: el detalle de qué está pasando lo dan la bitácora de visitas y el
compromiso vigente, que es donde el vendedor ya escribe de todos modos.

La consecuencia es que la etapa por sí sola no dice si un prospecto está avanzando o
atascado. Eso se responde con dos datos: `etapa_desde` y el compromiso vencido.

### `resultado_visita`

Nueve opciones. Definidas con el negocio; cubren el 90% de los casos con un solo toque.

| Valor | Etiqueta en la interfaz | Recontacto |
|---|---|---|
| `no_estaba_encargado` | No estaba el encargado | |
| `pide_cotizacion` | Interesado, pide cotización | |
| `pide_muestra` | Interesado, pide muestra | |
| `stock_suficiente` | Interesado pero mantiene stock suficiente | **Sí** |
| `quiere_precio` | Tiene proveedor, quiere precio | |
| `no_usa_productos` | No usa nuestros productos | |
| `sin_interes` | Sin interés | |
| `local_cerrado` | Local cerrado o no existe | |
| `dejo_informacion` | Solo dejé información | |

`no_usa_productos` y `sin_interes` son distintos a propósito: el primero es un local que
nunca va a comprar esta categoría; el segundo, uno que podría y hoy dijo que no. Juntarlos
borraría la mitad de los prospectos reactivables.

`local_cerrado` alimenta la higiene de datos de §7.4: la corrección queda visible para todo
el equipo.

### `motivo_perdida`

Cinco opciones, con tres tratamientos distintos.

| Valor | Etiqueta en la interfaz | Tratamiento |
|---|---|---|
| `precio` | Precio o mejor oferta de la competencia | Reintentar, con fecha |
| `espera_licitacion` | Esperar fecha de licitación | Reintentar, con fecha |
| `no_cumple_especificaciones` | Producto no cumple especificaciones | Descartado |
| `sin_interes_real` | Sin interés real | Descartado |
| `no_contactar` | No volver a contactar | Excluido de listas |

Los dos primeros son la mejor lista de reactivación futura (§6). `espera_licitacion` es el
caso más caro de perder por descuido: es una venta ya ganada a medias que se cae solo por
no volver el día correcto.

`no_contactar` excluye el registro de toda lista de trabajo, incluidas las de reactivación.

### `tipo_interaccion`

```
visita · llamada · whatsapp · correo · entrega_muestra
```

Solo `visita` exige check-in GPS.

### `origen_prospecto`

```
calle · busqueda · referido · llamada_entrante · otro
```

> **Propuesta, pendiente de confirmar.** §4 pide el campo pero no fija los valores.
> `busqueda` es el que produce el módulo §7.4.

### `linea_producto`

```
rollos_fiscales · bolsas_papel · papel_antigrasa · tubos_carton · otros
```

Sale de §4 y §7.6. **Debe coincidir con la línea de producto que se asigne a cada SKU en
Zoho** durante la depuración de §7.6; si no coinciden, el cruce cliente × línea no se puede
hacer.

---

## El comportamiento "reintentar con fecha"

Aparece en tres lugares —`stock_suficiente`, `precio` y `espera_licitacion`— y en los tres
significa lo mismo: este punto vuelve a la lista de trabajo en una fecha concreta.

No se modela como texto libre ni como campo opcional. Un campo opcional se olvida.

**Dónde se obliga cada uno:**

- `precio` y `espera_licitacion` viven en `prospectos`, junto a `fecha_recontacto`. Ahí lo
  obliga la base con un `check`: sin fecha, el registro no se guarda. Verificado.
- `stock_suficiente` es un resultado de visita, y la fecha del próximo paso vive en
  `compromisos`, otra tabla. Un `check` no puede mirar otra tabla, así que **esa lo obliga
  la interfaz**, no la base. Se documenta la diferencia en vez de dar por hecho que la base
  cubre las dos.

No se cerró con un trigger que exigiera el compromiso porque §6 pide un próximo paso en
*toda* visita, y esa regla es justamente una de las que hay que validar en el piloto: forzar
un próximo paso cuando el local está cerrado no tiene sentido. Endurecer en la base algo que
se sospecha mal obliga a una migración para corregirlo.

---

## Tablas

### `perfiles` — ya existe

Creada en la migración `20260819224500_perfiles_y_roles`. Ver `03-seguridad-rls.md`.

Pendiente de decidir: si lleva `created_by` (§16 lo exige en todas las tablas, pero el
perfil nace del registro del propio usuario) y cómo se da de alta.

### `prospectos`

El expediente del punto. Dueño del dato: este sistema, no Zoho.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | Generado en el cliente |
| `nombre` | text not null | |
| `ruc` | text | Se captura cuando aparece. Obligatorio antes de facturar, y una de las señales de duplicado (§6) |
| `tipo_comercio` | text | Debe alinearse con la clasificación de Zoho (§7.6) |
| `contacto_nombre` | text | |
| `contacto_telefono` | text | |
| `contacto_whatsapp` | text | |
| `contacto_correo` | text | |
| `lat` / `lng` | numeric | GPS capturado por el vendedor: **dato propio**, sin límite de retención |
| `place_id` | text | Llave silenciosa de Google. Lo único de Places que se guarda indefinidamente |
| `productos_interes` | `linea_producto[]` | |
| `vendedor_id` | uuid not null → `perfiles` | |
| `etapa` | `etapa_prospecto` not null default `nuevo` | |
| `etapa_desde` | timestamptz not null default now() | Se actualiza en cada cambio de etapa |
| `origen` | `origen_prospecto` not null | |
| `motivo_perdida` | `motivo_perdida` | Solo cuando `etapa = perdido` |
| `fecha_recontacto` | date | Obligatoria si el motivo pide reintentar |
| `notas` | text | |
| `created_at` `updated_at` `created_by` `deleted_at` | | |

**Restricciones en la base:**

- `motivo_perdida` es obligatorio si y solo si `etapa = 'perdido'`.
- Si `motivo_perdida` está en (`precio`, `espera_licitacion`), `fecha_recontacto` no puede
  ser nula.
- `place_id` único entre los registros vivos, para no duplicar el mismo local.

**Sobre las coordenadas.** Las que captura el vendedor en el check-in son dato propio y se
guardan sin límite. Las que devuelve Google Places en una búsqueda **no**: viven en la lista
temporal del módulo §7.4 y solo se vuelven propias cuando el vendedor convierte el candidato
en prospecto y las verifica en sitio.

### `visitas`

La bitácora. Es el hecho registrado del que se deriva todo el avance.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | Generado en el cliente |
| `prospecto_id` | uuid not null → `prospectos` | `cliente_id` se agrega al integrar Zoho |
| `vendedor_id` | uuid not null → `perfiles` | |
| `tipo` | `tipo_interaccion` not null | |
| `fecha` | timestamptz not null default now() | |
| `checkin_lat` / `checkin_lng` | numeric | Obligatorias si `tipo = visita`, salvo que `sin_gps` sea verdadero |
| `checkin_precision_m` | numeric | Precisión de la lectura GPS (§10) |
| `sin_gps` | boolean not null default false | El GPS no enganchó. Deja el registro marcado para gerencia |
| `resultado` | `resultado_visita` not null | |
| `notas` | text | |
| `proveedor_actual` | text | Inteligencia de competencia (§7.7) |
| `precio_referencia` | numeric(12,2) | Lo que paga hoy |
| `foto_path` | text | Ruta en el bucket de Storage |
| `created_at` `updated_at` `created_by` `deleted_at` | | |

**Restricciones en la base:**

- Si `tipo = 'visita'`, o hay coordenadas o `sin_gps` es verdadero. Nunca las dos cosas
  nulas en silencio: una visita sin ubicación tiene que verse como tal.
- `ruc` único entre los registros vivos cuando no es nulo.
- Las visitas no se editan libremente: son bitácora. Ver `03-seguridad-rls.md`.

`proveedor_actual` y `precio_referencia` son dos campos de captura casi instantánea cuyo
valor es acumulativo: en seis meses producen el mapa de quién domina cada zona y a qué
precio (§7.7). Se capturan desde el día uno aunque nadie los consulte todavía.

### `compromisos`

El próximo paso con fecha. Es el motor del seguimiento diario y lo que llena la agenda.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | Generado en el cliente |
| `prospecto_id` | uuid not null → `prospectos` | |
| `visita_id` | uuid → `visitas` | La visita que lo originó, si aplica |
| `vendedor_id` | uuid not null → `perfiles` | |
| `descripcion` | text not null | Qué se comprometió a hacer |
| `fecha_compromiso` | date not null | |
| `cumplido_en` | timestamptz | Nulo mientras esté pendiente |
| `created_at` `updated_at` `created_by` `deleted_at` | | |

Un compromiso vencido es `fecha_compromiso < hoy` y `cumplido_en is null`. Es el primer
elemento de la agenda del día y alimenta la franja "Requiere tu atención" de §7.3.

### `auditoria`

Bitácora de cambios sensibles: reasignaciones, precios, umbrales, ediciones de plan y
cambios de etapa.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tabla` | text not null | |
| `registro_id` | uuid not null | |
| `campo` | text not null | |
| `valor_anterior` | text | |
| `valor_nuevo` | text | |
| `actor_id` | uuid not null → `perfiles` | |
| `created_at` | timestamptz not null default now() | |

**No lleva `updated_at` ni `deleted_at`: es inmutable.** Es la única excepción a la regla de
§16, y existe porque una bitácora que se puede editar no sirve como bitácora.

**De aquí sale el historial de etapas.** Cada cambio de `prospectos.etapa` deja su fila, y
con eso se calcula lo que pide §7.3: tiempo promedio del ciclo creación → cotización →
cierre, y cuántos días lleva un prospecto detenido en `negociacion`. No hace falta una tabla
aparte de historial.

---

## Lo que se agrega después

| Tabla | Tramo | Nota |
|---|---|---|
| `oportunidades` | 4 | Prospecto o cliente + producto + monto + etapa |
| `territorios` | 4 | Zona, vendedor asignado, estado de cobertura |
| `clientes` | Integración Zoho | Espejo de solo lectura. Trae el umbral de dormido |
| `solicitudes_cotizacion` | Cotizaciones | Con el número de Zoho enlazado |
| `muestras` | §7.7 | Trazabilidad y tasa de conversión |
| `grupos_comerciales` | §7.9 | Razón social, marcas y locales asociados |
| `comentarios` | §7.8 | Hilos anclados al registro, con estado de consulta abierta |

El modelo debe contemplar desde ya el **cambio de propietario de la cuenta** (§11): en Fase
2 el seguimiento transaccional pasa a la oficina. Por eso `vendedor_id` es una referencia y
toda reasignación pasa por `auditoria`.

---

## Puntos abiertos

- **`tipo_comercio` no tiene catálogo cerrado.** Queda como texto hasta que la depuración de
  Zoho (§7.6) defina la lista, porque tiene que ser la misma en los dos sistemas. Es lo que
  alimenta el modelo de gemelos y el umbral de dormido por tipo de comercio.
- **`origen_prospecto` es propuesta**, no está fijado en la visión.
- **Compromiso obligatorio en toda visita.** §6 lo exige sin excepciones. Pero forzar un
  próximo paso cuando el resultado fue `local_cerrado` o `no_usa_productos` no tiene sentido
  en la calle. Se implementa como manda §6 y **se valida en el piloto del Tramo 5**; si
  estorba, se cambia con el dato del uso real, no por suposición.
- **Umbral de pedido mínimo, rango de ajuste del umbral de dormido y metas por vendedor**
  siguen sin definir (§12). No bloquean el núcleo de campo; sí bloquean §7.5 y el tablero.
