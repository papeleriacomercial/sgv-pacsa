# Modelo de datos

Esquema, convenciones y diccionario de campos. Las políticas de acceso de cada tabla están
en `03-seguridad-rls.md`; se diseñan al mismo tiempo que la tabla, nunca después.

**Refleja el esquema real de `sgv-pacsa-dev` al 2026-08-21**, después de las Etapas 1 y 2 del
plan v2. Ese replanteamiento cambió el sujeto del sistema: se pasó del prospecto —que se
acaba al ganarlo o perderlo— a la **cuenta**, que se sigue trabajando después de la primera
venta. Ver `08-plan-v2.md`.

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

Casi todos son **tipos enum**: catálogos cerrados donde agregar una opción exige una
migración versionada, que es la garantía de que nadie los cambia desde el dashboard (D-004).

La excepción es `categorias_comercio`, que es una tabla abierta. Nadie puede enumerar por
adelantado los tipos de comercio de un país, y la lista crece con cada zona que se abre
(D-012).

| Enum | Valores |
|---|---|
| `rol_usuario` | gerente · lider · vendedor · administracion |
| `tipo_cuenta` | prospecto · cliente |
| `volumen_cuenta` | alta · media · baja |
| `etapa_oportunidad` | nuevo · contactado · cotizado · negociacion · ganado · perdido |
| `resultado_visita` | nueve opciones, ver abajo |
| `motivo_perdida` | precio · espera_licitacion · no_cumple_especificaciones · sin_interes_real · no_contactar |
| `motivo_descarte` | no_existe · muy_pequeno · no_usa_productos · ya_atendido · otro |
| `tipo_interaccion` | visita · llamada · whatsapp · correo · entrega_muestra |
| `origen_prospecto` | calle · busqueda · referido · llamada_entrante · otro |
| `linea_producto` | rollos_fiscales · bolsas_papel · papel_antigrasa · tubos_carton · otros |

### `etapa_oportunidad`

Se llamaba `etapa_prospecto`. **La etapa vive en la oportunidad, no en la cuenta** (D-011):
una cuenta con tres oportunidades en tres etapas distintas no está "en una etapa". Lo que
avanza, se gana o se pierde es la venta, no el local.

`negociacion` es deliberadamente ancha: adentro caben la espera de aprobación de gerencia,
la prueba de producto y la negociación de volumen y precio. El detalle lo dan la bitácora y
el compromiso vigente (D-005).

### `resultado_visita`

| Valor | Etiqueta | Recontacto |
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
nunca va a comprar esta categoría; el segundo, uno que podría y hoy dijo que no.

### El comportamiento "reintentar con fecha"

Aparece en `stock_suficiente`, `precio` y `espera_licitacion`. En los tres significa lo
mismo: este punto vuelve a la lista de trabajo en una fecha concreta.

**Dónde se obliga cada uno:**

- `precio` y `espera_licitacion` viven en `oportunidades`, junto a `fecha_recontacto`. Ahí lo
  obliga la base con un `check`. Verificado.
- `stock_suficiente` es un resultado de seguimiento, y la fecha del próximo paso vive en
  `compromisos`, otra tabla. Un `check` no mira más allá de su fila, así que **esa la obliga
  la interfaz**. Se documenta la diferencia en vez de dar por hecho que la base cubre las dos.

---

## Tablas

### `perfiles`

`id` (uuid PK → `auth.users`) · `nombre` · `rol` · `lider_id` · `activo` ·
`created_at` · `updated_at` · `deleted_at`.

Pendiente: si lleva `created_by`, y cómo se da de alta.

### `cuentas`

Un punto con el que hay relación comercial, sea prospecto o cliente. Se llamaba
`prospectos`.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | Generado en el cliente |
| `nombre` | text not null | |
| `tipo` | `tipo_cuenta` not null default `prospecto` | La marca del vendedor: "a este ya le vendí" (D-010) |
| `ruc` | text | Único entre vivos. Señal de duplicado (§6) |
| `tipo_comercio` | text | Alimenta y se alimenta de `categorias_comercio` |
| `volumen` | `volumen_cuenta` | Juicio del vendedor. Distinto del potencial calculado de §7.5 |
| `contacto_nombre` `contacto_telefono` `contacto_whatsapp` `contacto_correo` | text | |
| `lat` / `lng` | numeric | GPS del vendedor o punto del mapa: **dato propio** |
| `direccion` | text | Cómo se llega. Las coordenadas sirven al mapa, esto a la gente |
| `poblado` | text | Distrito o pueblo. Permite agrupar la cartera por zona |
| `place_id` | text | Único entre vivos. Lo único de Places que se guarda indefinidamente |
| `productos_interes` | `linea_producto[]` | |
| `dias_cadencia` | smallint 1–365 | Cada cuántos días debería contactarse. Nulo: sin cadencia |
| `vendedor_id` | uuid not null → `perfiles` | |
| `origen` | `origen_prospecto` not null | |
| `notas` | text | |
| `created_at` `updated_at` `created_by` `deleted_at` | | |

**Ya no lleva** `etapa`, `etapa_desde`, `motivo_perdida` ni `fecha_recontacto`: se mudaron a
`oportunidades` (D-011).

**`dias_cadencia` es contra qué se mide "días sin contacto".** Veinte días sin ver a un
restaurante que recompra cada quince es una alarma; a una oficina trimestral, es normal. Es
la versión trabajable del umbral de dormido de §6.

### `seguimientos`

La bitácora de interacciones. Se llamaba `visitas`, y el nombre cambió porque una
interacción puede ser llamada, WhatsApp o correo, no solo una visita.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `cuenta_id` | uuid not null → `cuentas` | |
| `vendedor_id` | uuid not null → `perfiles` | |
| `tipo` | `tipo_interaccion` not null | Solo `visita` exige check-in |
| `fecha` | timestamptz not null | |
| `checkin_lat` / `checkin_lng` / `checkin_precision_m` | numeric | Se guarda la precisión (§10) |
| `sin_gps` | boolean not null default false | El GPS no enganchó |
| `resultado` | `resultado_visita` not null | |
| `proveedor_actual` / `precio_referencia` | text / numeric | Inteligencia de competencia (§7.7) |
| `foto_path` | text | Bucket `visitas`, que conserva su nombre viejo |
| `oportunidad_id` | uuid → `oportunidades` | Opcional: la venta concreta sobre la que trató |
| `notas` | text | |
| `created_at` `updated_at` `created_by` `deleted_at` | | |

**Restricción:** si `tipo = 'visita'`, o hay coordenadas o `sin_gps` es verdadero.

### `compromisos`

`id` · `cuenta_id` · `visita_id` · `vendedor_id` · `descripcion` · `tipo_accion` ·
`fecha_compromiso` · `cumplido_en` · auditoría.

**`tipo_accion` es qué hay que hacer**, del mismo enum que los seguimientos. Sin ese dato la
pantalla de Seguimientos no puede pedir "las llamadas de hoy": habría que leer cuarenta
frases de texto libre.

Un compromiso vencido es `fecha_compromiso < hoy` y `cumplido_en is null`.

### `oportunidades`

Un punto más una línea de producto. Se separan de la cuenta porque un mismo local puede
comprar rollos y no bolsas, y cada negociación avanza a su ritmo.

`id` · `cuenta_id` · `vendedor_id` · `nombre` · `linea` · `descripcion` ·
`monto_estimado` · `probabilidad` (0–100) · `etapa` · `etapa_desde` ·
`fecha_cierre_estimada` · `motivo_perdida` · `fecha_recontacto` · auditoría.

**Restricciones:** el motivo existe si y solo si la etapa es `perdido`; los motivos que
significan reintentar exigen `fecha_recontacto`; la probabilidad va de 0 a 100; el monto no
es negativo.

**La oportunidad vencida se congela.** Con `fecha_cierre_estimada` en el pasado, un trigger
rechaza cualquier UPDATE salvo que mueva esa fecha al futuro. Dos excepciones: cerrarla como
ganada o perdida, y borrarla lógicamente. Sin la primera, registrar una venta perdida
obligaría a inventarle antes una fecha futura de cierre — a mentir para poder decir la
verdad.

### `notas_oportunidad`

`id` · `oportunidad_id` · `texto` · `autor_id` · `created_at`.

Bitácora de avance: **se agrega, no se edita**. Cada nota nace con su fecha y hora. Un campo
de texto único se sobrescribe y pierde la historia; así queda cómo evolucionó la negociación,
que es lo que hay que mirar cuando una oportunidad lleva dos meses sin moverse.

Sin política de update ni de delete, igual que los seguimientos y la auditoría.

### `categorias_comercio`

`id` · `nombre` (único sin distinguir mayúsculas ni espacios) · `activa` · auditoría.

Catálogo abierto y **global**: el vendedor escribe una categoría nueva y queda para todo el
equipo. Global porque §7.6 necesita que `tipo_comercio` sea comparable con la clasificación
de Zoho (D-012).

### `descartes`

`id` · `place_id` (único entre vivos) · `motivo` · `nota` · `vendedor_id` · auditoría.

Puntos descartados sin visitar. Solo guarda el `place_id`, nada de nombres de Google.

### `auditoria`

`id` · `tabla` · `registro_id` · `campo` · `valor_anterior` · `valor_nuevo` · `actor_id` ·
`created_at`.

**No lleva `updated_at` ni `deleted_at`: es inmutable.** Única excepción a la regla de §16,
y existe porque una bitácora editable no sirve como bitácora.

De aquí sale el historial de etapas de las oportunidades y el registro de cuándo una cuenta
pasó de prospecto a cliente.

---

## Vista `cuentas_resumen`

Las cuentas con sus días calculados. Se consulta desde las pantallas en vez de `cuentas`.

Agrega: `ultimo_contacto` · `dias_sin_contacto` · `proximo_compromiso` ·
`dias_hasta_compromiso` · `fuera_de_cadencia` · `sin_ubicacion` · `oportunidades_abiertas`.

Los días son cálculo, no dato: guardarlos obligaría a recalcularlos en cada escritura y
quedarían desactualizados el día que nadie tocara el registro.

**Lleva `security_invoker = true`, y no es opcional.** Sin eso la vista correría con los
permisos de quien la creó y saltaría el RLS de las tablas de abajo, dejando que cualquier
vendedor viera la cartera completa. Verificado: otro usuario ve cero filas.

---

## Funciones

| Función | Para qué |
|---|---|
| `rol_actual()` `lider_actual()` `es_gerente()` `es_administracion()` `es_mi_equipo()` | Auxiliares de RLS, todas `security definer` |
| `tocar_updated_at()` `tocar_etapa_desde()` | Triggers de mantenimiento |
| `auditar_cuenta()` `auditar_oportunidad()` | Escriben en `auditoria`, `security definer` |
| `buscar_duplicados()` | Aviso de duplicado de §6, divulgación controlada |
| `estado_de_puntos()` | Semáforo de §7.4, divulgación controlada |

---

## Lo que se agrega después

`territorios` (cuando exista el filtro por zona que la justifique) · `clientes` (espejo de
Zoho) · `solicitudes_cotizacion` · `muestras` · `comentarios` (§7.8) ·
`grupos_comerciales` (§7.9) · `ventas_mensuales` (Etapa 6 del plan v2).

---

## Puntos abiertos

- **Compromiso obligatorio en todo seguimiento.** §6 lo exige sin excepciones, pero forzarlo
  cuando el resultado fue `local_cerrado` no tiene sentido. Se implementa como manda §6 y se
  valida en el piloto.
- **`origen_prospecto` es propuesta**, no está fijado en la visión.
- **Umbral de pedido mínimo, rango de ajuste del umbral de dormido y metas por vendedor**
  siguen sin definir (§12).
