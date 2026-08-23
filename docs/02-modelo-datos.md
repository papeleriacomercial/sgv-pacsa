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
| `tipo_cuenta` | sin_clasificar · prospecto · cliente · descartada |
| `volumen_cuenta` | alta · media · baja |
| `etapa_oportunidad` | nuevo · contactado · cotizado · negociacion · ganado · perdido |
| `resultado_visita` | diez opciones, ver abajo. Incluye `compro` |
| `motivo_perdida` | precio · espera_licitacion · no_cumple_especificaciones · sin_interes_real · no_contactar |
| `motivo_descarte` | no_existe · muy_pequeno · no_usa_productos · sin_interes · ya_atendido · otro |
| `tipo_interaccion` | visita · reunion · llamada · whatsapp · correo · entrega_muestra |
| `tipo_punto` | local · oficina |
| `tipo_jornada` | viaje_mercancia · entrega · entrega_urgente · no_pudo_salir · administrativo · personal |
| `duracion_jornada` | media · completa |
| `tipo_lista` | zona · objetivo |
| `clase_venta` | rapida · grande |
| `tipo_solicitud` | pedido · cotizacion · muestra · precio |
| `resuelve_solicitud` | yo · oficina |
| `estado_solicitud` | pendiente · resuelta · rechazada |
| `motivo_competencia` | precio · credito · paisanaje · cercania · entrega · especificacion · pedido_minimo · otro |
| `origen_prospecto` | calle · busqueda · referido · llamada_entrante · otro |
| `linea_producto` | rollos_fiscales · bolsas_papel · papel_antigrasa · tubos_carton · otros |

### `tipo_cuenta` — el ciclo de vida de la cuenta

    sin_clasificar → prospecto → cliente
                  ↘ descartada

Una cuenta nace de dos formas distintas y hasta la migración `ciclo_de_vida_cuenta` las dos
quedaban iguales:

1. **En la calle**, parado frente al local. Se captura el GPS y se registra la visita en el
   acto.
2. **En la oficina**, planificando sobre el mapa. No hay contacto todavía.

La segunda produce cuentas que nadie ha visitado ni contactado, y llamarlas "prospecto"
afirma algo que no ocurrió. `sin_clasificar` es lo que son hasta que alguien las trabaje, y
esa cola es lo que el vendedor tiene que vaciar.

**`descartada` no es borrado.** La cuenta conserva su visita y su motivo: saber que alguien
ya fue y no sirvió evita que otro repita el viaje. Sale de la cartera del día, no de la base.
El interruptor "Mostrar descartadas" la trae de vuelta.

Restricción `cuentas_motivo_solo_si_descartada`: `(tipo = 'descartada') = (motivo_descarte
is not null)`. Las dos direcciones. Una cuenta descartada sin motivo es información perdida;
un motivo en una cuenta viva es un dato que nadie sabría interpretar.

Ver D-015.

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
| `tipo` | `tipo_cuenta` not null default `sin_clasificar` | Dónde va la cuenta en su ciclo de vida (D-010, D-015) |
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
| `motivo_descarte` | `motivo_descarte` | Por qué no sirvió. Obligatorio si y solo si `tipo = descartada` |
| `cuenta_madre_id` | uuid → `cuentas` | De qué cuenta cuelga este punto. Nulo si es independiente |
| `tipo_punto` | `tipo_punto` not null default `local` | Oficina: solo se negocia, no entra a rutas de reparto |
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
| `proveedor_actual` / `precio_referencia` | text / numeric | Inteligencia de competencia (§7.7). El proveedor se escribe con sugerencia de `competidores` |
| `motivos_competencia` | `motivo_competencia[]` | Por qué le compra al otro. Varias a la vez: casi nunca es una sola |
| `foto_path` | text | Bucket `visitas`, que conserva su nombre viejo |
| `oportunidad_id` | uuid → `oportunidades` | Opcional: la venta concreta sobre la que trató |
| `notas` | text | |
| `created_at` `updated_at` `created_by` `deleted_at` | | |

**Restricción:** si `tipo = 'visita'`, o hay coordenadas o `sin_gps` es verdadero.

### `compromisos`

`id` · `cuenta_id` · `visita_id` · `oportunidad_id` · `vendedor_id` · `descripcion` ·
`tipo_accion` · `fecha_compromiso` · `cumplido_en` · auditoría.

**`oportunidad_id` dice a qué venta sirve este próximo paso.** Sin él, un renglón de la
agenda que dice "Banco Aliado" no distingue si es por los rollos de los cajeros o por las
bolsas de la cafetería, cuando las dos ventas están abiertas con el mismo cliente. Se hereda
del seguimiento que originó el compromiso, sin que nadie lo elija dos veces.

**`tipo_accion` es qué hay que hacer**, del mismo enum que los seguimientos. Sin ese dato la
pantalla de Seguimientos no puede pedir "las llamadas de hoy": habría que leer cuarenta
frases de texto libre.

Un compromiso vencido es `fecha_compromiso < hoy` y `cumplido_en is null`.

**`visita_id` es nulo cuando el compromiso se programó, no se derivó.** Programar y
registrar son dos actos distintos (D-016): programar es decidir qué se va a hacer y cuándo,
sentado frente al mapa, sin que haya pasado nada todavía; registrar es contar qué pasó, con
su check-in y su resultado, y de ahí sale el próximo paso encadenado. Los dos producen
compromisos y los dos aparecen en la pantalla de Seguimientos; el nulo distingue de dónde
vino cada uno.

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

### `jornadas`

`id` · `vendedor_id` · `fecha` · `tipo` · `duracion` · `desde_texto` · `hasta_texto` ·
`cuentas_atendidas` · `notas` · auditoría.

**En qué se fue el tiempo que no fue vender.** Sin esto, la semana en que el vendedor del
interior hizo dos viajes a Natá se ve floja — y una métrica injusta no se corrige después:
se sabotea.

Es la única captura del sistema donde el interés del vendedor y el de la empresa apuntan al
mismo lado: **es su coartada**, y por eso se alimenta sola. Se presenta como defensa, no
como control; el encuadre vale más que la funcionalidad.

`duracion` es media o completa a propósito. La pregunta de negocio es si la logística se
come el 30% o el 60% de la semana (§7.3), no una planilla de nómina — y pedir horas exactas
a alguien que carga un camión produce números inventados.

De aquí salen **los días vendibles**: cinco menos lo que se fue en otra cosa. La banda de
expectativa se lee contra ese número y no contra el calendario.

`cuentas_atendidas` es opcional y vale la pena: la entrega también es contacto con el
cliente, y hoy el del interior ve a los suyos repartiendo sin recibir crédito por ello.

**RLS:** cada quien registra y ve lo suyo, el líder ve a su equipo, gerencia todo. Sin
UPDATE salvo una excepción — puede corregir lo de hoy. No poder arreglar un "media jornada"
mal puesto hasta el viernes es lo que hace que se deje de registrar.

### `listas` y `listas_cuentas`

`listas`: `id` · `vendedor_id` · `nombre` · `tipo` · `clase` · `poblado` · `archivada` ·
auditoría. `listas_cuentas`: `lista_id` · `cuenta_id` · `agregada_en` · `agregada_por`.

Los paquetes de leads. Resuelven dos cosas: que cincuenta puntos escogidos un domingo no
ahoguen la cartera, y que **exista el denominador del embudo** — sin intención declarada, la
pregunta *"trabajó 50 y convirtió 10, ¿qué pasó con los 40?"* es incontestable.

Tabla de unión y no columna en `cuentas`: una cuenta puede estar en más de una lista, y la
fecha de entrada es dato — es lo que permite decir "levantaste 60, tocaste 34", que es
**calidad de planificación** y no tasa de conversión.

`clase` es lo que el vendedor **espera** al armarla; lo real sale de la fecha de cierre de
cada venta. Las dos conviven: sin la marca en la lista la mezcla solo se mira hacia atrás, y
la mezcla se decide antes de empezar. Cuando no coinciden, es un hallazgo de mercado.

Vista `listas_resumen` con `security_invoker`, que cuenta también cuántos llevan más de dos
meses sin tocar: contra el cementerio, la defensa es mostrar la antigüedad.

### `solicitudes`

`id` · `cuenta_id` · `oportunidad_id` · `vendedor_id` · `tipo` · `resuelve` · `detalle` ·
`monto_estimado` · `para_cuando` · `estado` · `respuesta` · `resuelta_en` · auditoría.

Lo que entra y necesita que actúe alguien más. **No es un seguimiento** —un seguimiento es
algo que el vendedor hizo o prometió— es un encargo con destinatario y con reloj. Es la
bandeja de §7.2.

`resuelve` distingue los dos caminos reales: su talonario o la oficina. Registrar los dos
hace visible la **facturación manual**, que hoy no se ve.

Vista `solicitudes_resumen` con las horas y si está vencida. El reloj mide a los dos lados.

### `cierres`

`id` · `vendedor_id` · `semana` · `numeros` · `sorprendio` · `freno` · `necesito` ·
`plan` · `apuesta_leads` · `apuesta_clientes` · `enviado_en` · `respuesta` · auditoría.

El contrato semanal. `numeros` se **congela** en vez de recalcularse: la semana 34 tiene que
seguir diciendo en diciembre lo que dijo en agosto, y un histórico que se mueve solo no sirve
para comparar.

**El trigger `cierres_protege_el_plan` impide que quien no es el dueño toque el plan.** Es la
regla que sostiene el esquema de abajo hacia arriba: si el plan se puede editar desde arriba
deja de ser su plan, y el vendedor aprende a proponer lo que va a ser aprobado. Vive en la
base y no en la pantalla porque una regla que solo existe en la interfaz se salta desde
cualquier otro lado.

### `competidores`

`id` · `nombre` (único sin distinguir mayúsculas) · `activo` · auditoría.

Catálogo abierto y global, igual que `categorias_comercio` (D-012). Existe porque
`proveedor_actual` era texto libre: "el chino", "chino de la esquina", "Distribuidora Wang"
y "wang" son cuatro filas que no se pueden sumar, y **sobre texto libre no se construye
inteligencia de competencia**.

El campo de texto no cambia; lo que cambia es que se escribe con sugerencia. Empujar a que
todos escriban igual es lo único que hace falta para poder agregar.

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
