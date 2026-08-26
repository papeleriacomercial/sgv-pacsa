# Estado del proyecto

**Última actualización:** 2026-08-23 · **Rama activa:** `dev`

Se actualiza al cerrar cada tarea (§15 de la visión). Si una tarea terminó y este archivo
no cambió, la tarea no terminó.

> **Fase actual:** plan v2, Etapas 1 a 5 cerradas (`docs/08-plan-v2.md`). Falta la Etapa 6
> —ventas y reportes—, la 7 —Zoho, bloqueada por la higiene del maestro de clientes— y la 8
> —piloto y offline—. Este archivo es un registro que crece por el final: **lo último es lo
> vigente**.

---

## Hecho

### Infraestructura

| Pieza | Estado | Nota |
|---|---|---|
| Repositorio Git | Listo | Ramas `main` (producción) y `dev` (integración), según §14. |
| Proyecto Next.js | Listo | Next.js 16.3.1, React 19, TypeScript, Tailwind v4. Solo el andamiaje de `create-next-app`; sin pantallas propias. |
| Supabase `sgv-pacsa-dev` | Creado | Entorno de desarrollo. |
| Supabase `sgv-pacsa-prod` | Creado | Entorno de producción. Sin migraciones aplicadas todavía. |
| Supabase CLI | Listo | `supabase` ^2.115.0 en devDependencies; se invoca con `npx supabase`. |
| Variables de entorno | Listo en local | `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` apuntando a `sgv-pacsa-dev`. |
| Vercel | Creado | Proyecto `sgv-pacsa` conectado a GitHub. Producción desde `main` en `https://sgv-pacsa.vercel.app`. Variables cargadas: Production a prod, Preview y Development a dev. Configuración completa. |
| Previews de Vercel | Verificado | Primer deploy de la rama `dev` en estado `Ready`, lo que confirma que Preview y Production apuntan a bases distintas. |
| Auth URL Configuration | Listo | Verificado el 2026-08-20: prod acepta `https://sgv-pacsa.vercel.app/**`; dev acepta `http://localhost:3000/**` y el comodín de previews `https://sgv-pacsa-*-papeleria-comercial.vercel.app/**`. |
| Aplicación, cimientos | Verificado | Login, sesión y pantalla de inicio funcionando desde un celular real contra el preview de `dev`. |

Los dos proyectos de Supabase quedaron separados desde el día uno, como exige §16.

### Base de datos

**Migración `perfiles_y_roles`** — primera migración del sistema, aplicada en `sgv-pacsa-dev`.
Contiene:

- Enum `rol_usuario`: `gerente`, `lider`, `vendedor`, `administracion`.
- Tabla `perfiles`: `id` (uuid, PK, FK a `auth.users` on delete cascade), `nombre`, `rol`,
  `lider_id` (autorreferencia), `activo`, `created_at`, `updated_at`, `deleted_at`.
- Funciones `security definer` con `set search_path = public`, para evitar recursión al
  evaluar las políticas: `rol_actual()`, `lider_actual()`, `es_gerente()`.
- RLS activado en la misma migración, con cuatro políticas: cada quien ve su perfil; cada
  quien edita su perfil (sin poder cambiarse `rol` ni `lider_id`); gerencia ve y administra
  todo; el líder ve a los perfiles cuyo `lider_id` es él.
- Función `tocar_updated_at()` y su trigger sobre `perfiles`.

Es la única tabla que existe. `sgv-pacsa-prod` sigue vacío: la migración **no** se ha aplicado ahí.

**Verificado contra `sgv-pacsa-dev` el 2026-08-20** (consulta a `pg_policies`, `pg_proc` y
`pg_class` vía Management API): la única migración aplicada es `20260819224500`, RLS está
activo, existen las cuatro políticas, y `perfiles_update_propio` tiene su `with check`
completo — `rol = rol_actual()` y `lider_id` sin cambiar. Las tres funciones auxiliares son
`security definer` con `search_path=public`, y el trigger de `updated_at` está en su lugar.
El esquema en dev coincide con el archivo versionado.

### Documentación

- `docs/00-vision.md` — levantamiento completo de Fase 1. Cerrado.
- `CLAUDE.md` — índice, reglas de trabajo y mantenimiento de `/docs`. Vivo.
- `docs/01-arquitectura.md` — stack, entornos, flujos e integraciones. Completo.
- `docs/02-modelo-datos.md` — catálogos, tablas del núcleo de campo y diccionario. Completo.
- `docs/03-seguridad-rls.md` — modelo de permisos y políticas por tabla. Completo.
- `docs/04-design-system.md` — tokens, componentes y ficha de punto. Completo.
- `docs/05-modulos/7.1-app-movil-vendedor.md` — app del vendedor. Completo.
- `docs/05-modulos/7.4-busqueda-prospectos.md` — búsqueda y planificación. Completo.
- `docs/06-decisiones.md` — bitácora de decisiones. Vivo. Registradas D-001 (slug),
  D-002 (nomenclatura en español), D-003 (sin Docker), D-004 (catálogos como enum) y
  D-005 (negociación como etapa ancha).
- `docs/07-estado.md` — este archivo. Vivo.
- `docs/sgv-preview.html` — maqueta visual de referencia, no especificación.

---

## En curso

**§7.4 — búsqueda de prospectos.** Documento del módulo, migración y pantalla construidos y
verificados en base. Falta probarla en la calle: la búsqueda real contra Google solo se
comprueba con un celular en un lugar con comercios alrededor.

---

## Plan de construcción

> **Reemplazado el 2026-08-21.** El plan vigente está en [08-plan-v2.md](08-plan-v2.md),
> tras el replanteamiento del negocio. Lo que sigue abajo se conserva como registro de lo
> que se planificó y se ejecutó hasta los Tramos 1 a 4.

Cinco tramos hasta tener la aplicación en manos de un vendedor real. El orden sale de §13
de la visión: primero el núcleo de campo, que es lo que hoy no existe y lo que sostiene
todo lo demás.

### Tramo 1 — Cerrar los documentos de diseño — HECHO

Los cuatro documentos están escritos. Los catálogos de resultado de visita, motivo de
pérdida y etapas quedaron definidos con el negocio el 2026-08-20.

### Tramo 2 — Cimientos de la aplicación — HECHO

Login, sesión, perfil del usuario, navegación, y los componentes compartidos de tarjeta,
insignia, campo y tabla. Los tokens de `04-design-system.md` bajan a código aquí.

**Se ve al final:** entrar desde el celular, iniciar sesión y ver nombre y rol. Es donde
se comprueba que el RLS funciona: un vendedor no debe poder ver el perfil de otro.

**Por qué va aquí:** todo lo demás cuelga de saber quién eres. Las políticas de `perfiles`
no sirven hasta que haya un usuario autenticado.

### Tramo 3 — Núcleo de campo, captura — HECHO

Alta de prospecto con GPS y foto, validación de duplicados, bitácora de interacciones y
compromisos con fecha.

**Se ve al final:** un vendedor frente a un local registra el prospecto y deja agendado el
próximo paso.

**Criterio de aceptación:** que la captura completa baje de 30 segundos, medido con
cronómetro. §12 marca la resistencia al registro en campo como el riesgo real del
proyecto; si es lento, no se usa.

**Tablas nuevas:** `prospectos`, `visitas`, `compromisos`, y la tabla de auditoría. Cada
una nace con RLS y sus políticas en la misma migración.

### Tramo 4 — Núcleo de campo, consulta — HECHO

Mapa de clientes y prospectos con filtros, y agenda del día con los compromisos vencidos
primero.

**Se ve al final:** lo que hoy da Badger Maps, más lo que Badger no da. Es donde el
vendedor empieza a preferir la herramienta en vez de tolerarla.

**Por qué después del 3:** un mapa sin datos capturados está vacío.

**Tablas nuevas:** `oportunidades`, `territorios`.

### Tramo 5 — Piloto con un vendedor, dos semanas

Uso real en la calle antes de agregar cotizaciones o integraciones. Aquí se endurece el
modo offline, que es lo más delicado del proyecto y solo se prueba de verdad en el
interior, donde se cae la señal.

**Produce:** la lista de lo que hay que arreglar antes de que lo toquen los demás.

### En paralelo, sin bloquear nada

La depuración del maestro de clientes y productos de Zoho (§7.6). No es programación, es
normalización de datos, y es prerrequisito del módulo de inteligencia comercial. Puede
avanzar desde ya, con otra persona. Probablemente sea el módulo de retorno más rápido
porque los datos ya existen.

### Después de los cinco tramos

Búsqueda y calificación de prospectos (§7.4 y §7.5), cotizaciones con aprobación de
precios, lectura de Zoho y del SGP, y el tablero de gerencia (§7.3). Todo eso solo tiene
sentido cuando ya haya datos reales entrando.

---

## Puntos que requieren decisión

### 1. Desviaciones respecto a §16 que conviene zanjar y registrar en `06-decisiones.md`

- **`perfiles` no tiene `created_by`.** §16 lo exige en todas las tablas. En `perfiles` es
  discutible, porque el perfil nace del registro del propio usuario en `auth.users`. Hay que
  decidir: exceptuar `perfiles` explícitamente, o agregar la columna.
- **Alta de perfiles.** No hay política de `insert` para usuarios normales: hoy solo gerencia
  puede crear perfiles. Falta definir si el alta la hace un trigger sobre `auth.users` o la
  oficina a mano.

### 2. Decisiones de negocio abiertas (§12 de la visión)

Resueltas el 2026-08-20 con el negocio: catálogo de resultado de visita (9 opciones) y de
motivo de pérdida (5), y las etapas del pipeline. Quedan en `02-modelo-datos.md`.

Siguen abiertas, y ninguna bloquea el núcleo de campo: umbral de pedido mínimo, rango
permitido de ajuste del umbral de dormido, metas por vendedor, y el catálogo de
`tipo_comercio`, que depende de la depuración de Zoho (§7.6).

---

## Cómo retomar

1. Leer `CLAUDE.md` (índice y reglas) y este archivo.
2. Revisar el Tramo 2 en el plan de construcción y arrancar por ahí.

---

## Verificación del RLS — 2026-08-20

Primera prueba real del modelo de permisos, con un usuario `vendedor` en `sgv-pacsa-dev`.
Las tres primeras corrieron dentro de transacciones revertidas: no dejaron rastro.

| Prueba | Esperado | Resultado |
|---|---|---|
| El vendedor intenta cambiarse su `rol` a `gerente` | Rechazado | `42501: new row violates row-level security policy` |
| El vendedor cambia su propio `nombre` | Permitido | Permitido |
| Otro usuario consulta `perfiles` | Ve 0 filas | Ve 0 de 1 |
| Login de punta a punta desde un celular | Nombre, rol y conteo | Correcto |

La tercera es la concluyente: un usuario distinto ve **cero** filas, no una. La política
filtra por `auth.uid()` de verdad, no está devolviendo todo. La primera confirma que el
`with check` de `perfiles_update_propio` cierra la escalada de privilegios.

Esta es la diferencia con el SGP: aquí el modelo de permisos se probó con la tabla vacía,
antes de que hubiera un solo dato real que depurar.

---

## Verificación del núcleo de campo — 2026-08-21

Migración `20260821012429_nucleo_de_campo` aplicada en `sgv-pacsa-dev`. Crea seis enums,
dos funciones auxiliares y las tablas `prospectos`, `visitas`, `compromisos` y `auditoria`,
las cuatro con RLS y políticas en la misma migración.

**Estructura:**

| Tabla | RLS | Políticas | Triggers | Checks |
|---|---|---|---|---|
| `prospectos` | Sí | 4 | 3 | 2 |
| `visitas` | Sí | 4 | 1 | 1 |
| `compromisos` | Sí | 3 | 1 | 0 |
| `auditoria` | Sí | 2 | 0 | 0 |

**Pruebas funcionales**, todas como el usuario `vendedor` y en transacciones revertidas. La
base quedó en cero filas.

| Prueba | Esperado | Resultado |
|---|---|---|
| Crea un prospecto suyo | Permitido, `created_by` se atribuye solo | Correcto |
| Crea un prospecto a nombre de otro vendedor | Rechazado | `42501` |
| Marca perdido sin motivo | Rechazado | `23514 prospectos_motivo_solo_si_perdido` |
| Motivo `precio` sin fecha de recontacto | Rechazado | `23514 prospectos_recontacto_obligatorio` |
| Motivo `precio` con fecha | Permitido | Correcto |
| Visita sin GPS y sin marca `sin_gps` | Rechazado | `23514 visitas_gps_o_marca` |
| La misma visita con `sin_gps` | Permitido | Correcto |
| Edita su propia visita | 0 filas: las visitas son bitácora | 0 filas |
| Borra su propia visita | 0 filas | 0 filas |
| Cambia de etapa | Fila en `auditoria` con el cambio | `etapa: nuevo -> cotizado` |
| Cambia solo las notas | Sin fila en `auditoria`, `etapa_desde` intacto | Correcto |
| Escribe en `auditoria` a mano | Rechazado | `42501` |

Las dos últimas son las que más importan: la auditoría registra lo que debe y solo lo que
debe, y ningún usuario puede escribirla directamente — solo el trigger `security definer`.

---

## Verificación de duplicados y fotos — 2026-08-21

Migración `20260821013050_duplicados_y_fotos`. Agrega `buscar_duplicados()` y el bucket de
fotos con sus políticas.

**Por qué hizo falta una función.** §6 exige avisar *"este punto ya está registrado y
asignado a X"*, pero el RLS impide que un vendedor lea los prospectos de otro: la consulta
directa devolvía cero y el aviso no habría aparecido nunca. Se resolvió con una función
`security definer` de **divulgación controlada**: devuelve nombre del punto, nombre del
vendedor y distancia, y nada más. Ni contacto, ni notas, ni etapa, ni montos. Alcanza para
decidir si es el mismo local sin convertirse en una puerta trasera al expediente ajeno.

| Prueba | Esperado | Resultado |
|---|---|---|
| Punto a 30 m, nombre distinto | Detecta por cercanía | `cercania`, 30 m |
| Punto a 2 km, nombre distinto | No aparece | 0 resultados |
| Mismo RUC, a 2 km | Detecta por RUC | `ruc`, 2.002 m |
| Nombre parecido, sin GPS | Detecta por nombre | `nombre` |
| Nombre de 3 letras | No dispara | 0 resultados |

El mínimo de cuatro letras evita que escribir "esq" saque medio maestro de clientes. La
distancia se calcula con la fórmula de Haversine, sin PostGIS: a 50 metros la curvatura no
cambia nada y evita mantener una extensión.

**Fotos.** Bucket privado `visitas`, límite de 5 MB, solo imágenes. La ruta es
`{vendedor_id}/{visita_id}.jpg` y la política compara ese primer segmento contra
`auth.uid()`. Sin esa convención, el RLS de `visitas` sería decorativo: bastaría adivinar la
URL. No hay política de update ni de delete: la foto es evidencia, igual que la visita.

---

## Captura y consulta probadas — 2026-08-21

El Tramo 3 está cerrado. El Tramo 4 quedó a medias: se construyeron el mapa y la agenda,
pero no el pipeline de oportunidades ni sus tablas. Lo probado funciona en un celular real
contra el preview de `dev`.

**Lo que funciona de punta a punta:**

| Pantalla | Estado |
|---|---|
| Alta de prospecto con GPS y aviso de duplicado | Probada |
| Registro de visita con foto y compromiso | Probada |
| Expediente con bitácora | Probada |
| Editar prospecto | Probada |
| Cambiar etapa, con motivo y fecha de recontacto | Probada |
| Agenda del día, vencidos primero | Probada |
| Mapa con filtros sobre OpenStreetMap | Probada |

**Datos reales capturados en la prueba:** dos prospectos con coordenadas propias, GPS con 9
y 13 metros de precisión, una foto subida al bucket, y un cambio de etapa a `perdido` con su
fila en `auditoria`.

**Un fallo que costó una vuelta:** el mapa salía en blanco. Leaflet mide su contenedor una
sola vez, al crearse, y el contenedor tenía altura mínima dentro de una cadena de alturas
mínimas, que nunca resuelve a un número. Se corrigió con altura explícita y con
`invalidateSize()` después de montar. Queda anotado porque es un error que reaparece cada
vez que se mete un mapa en un contenedor flexible.

**Lo que todavía no se ha medido:** cuántos segundos toma el registro completo de una visita.
Es el criterio de aceptación de §12 y solo se mide con cronómetro en la calle, en el piloto.

---

## Inventario de lo que falta — 2026-08-21

Levantado al preguntar el negocio si esto ya estaba listo para un piloto. La respuesta
honesta es que no: está construido el núcleo de campo y nada más.

### Dentro de §7.1, la app del vendedor

| Capacidad | Estado |
|---|---|
| Alta de prospecto con GPS y foto | Hecho |
| Bitácora de interacciones | Hecho |
| Compromisos y agenda del día | Hecho |
| Mapa con filtros | Hecho |
| Pipeline visual de oportunidades | Hecho |
| Modo offline con cola de sincronización | Falta — Tramo 5 |
| Lista de precios vigente consultable | Falta — necesita Zoho |
| Solicitud de cotización y su estado | Falta — necesita el módulo de oficina |
| Estado y fecha estimada de entrega | Falta — necesita el SGP |

### Módulos completos sin empezar

Ocho de los nueve de §7. Ninguno tiene documento en `05-modulos/` todavía.

| Módulo | Qué aporta | Depende de |
|---|---|---|
| §7.2 Oficina | Bandejas de cotización y alta de clientes | — |
| §7.3 Gerencia | Tablero en vivo, "Requiere tu atención" | Datos entrando |
| §7.4 Búsqueda de prospectos | Google Places por área y categoría | Llave y cuota de Google Cloud |
| §7.5 Calificación | Puntaje de potencial, descarte con motivo | §7.6 para el modelo de gemelos |
| §7.6 Inteligencia comercial | Tablero sobre facturación de Zoho | Depuración del maestro de Zoho |
| §7.7 Reposición, muestras, competencia | Alertas de recompra, tasa de muestras | Zoho |
| §7.8 Colaboración | Hilos anclados al registro | — |
| §7.9 Grupos comerciales | Marca → sociedad → grupo | — |

### Tablas que faltan

`oportunidades`, `territorios`, `clientes`, `solicitudes_cotizacion`, `muestras`,
`comentarios`, `grupos_comerciales`.

---

## Mapa de Google y captura desde el mapa — 2026-08-21

Verificado en un celular real contra el preview de `dev`.

| Prueba | Resultado |
|---|---|
| El mapa carga con los comercios de Google visibles | Correcto |
| Los prospectos propios se ven como puntos de color por etapa | Correcto |
| Tocar un local de tercero abre el globo con su nombre | Correcto |
| "Agregar como prospecto" lleva al alta con nombre y ubicación | Correcto |
| El prospecto queda creado con su `place_id` | Correcto |

Es la funcionalidad de Badger Maps que motivó el cambio de proveedor (D-009).

**Configuración de Google Cloud.** Proyecto `sgv-pacsa`, con Maps JavaScript API y Places
API (New) habilitadas. Llave restringida a `sgv-pacsa.vercel.app`, la URL de preview de
`dev` y `localhost`.

**Dos lecciones de la configuración**, anotadas porque van a repetirse:

1. Las variables `NEXT_PUBLIC_` se incrustan **al construir**, no al abrir. Agregar una
   variable en Vercel no la mete en los deploys que ya existen: hay que reconstruir.
2. Vercel marca como *Sensitive* cualquier variable cuyo nombre combine `NEXT_PUBLIC_` con
   `API_KEY`, y eso bloquea el guardado hasta confirmar. Para una llave de mapas la
   advertencia no aplica: es pública por diseño y la protege la restricción por dominio.

### Pendientes de seguridad antes del piloto

| | Qué falta | Por qué importa |
|---|---|---|
| 1 | Cuotas diarias o alerta de presupuesto en Google Cloud | La restricción por dominio es falsificable. La cuota es el único tope real del gasto |
| 2 | Agregar la cuenta de la empresa como Propietario del proyecto de Google | El proyecto quedó a nombre de una cuenta personal. Si se pierde, el mapa deja de funcionar y nadie más puede administrarlo |

Ninguno bloquea el desarrollo. Los dos deben cerrarse antes de que un vendedor real use el
sistema.

---

## Pipeline de oportunidades — 2026-08-21

Cierra el Tramo 4. Migración `20260821155641_oportunidades`.

**Por qué la oportunidad se separa del prospecto.** Un mismo local puede comprar rollos
fiscales y no bolsas, y cada negociación avanza a su ritmo. Sin esa separación no se puede
medir la tasa de cierre por producto, que es una de las preguntas de §7.3.

**Reutiliza el enum `etapa_prospecto`** en vez de tener uno propio. Un segundo catálogo casi
idéntico obligaría a traducir entre dos vocabularios en cada pantalla, para distinguir
matices que el negocio no hace.

**No lleva `fecha_recontacto`:** cuándo volver es una decisión del punto, no de una línea de
producto, y vive en `prospectos`.

| Prueba | Esperado | Resultado |
|---|---|---|
| Estructura | RLS, 3 políticas, 3 triggers, 3 checks | Correcto |
| El vendedor crea una oportunidad suya | Permitido | Correcto |
| Marcarla perdida sin motivo | Rechazado | `23514` |
| Probabilidad de 150 | Rechazado | `23514` |
| Cambio de etapa | Fila en `auditoria` | `nuevo -> cotizado` |
| Otro usuario la consulta | Ve 0 | Ve 0 |

**Pantallas:** `/pipeline` agrupa por etapa con el total de cada grupo y el monto abierto
arriba; se crean desde el expediente del prospecto y se editan en `/oportunidades/[id]`.

En escritorio esto sería un tablero de columnas arrastrables. En móvil no: arrastrar
tarjetas con una mano y a pleno sol no funciona. Cambia la densidad, no los datos (§17).

**`territorios` no se construyó**, a diferencia de lo que decía el plan. No tiene consumidor
todavía: el filtro por zona del mapa y el mapa de cobertura de §7.3 son lo que la justifican.
Crear una tabla que nadie lee es la misma clase de error que levantar pantallas con datos
falsos. Se hace cuando exista la pantalla que la use.

---

## §7.4 Búsqueda de prospectos — 2026-08-21

Migración `20260821161243_busqueda_prospectos`: enum `motivo_descarte`, tabla `descartes` y
función `estado_de_puntos()`.

**El semáforo tuvo el mismo problema que los duplicados.** Necesita saber si un punto es de
otro vendedor, y el RLS lo impide. Se resolvió igual: función `security definer` de
divulgación controlada que devuelve estado, nombre del vendedor, y fecha y resultado de la
última visita. Nada más.

**Los descartes se leen entre todo el equipo**, y es la única excepción deliberada al modelo
de "cada quien ve lo suyo". Se justifica porque lo que se comparte es un hecho del mundo —el
local cerró— y no información comercial. Escribir y editar sigue siendo del dueño.

| Prueba | Esperado | Resultado |
|---|---|---|
| Semáforo con punto propio, descartado y nuevo | Devuelve los dos primeros | Correcto, con etapa y último resultado |
| Punto que no está en el sistema | Sin fila: es nuevo por ausencia | 0 filas |
| Un vendedor descarta, otro lo ve | Lo ve | Lo ve |
| Otro intenta editar ese descarte | 0 filas | 0 filas |
| Descartar a nombre de otro | Rechazado | `42501` |
| Descartar dos veces el mismo punto | Rechazado | `23505` |

**Pantalla `/buscar`:** categorías del negocio traducidas a tipos de Google, búsqueda por
cercanía con radio o por texto libre, resultados ordenados por distancia con su semáforo,
selección múltiple con alta en lote, y descarte con motivo.

### Limitaciones conocidas de este tramo

- **20 resultados por búsqueda**, no 60. La API nueva de Places no pagina en `searchNearby`.
  Para cubrir un área grande hay que trocearla, que es lo que §7.4 ya anticipaba para vías
  urbanas.
- **No se puede marcar "ya es cliente"**: ese estado sale del maestro de Zoho y la
  integración no existe. Un vendedor todavía puede prospectar a un cliente de la casa.
- **Las categorías de Google no son las del negocio.** `convenience_store` mezcla pulpería y
  minisúper. La traducción está en `src/lib/catalogos.ts` y hay que revisarla con los
  vendedores.
- **Los motivos de descarte son propuesta**, como lo fueron los de resultado de visita.

---

## Plan v2, Etapas 1 y 2 — 2026-08-21

El plan vigente está en [08-plan-v2.md](08-plan-v2.md).

### Etapa 1 — Vocabulario y modelo de cuentas

`prospectos` → `cuentas`, `visitas` → `seguimientos`, campo `tipo` prospecto/cliente, y la
etapa mudada de la cuenta a la oportunidad (D-011). Trece pantallas, rutas y menú.

Verificado: los datos sobrevivieron el renombrado, `buscar_duplicados` y `estado_de_puntos`
siguen respondiendo, y la auditoría registra el paso `prospecto -> cliente`.

### Etapa 2 — La cuenta completa

| Pieza | Estado |
|---|---|
| Catálogo abierto de categorías, global | Hecho |
| Volumen de venta alta/media/baja | Hecho |
| Ubicación en texto: dirección y poblado | Hecho |
| Cuentas sin coordenadas: aviso y pantalla para ubicarlas | Hecho |
| Días desde el último contacto y hasta el próximo compromiso | Hecho |
| Cadencia objetivo por cuenta | Hecho |

**La cadencia no estaba pedida.** Se agregó porque "días sin contacto" por sí solo no dice
si algo está bien: 20 días sin ver a un restaurante que recompra cada 15 es una alarma; a
una oficina que compra cada tres meses, es normal. La cadencia es contra qué se mide, y es
la versión trabajable del umbral de dormido de §6.

**La vista `cuentas_resumen` lleva `security_invoker = true`.** Sin eso correría con los
permisos de quien la creó y saltaría el RLS de las tablas de abajo, dejando que cualquier
vendedor viera la cartera completa. Verificado: otro usuario ve cero filas.

| Prueba | Esperado | Resultado |
|---|---|---|
| Otro usuario consulta la vista | Ve 0 | Ve 0 |
| El vendedor ve las suyas con días calculados | Correcto | 1 día sin contacto, 6 hasta el compromiso |
| Fuera de cadencia sin cadencia definida | Nulo | Nulo |
| Categoría duplicada con otra caja | Rechazada | `23505` |
| Un vendedor agrega categoría, otro la ve | La ve | La ve |
| Cadencia de 400 días | Rechazada | `23514` |

---

## Plan v2, Etapa 3 — Filtros y colorización — 2026-08-21

**Un solo motor de filtros para la lista y el mapa.** Si cada vista tuviera el suyo, en tres
meses filtrarían distinto por el mismo criterio y nadie sabría cuál creer. Vive en
`src/lib/filtros.ts` como funciones puras, sin React de por medio.

**Lista y mapa son la misma pantalla con un botón de vista**, no dos pantallas. Cambiar de
vista no pierde los filtros.

### Filtros disponibles

Nombre · tipo de cuenta · volumen · producto de interés · tipo de comercio · poblado ·
vendedor · sin contacto hace más de N días · con compromiso en los próximos N días · fuera
de cadencia · potenciales · sin ubicación.

Las opciones de tipo de comercio y poblado **salen de los datos**, no de una lista fija: si
nadie usó una categoría, no se ofrece como filtro.

El filtro por vendedor **solo aparece para quien ve a más de una persona**. A un vendedor,
filtrar por sí mismo no le dice nada.

### Colorización (D-013)

Solo en el mapa. Cuatro dimensiones: tipo de cuenta, volumen, días sin contacto y vendedor.

La de días usa una gama de ámbar claro a rojo oscuro **calculada sobre el rango real de lo
que se está viendo**. Una escala fija haría que en una cartera fresca todo se viera igual de
claro y no se distinguiera nada.

**La leyenda no es opcional:** sale de la misma función que decide los colores, para que no
se pueda olvidar. Es lo que mantiene la regla de §17 dentro de la excepción.

Dos decisiones de detalle que cambian el resultado:

- **Nunca contactada cuenta como "hace mucho"**, no como nulo. Es el caso más urgente, y
  tratarlo como dato faltante lo escondería justo del filtro que lo busca. En el mapa se
  pinta del tono más oscuro.
- La paleta de vendedores usa tonos que **no se confunden con el semáforo de estados**.

### Detección de cadenas

Dos piezas con costos muy distintos, y por eso separadas.

**La insignia es gratis y automática.** Si dos resultados de la misma búsqueda comparten
nombre, se marcan solos con "Cadena · N aquí". No consulta nada: compara lo que ya está en
pantalla. La comparación normaliza acentos, puntuación y el número de sucursal del final,
para que "Minisúper La Esquina 2" cuente igual que "Minisuper la esquina".

Salta poco, y es esperable: dos sucursales rara vez caen en el mismo pueblo. Donde sí
funciona es cuando el líder busca por marca, que es el cuarto modo de búsqueda de §7.4.

**El conteo nacional cuesta una consulta y va escondido.** El botón *¿Tiene más
sucursales?* vive dentro de la ventana del pin, en el mapa. Para llegar ahí el vendedor ya
miró el mapa y tocó ese punto: es un gesto deliberado, no algo que se toca de paso en
veinte filas. El resultado queda en memoria durante la sesión, así que tocarlo dos veces no
gasta dos consultas.

El nombre es una pregunta y no una promesa a propósito: la app no sabe la respuesta hasta
que consulta.

**Lo que este conteo no hace:** Google agrupa por nombre, no por dueño. Un grupo comercial
con tres marcas distintas no se detecta así — eso es §7.9, la cadena marca → sociedad →
directores, y es otro módulo.

### Lo que se conservó al reescribir el mapa

La función de tocar un local de Google y agregarlo como cuenta vivía en el componente viejo.
Se trasladó al nuevo antes de borrarlo: perderla habría sido un retroceso sobre algo ya
probado en la calle.

---

## Correcciones sobre la Etapa 3 — 2026-08-21

Tres defectos que encontró el negocio usando las pantallas, más uno que salió al buscarlos.

### El mapa en blanco en la primera carga

**Síntoma:** el mapa no aparecía al abrir la aplicación y sí al volver después de navegar.

Se persiguió con dos hipótesis equivocadas —el alto del contenedor y las librerías
desalineadas entre proveedores— antes de montar una página de diagnóstico temporal sin
sesión para poder ver la consola. Ahí salió la causa en una línea:

```
TypeError: google.maps.Size is not a constructor
```

La función del ícono comprobaba que existiera `google.maps` antes de usar `Size` y `Point`,
pero **esas clases pertenecen a la librería `core`, que Google carga aparte y más tarde**. El
objeto ya está, las clases todavía no. La excepción tumbaba el subárbol entero del mapa, y en
la segunda visita ya no ocurría porque la librería estaba cargada.

Corregido en dos capas: la función comprueba las clases y no el objeto que las contiene, y
los marcadores no se dibujan hasta que `useMapsLibrary("core")` resuelve.

**La lección de método, que valía más que el arreglo:** dos hipótesis razonables fallaron
seguidas porque no se podía observar el fallo. Una página de diagnóstico desechable costó
diez minutos y dio la respuesta exacta.

### Filtrar y colorear estaban mezclados

Competían en la misma vista y no se podía usar ninguna. Ahora son dos pestañas del mismo
panel: *Qué se ve* y *Cómo se colorea*. Las dimensiones de color pasaron de cuatro a siete y
son **las mismas variables que se pueden filtrar**: si se pudiera colorear por algo que no se
puede filtrar, habría dos vocabularios para la misma cartera.

### El filtro de poblado parecía no existir

No faltaba: lo escondía la regla de que las opciones salen de los datos, y ninguna cuenta
tenía poblado. Un filtro invisible es un filtro que nadie descubre. Ahora el grupo se muestra
siempre y explica cómo llenarlo. Mismo arreglo para tipo de comercio.

### El estado de los filtros se perdía al navegar

Corregir cuentas incompletas obligaba a rearmar el filtro después de cada una. Los filtros
pasaron a vivir en la dirección (D-014), el botón Volver usa el historial, y el expediente
tiene un enlace *Ver en el mapa* que abre el mapa centrado en esa cuenta.

---

## Estado de la documentación — 2026-08-21

Auditada contra el esquema real. `02-modelo-datos.md` y `03-seguridad-rls.md` seguían
describiendo `prospectos` y `visitas` dos etapas después del renombrado: se reescribieron
completos contra `information_schema` y `pg_policies`, no de memoria.

`05-modulos/7.1` recibió el vocabulario nuevo con una nota de qué cambió y por qué.

Se agregó a `CLAUDE.md` la regla que faltaba: **los documentos de referencia se actualizan en
el mismo empujón que el código.** La regla anterior solo obligaba a tocar `07-estado.md`, y
por eso las referencias se desfasaron sin que nada avisara.

---

## Plan v2, Etapa 4 — Seguimientos — 2026-08-21

Migración `20260822034428_accion_del_compromiso`: `compromisos.tipo_accion`.

**Por qué hizo falta un campo nuevo.** El compromiso guardaba qué hacer en texto libre y
cuándo. Con eso no se puede armar lo que pide el negocio —"las llamadas de hoy", "las visitas
vencidas"— porque habría que leer cuarenta frases. El tipo de acción tiene que ser un dato.

**La pantalla.** Filtra por acción —visita, llamada, WhatsApp, correo, muestra— y por ventana
de tiempo: vencidos, hoy, próximos tres días, todos, o un rango elegido. Los vencidos van
primero y en rojo.

**El botón cambió de significado, y es el cambio de fondo de la etapa.** Antes decía *"Ya lo
hice"* y solo marcaba el compromiso como cumplido. Ahora dice **Registrar** y abre la captura
de seguimiento: al guardar, cierra el compromiso que lo motivó y crea el siguiente en el
mismo gesto.

La diferencia importa: *"ya lo hice"* se podía tocar sin dejar rastro de qué pasó, y el
sistema perdía el hecho. Ahora **cumplir un compromiso es registrar qué ocurrió**, que es el
principio rector de §1 aplicado a la agenda.

Al registrar el próximo paso se elige también qué acción será, no solo el texto y la fecha.

| Prueba | Esperado | Resultado |
|---|---|---|
| Compromiso sin acción declarada | Por omisión `visita` | Correcto |
| Fijar acción y filtrar por ella | Devuelve solo esa | 1 llamada |
| Cerrar uno y encadenar el siguiente | 1 cerrado, 1 pendiente | Correcto |

**El día se calcula en el servidor, en hora de Panamá.** Si lo calculara el navegador, un
celular con el huso mal puesto mostraría los vencidos de otro día.

---

## Plan v2, Etapa 5 — Oportunidades — 2026-08-21

Migración `20260822035849_oportunidades_completas`.

| Pieza | Estado |
|---|---|
| Nombre de la oportunidad | Hecho |
| Fecha estimada de cierre | Hecho |
| Bitácora de avance con fecha y hora | Hecho |
| Seguimientos ligados a la venta | Hecho |
| Bloqueo por fecha vencida | Hecho |

**La bitácora se agrega, no se edita.** Un campo de texto único se sobrescribe y pierde la
historia. Así queda el rastro de cómo evolucionó la negociación, que es exactamente lo que
hay que mirar cuando una oportunidad lleva dos meses en `negociacion` — la etapa ancha de
D-005 se vuelve legible por su bitácora.

### Una excepción que agregué a la regla del vencimiento

El requerimiento decía que una oportunidad vencida no se puede actualizar hasta mover la
fecha. Implementado tal cual, **registrar una venta perdida obligaría a inventarle primero
una fecha futura de cierre**: mentir para poder decir la verdad.

El trigger permite dos cosas con la fecha vencida: **cerrarla como ganada o perdida**, y
borrarla lógicamente. Todo lo demás sigue congelado.

Queda a confirmación del negocio; si prefieren la regla sin excepciones, es quitar cuatro
líneas del trigger.

| Prueba | Esperado | Resultado |
|---|---|---|
| Vencida: editar el monto | Rechazado | `23514` con mensaje en español |
| Vencida: mover la fecha al futuro y editar | Permitido | Correcto |
| Vencida: marcarla perdida | Permitido, por la excepción | Correcto |
| Con fecha futura: editar libremente | Permitido | Correcto |
| Editar una nota de bitácora | 0 filas | 0 filas |
| Seguimiento ligado a la venta | Queda ligado | Correcto |

---

## Ciclo de vida de la cuenta — 2026-08-22

Dos migraciones: `20260822134935_ciclo_de_vida_cuenta` y `20260822135652_motivo_sin_interes`.
Aplicadas y verificadas en `sgv-pacsa-dev`.

Sale de cuatro observaciones del negocio sobre las pantallas de las Etapas 4 y 5. Las cuatro
apuntaban al mismo hueco: **el sistema no distinguía entre planear e informar**, y por eso
obligaba a inventar hechos para poder usar los formularios.

### 1. La cuenta nace como potencial (D-015)

`tipo_cuenta` pasa de dos valores a cuatro:

    potencial → prospecto → cliente
                  ↘ descartada

Una cuenta creada desde el mapa, en la oficina, no es un prospecto: nadie la ha visto. Nace
`potencial` y el primer seguimiento la resuelve. La clasificación se presugiere según el
resultado —los resultados terminales proponen descartarla, con su motivo ya elegido— pero la
decide el vendedor, no un automatismo.

Descartar **no borra**: la cuenta conserva su visita y su motivo, y sale de la cartera del día
salvo que se active "Mostrar descartadas".

`motivo_descarte` gana el valor `sin_interes`, que faltaba: el caso más común de una primera
visita fallida no tenía dónde caer y terminaba en "otro".

### 2. Registrar y programar se separan (D-016)

| Pantalla | Qué es | Dónde vive |
|---|---|---|
| Registrar seguimiento | Contar qué pasó, cuando ya pasó | `/cuentas/[id]/seguimiento` |
| Programar seguimiento | Agendar qué se va a hacer | `/cuentas/[id]/programar` |

El compromiso programado lleva `visita_id` nulo. Los dos aparecen juntos en Seguimientos, que
es donde se ejecutan.

### 3. El próximo paso deja de ser obligatorio en tres resultados (D-017)

`local_cerrado`, `no_usa_productos` y `sin_interes` —y la cuenta que se acaba de descartar—.
Si se llena, sigue necesitando fecha: o los dos campos o ninguno.

### 4. Las coordenadas son un dato de la cuenta (D-018)

Editables en *Editar datos*, junto a dirección y poblado, por tres caminos: escribirlas,
"Estoy aquí", o marcarlas en el mapa. Se valida que vayan completas y dentro de rango.

El check-in del seguimiento sigue siendo lo que era —dónde estaba el vendedor— y **solo se
pide cuando la interacción es una visita**. Antes se pedía siempre, incluso en una llamada.

### El alta ahora tiene dos botones

- **Crear y registrar visita** — está frente al local; sigue derecho al seguimiento.
- **Crear solamente** — la está poniendo en el mapa para ir después; queda como potencial.

Los dos crean la misma cuenta. Lo que cambia es a dónde lleva.

### El orden del formulario de seguimiento

Intención → check-in (solo si es visita) → resultado → clasificación (solo si estaba sin
clasificar) → notas → proveedor y precio → evidencia → próximo paso.

La intención va primero porque decide el resto de la pantalla.

### Filtros

- `soloSinClasificar` se renombró a `soloSinCategoria`, etiquetado **"Sin categoría"**. Antes
  significaba "sin tipo de comercio" y chocaba de frente con el nuevo tipo de cuenta.
- El filtro de tipo de cuenta ahora ofrece los cuatro valores; «Potencial» es la cola de
  trabajo.
- Atajo nuevo: **"Mostrar descartadas"**.
- La colorización por tipo ofrece cuatro colores y la leyenda solo nombra los que están en
  pantalla.

### Verificación contra `sgv-pacsa-dev`

| Prueba | Esperado | Resultado |
|---|---|---|
| Valores del enum `tipo_cuenta` | Los cuatro, en orden | Correcto |
| Valor por omisión de `cuentas.tipo` | `potencial` | Correcto |
| Descartada sin motivo | Rechazada | `check_violation` |
| Prospecto con motivo | Rechazado | `check_violation` |
| Descartada con motivo | Aceptada | Correcto |
| Cuenta simple | Nace `potencial` | Correcto |
| `cuentas_resumen` rehecha | Existe con `security_invoker=true` | Correcto |
| La vista con un usuario ajeno | 0 filas | 0 filas |
| La vista con el vendedor dueño | Sus 4 cuentas, con días calculados | Correcto |
| Política `cuentas_admin_clientes` y `estado_de_puntos` | Rehechas tras el cambio de tipo | Correcto |

`tsc --noEmit`, `eslint` y `next build` limpios. Las catorce rutas compilan.

### Un hueco que quedaba de la Etapa 4

En el expediente sobrevivía un botón **"Ya lo hice"** que cerraba el compromiso vigente sin
registrar nada. La Etapa 4 lo había reemplazado en la pantalla de Seguimientos, pero no aquí.

Era exactamente la puerta que §1 no permite: se podía tocar sin dejar rastro de qué pasó, y
el sistema perdía el hecho. Ahora lleva al mismo formulario de seguimiento, con el
compromiso en la dirección; al guardar se cierra ese y se encadena el siguiente.

### Lo que no pude verificar yo

**Las pantallas autenticadas.** El servidor de desarrollo levanta y la pantalla de entrada
carga sin errores de consola ni de servidor, pero entrar exige una contraseña y no capturo
credenciales. Falta que el negocio recorra en el celular: crear una cuenta por los dos
caminos, clasificarla desde el primer seguimiento, descartarla y verla desaparecer del mapa,
programar un seguimiento sin registrar nada, y corregir las coordenadas de una cuenta.

### Pendiente de decisión del negocio

Sigue abierta la excepción de la Etapa 5 —cerrar una oportunidad vencida como ganada o
perdida sin mover la fecha— y ahora se le suma D-017, que es la misma idea aplicada al
próximo paso: no obligar a inventar una fecha futura para poder registrar un final.

---

## Alto de diseño: de registro a inteligencia — 2026-08-22

Antes de arrancar la Etapa 6, gerencia pidió un alto para replantear **para qué existe el
sistema**. No se escribió código: la sesión completa fue de diseño, y produjo tres documentos.

**El cambio de enfoque.** Lo construido es un sistema de registro. El objetivo pasa a ser un
sistema de **inteligencia**: que la empresa entienda qué está pasando en el mercado y pueda
decidir con eso. Las dos cosas a la vez — arma operativa para el vendedor, fuente de
estrategia para la empresa.

**El principio del que cuelga todo:** la inteligencia no se extrae, se intercambia. Solo se
sostienen las capturas donde el interés del vendedor coincide con el de la empresa: el
registro de logística (su coartada) y la razón del rechazo (su munición y su defensa).

### Documentos producidos

| Documento | Qué contiene |
|---|---|
| `docs/09-medicion-y-gestion.md` | El análisis: doble medición de caza y cuidado, tres oficios distintos, por qué no un número único, cobertura. |
| `docs/10-concepto.html` | El concepto acordado, para leer de corrido. |
| `docs/11-diseno-operativo.html` | La semana como máquina: pantallas con dueño y momento, qué calcula el sistema solo, los seis obstáculos. |
| `docs/12-flujo-vendedor.html` | El ciclo del vendedor con bocetos de pantalla. Reescrito limpio al final de la sesión. |

### Decisiones de organización que tomó gerencia

- **El líder responde a los dos vendedores; gerencia responde solo al líder.** Gerencia lee a
  los tres pero no le escribe a un vendedor: la primera vez que lo haga, el líder queda como
  copia. Acompañamiento inicial de seis semanas, con fecha de vencimiento explícita.
- **El líder entrega plan y reporte hacia arriba**, igual que los otros dos. Si exige algo que
  él no hace, es control y así lo van a leer.
- **El viernes es su día de administración** — está pagado para eso, y es el compromiso que
  hace viable todo el ciclo.
- **Esto no reemplaza la reunión:** acompaña a una llamada corta semanal.
- Tres compromisos de gerencia: **24 horas hábiles** para lo que desbloquea, **ninguna semana
  sin respuesta**, y **una decisión visible por trimestre** atribuida al dato que ellos
  levantaron. Con **doce semanas de piloto** y revisión.

### Diseño del vendedor que quedó cerrado

- Cinco pantallas: **Agenda · Listas · Cuentas · Mapa · Oportunidades**. Cuentas deja de ser
  el inicio; Buscar se mete en el Mapa; Seguimientos desaparece de la barra y su contenido se
  muda a Agenda.
- **Agenda** es la pantalla de todo el día, con tres grupos: paradas, llamadas y correos, y
  esperando respuesta. El cierre semanal es un formulario, no una pantalla.
- **Listas** son paquetes de potenciales por zona, permanentes. Lo que tiene período es el
  compromiso de trabajarlos.
- **El plan reparte rutas por día** y se apuesta **por cantidad, no por nombre**.
- **Solicitudes** es el carril de lo que entra —pedido, cotización, muestra, precio— con campo
  de *quién lo resuelve*: él con su talonario, o la oficina. Conecta con §7.2.
- **Una cuenta puede colgar de otra**: Starbucks es un cliente con diez puntos. Cadencia por
  sucursal, y la madre lleva la suya. El vendedor cuelga las suyas; el líder puede colgar
  cualquiera, que es lo que resuelve la cadena que cruza territorios.
- **El día que se cae se registra como bloque de jornada**, y la expectativa se lee contra
  días vendibles, no contra la semana del calendario.
- Cuatro números distintos de los mismos hechos: interacciones, cuentas tocadas, cuentas
  puestas al día, compromisos cumplidos. **Se apuesta en cuentas; el esfuerzo se mide en
  interacciones.**

### Dos huecos encontrados en lo ya construido

1. **La cadencia se reinicia con cualquier seguimiento**, incluido "no estaba el encargado".
   Permite refrescar la cartera pasando por el frente sin hablar con nadie. Debe reiniciarse
   con **contacto efectivo**.
2. **El modo sin conexión sube de prioridad.** La captura ocurre justo donde no hay señal —el
   bloque de jornada manejando de Natá, el seguimiento en un local con techo de zinc—. Deja de
   ser el remate del plan y pasa a ser requisito de la primera etapa.

### Lo que queda pendiente

- **El líder**: su ciclo no se ha revisado todavía. Es lo siguiente.
- **Gerencia y administración**: tampoco.
- Los catálogos que solo salen de sentarse con los vendedores: tipos de bloque de jornada,
  razones de rechazo con sus palabras, y qué resultados cuentan como contacto efectivo.
- Categorías direccionables, para que la cobertura no se mida contra un denominador infinito.
- Quién ve qué, antes de escribir las políticas de RLS.

---

## Etapa 6 — El tiempo del vendedor y la competencia — 2026-08-23

Primera etapa después del replanteamiento de diseño. Tres migraciones aplicadas y
verificadas en `sgv-pacsa-dev`.

Va primero por una razón práctica: **todo indicador necesita historia**. Si se construyen los
reportes antes que la instrumentación, el tablero abre vacío y quema su credibilidad en la
primera semana. Al revés, el día que abra ya tiene semanas adentro — y esas primeras semanas
son las que van a fijar las bandas de expectativa.

### `20260823213716_ajustes_del_replanteamiento`

Cuatro huecos que se encontraron revisando el flujo de cada rol contra lo construido:

| Arreglo | Por qué |
|---|---|
| `resultado_visita` += `compro` | El mejor resultado posible de una visita no tenía dónde registrarse. Sin él, las ventas se iban a registrar como "dejó información" |
| `tipo_interaccion` += `reunion` | Es la unidad de avance del líder. Contarla como visita la mezcla con pasar por un minisúper |
| `compromisos.oportunidad_id` | La agenda está hecha de compromisos, y un renglón que dice "Banco Aliado" no distinguía si era por los rollos o por las bolsas |
| `cuentas.cuenta_madre_id` y `tipo_punto` | Starbucks es un cliente con diez puntos, no once clientes. Y su matriz es una oficina, no una tienda: no entra a rutas de reparto |

### `20260823213719_jornada`

Tabla `jornadas` con RLS en la misma migración (§16). Seis tipos de bloque —viaje por
mercancía, entrega, entrega urgente, no se pudo salir, administrativo, personal— y dos
duraciones, media o completa.

**Grueso a propósito.** La pregunta de negocio es si la logística se come el 30% o el 60% de
la semana, no una planilla de nómina. De aquí salen **los días vendibles**: cinco menos lo
que se fue en otra cosa, y la expectativa se lee contra ese número.

La excepción de UPDATE —corregir solo el bloque de hoy— es deliberada: sin ella, un "media
jornada" mal puesto queda mal toda la semana y el vendedor deja de registrar.

### `20260823214153_inteligencia_competencia`

- Enum `motivo_competencia` con ocho valores. **Provisional**: el negocio pidió arrancar con
  una lista propuesta para poder mostrar la aplicación funcionando, y afinarla después con
  los tres vendedores usando sus palabras.
- Tabla `competidores`, catálogo abierto y global como `categorias_comercio` (D-012).
- `seguimientos.motivos_competencia` en arreglo: casi nunca es una sola razón.

**Por qué el catálogo y no texto libre:** "el chino", "chino de la esquina", "Distribuidora
Wang" y "wang" son cuatro filas que no se pueden sumar. Sobre texto libre no se construye
inteligencia de competencia.

### Pantallas

| Pieza | Dónde |
|---|---|
| Registrar jornada | Botón en Inicio, se despliega en el sitio |
| Tu semana | Tarjeta en Inicio con los bloques y los días vendibles restantes |
| Ficha de competencia | Dentro del seguimiento, **solo** con `quiere_precio`, `stock_suficiente` o `sin_interes` |
| Clasificación a cliente | El resultado `compro` sugiere `cliente`, no prospecto |

La ficha es condicional a propósito: pedirla en toda visita duplicaría el tiempo de captura y
enseñaría al vendedor a elegir resultados que no la disparan, que es exactamente cómo se
corrompe un catálogo.

### Verificación contra `sgv-pacsa-dev`

| Prueba | Esperado | Resultado |
|---|---|---|
| Enums nuevos y valores agregados | Los cuatro | Correcto |
| `compromisos.oportunidad_id` | Existe | Correcto |
| `cuentas.cuenta_madre_id` y `tipo_punto` | Existen | Correcto |
| RLS activo en `jornadas` | Sí, 5 políticas | Correcto |
| Un usuario ajeno consulta jornadas | 0 filas | 0 filas |
| El dueño consulta las suyas | Las 2 | Correcto |
| Corregir la jornada de hoy | Permitido | 1 fila |
| Corregir la de ayer | Bloqueado | 0 filas |

`tsc --noEmit`, `eslint` y `next build` limpios.

### Lo que falta de esta etapa

- **Cola de sincronización con reintento.** La captura ocurre justo donde no hay señal: el
  bloque de jornada se registra manejando de Natá, el seguimiento dentro de un local con
  techo de zinc. No hace falta una arquitectura offline completa — basta con guardar en el
  dispositivo y reintentar, con indicador visible. Los identificadores ya se generan en el
  cliente precisamente para esto.
- **Pedido dentro del resultado `compro`.** Hoy el resultado existe y clasifica a cliente,
  pero el pedido —qué llevó, cuánto, quién lo factura— llega con Solicitudes.
- Validar el catálogo de motivos y el de tipos de jornada con los tres vendedores.

---

## Listas, cadenas, solicitudes y cola de sincronización — 2026-08-23

Segundo empujón del día. Cuatro piezas y tres migraciones más.

### Listas — `20260823214958_listas`

Los paquetes de potenciales, por zona y por objetivo. Resuelven dos cosas a la vez:

1. **Que los potenciales no ahoguen la cartera.** Cincuenta puntos escogidos un domingo hacían
   ilegible la lista de treinta cuentas reales. Un potencial y una cuenta son objetos económicos
   distintos —el potencial es abundante y desechable, la cuenta es escasa y permanente— y lo que
   había que separar era la superficie de trabajo, no el registro.
2. **Que exista el denominador del embudo.** Sin intención declarada, la pregunta *"trabajó
   50 potenciales y convirtió 10, ¿qué pasó con los 40?"* es incontestable.

Tabla de unión y no columna en `cuentas`: una cuenta puede estar en más de una lista, y la
fecha de entrada es dato — es lo que permite decir **"levantaste 60, tocaste 34"**, que es
calidad de planificación y no tasa de conversión.

`listas.clase` es lo que el vendedor **espera** al armarla; lo real sale de la fecha de cierre
de cada venta. Las dos conviven a propósito: sin la marca en la lista la mezcla solo se puede
mirar hacia atrás, y la mezcla es una decisión que se toma antes de empezar. **Cuando lo
esperado y lo real no coinciden, es un hallazgo de mercado, no un error de captura.**

El paquete es permanente y por zona. Contra el cementerio, `listas_resumen` cuenta cuántos
llevan más de dos meses esperando: la defensa no es vencerlo por la fuerza —Aguadulce sigue
siendo Aguadulce— sino mostrar la antigüedad.

Se llenan desde el mapa y la búsqueda con `?lista=`, y desde el expediente.

### Cadenas

Interfaz sobre el esquema de la etapa anterior. El vendedor cuelga las suyas; la cadena que
cruza territorios —la madre del líder, un punto del de ciudad, otro del interior— la engancha
el líder, que es quien las negocia. El duplicado ya lo ataja `buscar_duplicados`.

`tipo_punto` en Editar datos: la oficina de negociación no vende ni recibe entregas, y
marcarla como local la metería en las rutas de reparto.

### Solicitudes — `20260823215723_solicitudes`

El carril de lo que entra. **No es un seguimiento** —un seguimiento es algo que el vendedor
hizo o prometió— es un encargo con destinatario y con reloj. Conecta con la bandeja de
administración de §7.2, que estaba en la visión y no se había cruzado con el día del vendedor.

`resuelve` distingue los dos caminos reales: su talonario o la oficina. Registrar los dos
hace visible la **facturación manual**, que hoy no se ve por ningún lado.

Registrar una solicitud deja también el seguimiento: una acción, dos consecuencias.

**El reloj mide a los dos lados.** El cumplimiento de las 24 horas es visible para todos —si
los vendedores quedan medidos y la oficina no, esto es control con buena interfaz por mucho
que lo llamemos contrato.

### Cola de sincronización — `src/lib/cola.ts`

Se adelantó en el orden a propósito: protege todas las escrituras ya construidas, y lo que
venga después la hereda.

**No es una arquitectura sin conexión completa.** Cubre el caso que de verdad pasa —perder
la señal un rato— y no el que casi nunca pasa, trabajar días enteros desconectado. Guarda en
el dispositivo, reintenta al recuperar señal y al abrir, y avisa cuántos quedan.

Lo que la hace correcta es una decisión de §16 tomada el día uno: **los identificadores se
generan en el cliente**. Un reintento manda la misma fila con la misma llave, así que si la
primera sí llegó, la segunda choca contra la llave primaria (`23505`) y se descarta sin
duplicar nada.

Distingue *no llegó* de *llegó y la base dijo que no*: un rechazo por restricción o permiso
se descarta en vez de reintentarse mil veces, porque si no la cola se atasca y el contador de
pendientes deja de significar algo.

Conectada en: alta de cuenta, seguimiento, próximo paso, seguimiento programado, jornada y
solicitud. Todas las capturas de campo.

### Navegación por rol

Los tres oficios no son el mismo. El vendedor de ruta casi nunca abre Oportunidades —vende en
una o dos visitas, y eso es un pedido— así que no se gana un lugar permanente en su barra; al
líder sí. Administración solo ve su bandeja y el maestro. Buscar sale de la barra: es la
misma acción que el mapa con otra forma.

### Verificación

| Prueba | Esperado | Resultado |
|---|---|---|
| Un ajeno consulta listas, contenido y la vista | 0 filas | 0 filas |
| Un ajeno agrega a una lista ajena | Rechazado | `insufficient_privilege` |
| El dueño ve la suya y la vista cuenta bien | 1 lista, 1 cuenta | Correcto |
| Un ajeno consulta solicitudes | 0 filas | 0 filas |
| Cerrar una solicitud sin sello de fecha | Rechazado | `check_violation` |
| El reloj calcula horas | Sí | Correcto |
| Cola: guarda, detecta duplicado, avisa, sobrevive JSON corrupto | Sí | Correcto, probado en el navegador |

`tsc`, `eslint` y `next build` limpios; diecinueve rutas. Sin errores de consola ni de
servidor.

### Lo que falta

- **La Agenda**: la pantalla del día con paradas, llamadas y esperando respuesta, que
  reemplaza a Inicio y absorbe Seguimientos.
- **El cierre semanal y el contrato**: el lazo completo. Queda pendiente la decisión de
  grabar, transcribir, o las dos.
- El **pedido** dentro del resultado `compro`, que ahora puede apoyarse en Solicitudes.
- El ciclo de **administración**, que todavía no se ha diseñado.

---

## La Agenda y la visita verificada — 2026-08-23

### `20260823220605_visita_verificada`

La regla de qué cuenta como visita verificada, en un solo lugar. Se escribe al revés a
propósito — **una sola forma de aprobar, tres de no aprobar**:

> verificada = es visita **y** hay check-in **y** la lectura es buena **y** está cerca

Si solo se marcara "lejos del local", apagar la ubicación sería la salida fácil y el control
quedaría decorativo. Por eso `sin_gps` y la precisión mala tampoco aprueban.

Umbrales en funciones (`metros_para_verificar`, `precision_para_verificar`) y no dispersos por
el código: son provisionales —doscientos metros es punto de partida para el interior y puede
quedar corto en una plaza comercial— y cuando se afinen, se afinan en un solo sitio.

La distancia es Haversine sin PostGIS, igual que la validación de duplicados.

**Nada se bloquea.** Bloquear el registro tardío enseña a no registrar, que es mucho peor que
registrar tarde. Se marca, se cuenta y se ve.

### La Agenda

`/` deja de ser la cartera y pasa a ser la Agenda; la cartera se muda a `/cuentas`. El día
empieza en lo que hay que hacer, no en una lista para buscar.

**Pestaña Hoy** — tres grupos siempre a la vista:

| Grupo | Qué trae |
|---|---|
| Paradas | Compromisos de visita y entrega de muestra, vencidos y de hoy |
| Llamadas y correos | Todo lo demás, **sin importar el pueblo** |
| Esperando respuesta | Sus solicitudes pendientes, con las horas |

Los tres juntos porque el día se intercala: maneja, visita, visita, se estaciona a las diez y
media y hace tres llamadas. **Si a esa hora tiene que cambiar de pantalla para ver a quién
llamar, no llama** — y una llamada no tiene pueblo, así que no se reprograma por andar en
otra zona.

Cada renglón dice a qué venta pertenece, ahora que el compromiso hereda la oportunidad.

**Pestaña Mi semana** — los cuatro bloques en vivo, más las jornadas y el botón de
registrarlas. **La ve él antes que nadie**: el jueves descubre que le faltan seis clientes y
los visita el viernes, sin que el líder intervenga.

En Cuidado, la lista **con nombres** y no solo el porcentaje: un porcentaje se discute, ocho
clientes con nombre se trabajan el lunes por la mañana.

Y el aviso del GPS aparece sin acusar a nadie — *"si fue por señal o por registrar al final
del día, dilo en tu cierre"*. Registrar lejos del local no es una falta: es un hábito, y es
una conversación de veinte segundos.

### Navegación por rol, definitiva

| Rol | Barra |
|---|---|
| Vendedor | Agenda · Listas · Cuentas · Solicitudes · Mapa |
| Líder | Agenda · Listas · Ventas · Cuentas · Mapa |
| Gerencia | Agenda · Solicitudes · Ventas · Cuentas · Mapa |
| Administración | Solicitudes · Cuentas · Mapa |

### Verificación

| Prueba | Esperado | Resultado |
|---|---|---|
| Check-in encima del local, precisión 8 m | Verificada | Correcto |
| Check-in a 2 km | No verificada, marcada fuera del local | Correcto |
| Check-in encima con precisión de 2 km | No verificada | Correcto |
| Sin GPS | No verificada | Correcto |

`tsc`, `eslint` y `next build` limpios; veinte rutas. Sin errores de consola ni de servidor.

### Lo que queda

- **El cierre semanal y el contrato.** Es la pieza que cierra el lazo, y la única decisión
  abierta que la bloquea es grabar, transcribir, o las dos.
- El **pedido** dentro del resultado `compro`, que ya puede apoyarse en Solicitudes.
- El ciclo de **administración**.
- Validar con los tres vendedores los catálogos provisionales: tipos de jornada, motivos de
  competencia, y qué resultados cuentan como contacto efectivo.

---

## El cierre semanal y el contrato — 2026-08-23

La pieza que cierra el lazo. Con esto el ciclo completo existe:

> Él declara qué va a hacer. Quien lo acompaña responde con contexto y objetivos, sin
> reescribirle el plan. La semana siguiente el sistema pone lado a lado lo prometido y lo
> ocurrido. Y él comenta qué pasó.

### `20260823221111_cierre_semanal`

Tabla `cierres`, una por vendedor y semana.

**Los números se congelan.** Se guardan en `numeros` en vez de recalcularse a propósito: la
semana 34 tiene que seguir diciendo en diciembre lo que dijo en agosto. Si se recalcularan,
una cuenta descartada después cambiaría el pasado — y un histórico que se mueve solo no sirve
para comparar nada.

**Las tres preguntas son fijas**: qué te sorprendió, qué te frenó, qué necesitas de nosotros.
No una caja abierta: *"cuéntame la semana"* produce prosa, y en un mes es la misma frase
irrefutable e inútil. La tercera es la que devuelve algo.

**El trigger `cierres_protege_el_plan`** rechaza que quien no es el dueño toque los números,
las respuestas, el plan o la apuesta. Solo pasa la respuesta.

Está en la base y no en la pantalla porque es la regla que sostiene el esquema de abajo hacia
arriba: **si el plan se puede editar desde arriba deja de ser su plan**, y el vendedor aprende
a proponer lo que va a ser aprobado. Ahí se acabó la información. Un plan flojo con su nombre
encima es más útil que uno bueno impuesto.

### La decisión del dictado

Quedaba abierto grabar audio, transcribir, o las dos. **Se resolvió por una tercera vía: el
micrófono del teclado del celular.**

El vendedor toca el micrófono, habla, y el teléfono escribe. Cero infraestructura nueva, cero
servicio externo, y produce **texto que se puede buscar y agregar desde el primer día** — no
un audio que alguien tiene que escuchar. Y él ya sabe usarlo.

Si en el piloto resulta que la transcripción del teclado no alcanza, grabar audio es el paso
siguiente y no se pierde nada de lo hecho.

### Las pantallas

| Pantalla | Quién | Cuándo |
|---|---|---|
| `/cierre` | Vendedor | Jueves o viernes, cuatro pasos |
| `/contrato` | Líder y gerencia | Viernes, una respuesta por persona |

El cierre confirma los números —ya calculados, no escribe ninguno—, contesta las tres
preguntas, reparte las rutas en los cinco días con su cantidad, y envía.

**Se compromete por cantidad, no por nombre.** Cuál de los cincuenta va a ver lo decide
manejando; nombrarlos por adelantado sería precisión falsa, y el día que visite tres que no
estaban en la lista el sistema diría que incumplió.

El sistema sugiere la suma de lo repartido pero **el número lo escribe él**: en el momento en
que la aplicación lo proponga como meta, deja de ser su plan.

### La reconciliación

En Agenda · Mi semana, el lunes aparece solo: *"dijiste 20, tocaste 11"*, más la respuesta de
quien lo acompaña. **Nadie lo calcula.** Sin ese cierre automático del lazo, planificar es
redactar deseos.

### Verificación

| Prueba | Esperado | Resultado |
|---|---|---|
| Un ajeno consulta cierres | 0 filas | 0 filas |
| El dueño ve el suyo y edita su apuesta | Permitido | Correcto |
| Un tercero reescribe la apuesta | Rechazado | `check_violation` |
| Un tercero responde | Permitido | Correcto |
| Responder sin sello de fecha | Rechazado | `check_violation` |
| La apuesta quedó como la dejó el dueño | 30 | 30 |

`tsc`, `eslint` y `next build` limpios; veintidós rutas.

**Nota sobre la verificación:** la primera versión de esta prueba daba un falso negativo
porque `reset role` no limpia `request.jwt.claims`, así que `auth.uid()` seguía siendo el
dueño y el trigger dejaba pasar correctamente. Hay que limpiar el claim a mano para probar a
un tercero.

### Lo que queda

- El **pedido** dentro del resultado `compro`, apoyado en Solicitudes.
- El ciclo de **administración**.
- Validar los catálogos provisionales con los tres vendedores: tipos de jornada, motivos de
  competencia, y qué resultados cuentan como contacto efectivo.
- Los **umbrales**, que se fijan con cuatro a seis semanas de uso real y no desde la oficina.

---

## Lo que faltaba: pedido, venta, reprogramar, tablero y mercado — 2026-08-23

Cierra el inventario de lo diseñado y no construido.

### `20260823222720_reprogramar`

`compromisos.veces_movido`, contado por un trigger.

Reprogramar tiene que existir: si hoy no va a alcanzar, moverlo es más honesto que dejarlo
pudrirse como vencido, y si no puede moverlo aprende a ignorar la agenda entera. **Pero deja
rastro** — si fuera gratis, todo se empujaría para siempre y "vencido" dejaría de significar
algo.

El contador va en trigger y no en la pantalla: contar desde el cliente deja la puerta abierta
a mover por otro camino y que el contador no se entere. Y solo cuenta si de verdad cambió la
fecha — editar el texto o cumplirlo no es reprogramar.

A la cuarta vez la pantalla pregunta si la cuenta sigue viva. No es un castigo: uno movido
cuatro veces es señal de que o la cuenta no es real, o el plan no lo era.

### El pedido dentro de "Compró"

El resultado existía desde la Etapa 6 pero no capturaba nada. Ahora abre un bloque: qué se
llevó, cuánto, **quién factura** —su talonario o la oficina— y si se la dejó en el acto.

Nace como **solicitud de tipo pedido**, que es exactamente lo que es. Si lo factura él y ya la
entregó, el pedido nace cerrado: no hay nada que esperar de nadie. Si necesita factura fiscal,
sale a la bandeja con su reloj.

Con esto **la venta de la semana se ve sin esperar la factura**, y el bloque de Ventas del
cierre deja de estar vacío.

### Abrir una venta desde el seguimiento

Bloque condicional con `pide_cotizacion`, `quiere_precio` y `pide_muestra`. Opcional, y con la
regla escrita en la pantalla: *si vas a volver más de una vez por lo mismo, ábrela*.

**El formulario sigue siendo el mismo para los tres roles.** El vendedor de ruta lo ve y casi
siempre elige "se resuelve pronto"; el líder casi siempre la abre.

La venta hereda la línea de producto que la cuenta ya declaró — dejar todo en "otros" volvería
inútil el reporte por línea (§7.7). Y el próximo paso cuelga de la venta recién creada, que es
lo que hace que la agenda diga a qué venta sirve cada renglón.

### Cambiar el día

Cuando el día se cae, mover cinco paradas una por una es la fricción que hace que no se
muevan — y la agenda queda llena de vencidos falsos. Se mueven en bloque.

**Las llamadas se quedan**: no tienen pueblo y se hacen desde donde sea.

Y el motivo se pregunta en el mismo gesto. Si además perdió el día completo, se registra como
jornada: **mover el plan no gasta un día, perderlo sí**, y esa es la diferencia que decide si
la semana tuvo tres días vendibles o cinco.

### Ventas en marcha, por mes de cierre

La pantalla dejó de llamarse "Pipeline" —quedó del principio y no es la palabra del negocio— y
ganó una segunda vista.

**Por mes es la única que muestra el hueco.** Los meses vacíos entre el primero y el último se
dibujan a propósito: un mes sin nada no aparece solo, y en agosto ver que octubre está vacío
todavía deja tiempo de meter ventas rápidas que cierren a tiempo.

Las **sin fecha** van aparte: son invisibles para cualquier proyección y son las que se pudren
calladas.

Rápida o grande sale de la fecha de cierre, sin capturar nada. Y si empuja la fecha tres
veces, la venta pasa sola de rápida a grande — que es justo lo que está pasando.

### El Tablero

Tres cosas y ninguna más: si se cerró el ciclo, las excepciones, y el cierre del líder — el
único que gerencia lee completo.

**Lo que no hace importa tanto como lo que hace: no tiene dónde escribirle a un vendedor.** El
puesto de líder existe para que gerencia no tenga tres frentes; si el tablero ofrece la caja,
la tentación existe y en un mes el vendedor escribe para gerencia. La restricción va en el
producto, no en la buena intención.

Las excepciones que levanta hoy: no cerró la semana, menos del 70% de visitas verificadas,
cinco o más compromisos vencidos, **pidió algo y nadie le contestó**, y solicitudes pasadas de
24 horas.

Muestra excepciones y no todo. Un tablero que lo muestra todo tarda cuarenta minutos y deja de
abrirse.

### Mercado

La pantalla que hace que valga la pena capturar la competencia. **Sin ella el vendedor levanta
el dato tres meses, nunca ve que movió nada, y deja de levantarlo — con razón.**

Muestra por qué le compran al otro, quiénes nos ganan, el precio que pagan hoy, en qué
poblados y en qué tipos de comercio.

Con el recordatorio del compromiso que la sostiene: si esto no termina en una decisión
anunciada al equipo, van a dejar de capturarlo.

### Verificación

| Prueba | Esperado | Resultado |
|---|---|---|
| Mover la fecha dos veces | Cuenta 2 | Correcto |
| Editar solo la descripción | No cuenta | Correcto |
| Marcarlo cumplido moviendo la fecha | No cuenta | Correcto |

`tsc`, `eslint` y `next build` limpios; **veinticuatro rutas**. Sin errores de consola ni de
servidor.

### Lo que queda, ahora sí

- El ciclo de **administración**: la bandeja funciona, pero su día completo, el alta de
  clientes y la conciliación con Zoho no se han diseñado.
- El **informe mensual** de gerencia. Tiene sentido cuando haya un mes de datos.
- **Cobertura y espacios en blanco**, bloqueado por las categorías direccionables.
- El **conteo de clientes por cuenta madre**: el esquema ya distingue madre de punto, pero
  ninguna cifra usa la distinción todavía. Importa cuando exista el informe mensual.
- **Zoho**, y con él toda la mitad de retención.
- Validar los catálogos provisionales, y fijar los umbrales con datos reales.

---

## Cierre del día: navegación y documentos de inducción — 2026-08-23

**Un arreglo:** al meter Mercado en la barra del líder le había quitado el Mapa, que es donde
arma sus listas de zona. Mercado lo mira una vez al mes, así que sale de la barra y se llega
desde Agenda · Mi semana — igual que Contrato.

### La navegación, definitiva

| Rol | Barra |
|---|---|
| Vendedor | Agenda · Listas · Cuentas · Solicitudes · Mapa |
| Líder | Agenda · Listas · Ventas · Cuentas · Mapa |
| Gerencia | Tablero · Solicitudes · Mercado · Ventas · Cuentas |
| Administración | Solicitudes · Cuentas · Mapa |

Contrato y Mercado no tienen lugar propio para el líder: se usan uno y cuatro días al año
respectivamente, y una entrada permanente para eso estorba el resto del tiempo.

### Los tres documentos de flujo, al día

`docs/12`, `docs/13` y `docs/14` son el material con el que gerencia le va a presentar la
aplicación al equipo, así que se actualizaron con la navegación real y con una sección nueva
al final de cada uno: **qué de esto ya está construido**, marcado pieza por pieza.

Lo que queda marcado como pendiente en esos documentos:

- **Vendedor**: la Agenda todavía no dice "hoy toca Aguadulce" — el plan reparte por día en el
  cierre, pero hace falta que el primer ciclo dé la vuelta para tener de dónde leerlo. Y
  corregir la hora del seguimiento hacia atrás.
- **Líder**: clases de día en su plan, la apuesta por nombre para las ventas grandes, y marcar
  la venta estancada por días sin movimiento. Las tres son de su cierre y salen juntas.
- **Gerencia**: el informe mensual, y las dos partes bloqueadas por las categorías
  direccionables y por Zoho.

---

## Armar una lista de zona no funcionaba — 2026-08-23

Salió usándolo: crear la lista "Aguadulce" y tocar *Agregar puntos* llevaba al mapa de la
cartera, donde solo hay filtros y colorización. **No había forma de buscar Aguadulce.**

Tres errores encadenados, y uno estaba ahí desde antes.

### 1. El enlace iba a la pantalla equivocada

`/mapa` es el mapa de **su cartera**: muestra lo que ya es suyo. Lo que hacía falta es
`/buscar`, que es donde se encuentran puntos que todavía no lo son. Y el `?q=` que le pasaba
se ignoraba.

Ahora va a `/buscar?lista=<id>&q=<poblado>`, con el poblado prellenado y un aviso arriba que
dice qué lista se está armando, con enlace de vuelta. Sin eso se pierde el hilo: escoge veinte
puntos y no sabe a dónde van a caer.

La lista conserva además un enlace al mapa de la cartera —*ver la zona en el mapa*— filtrado
por ese poblado, que es otra cosa y también sirve.

### 2. La búsqueda por texto tiraba las categorías

Estaba así desde §7.4: en modo texto, las categorías elegidas arriba se ignoraban. Escoger
*Farmacia* y escribir *Aguadulce* buscaba solo "Aguadulce".

Ahora se combinan en una sola consulta: **"Farmacia y Panadería en Aguadulce"**. Era justo lo
que hacía falta para armar una lista de zona, y el campo lo dice mientras escribe.

### 3. Faltaba "Buscar en esta zona"

Es el gesto que uno espera de un mapa. Antes solo se podía buscar **alrededor del GPS**
—inútil para armar la lista de un pueblo al que todavía no ha ido— o por texto, que devuelve
veinte y se acabó.

Ahora el mapa de resultados lleva un botón que busca alrededor de donde uno está mirando. Con
eso se recorre un pueblo entero en tandas.

**Y el barrido acumula, no reemplaza.** Si cada barrido borrara lo anterior, moverse dos
cuadras perdería lo que ya marcó y recorrer un pueblo por tandas sería imposible. Se mezcla
por `place_id` porque los barridos se solapan y el mismo local sale dos veces.

El mapa tampoco se desmonta mientras busca: si desapareciera, volvería centrado en otro lado
y perdería el sitio que estaba mirando.

### Lo que esto deja pendiente

Sigue sin poder **tocar un comercio cualquiera en el mapa de búsqueda** para agregarlo — eso
solo se puede en el mapa de la cartera. Con el barrido por zona el caso se cubre casi siempre,
pero si aparece la necesidad, es media hora.

---

## Seis cosas que salieron usándolo — 2026-08-23

Gerencia armó su primera lista de zona y encontró seis problemas. Uno era grave.

### El grave: todas las cuentas daban 404

`cuentas_resumen` se creó con `select c.*`, y **eso congela la lista de columnas al crear la
vista**. `cuenta_madre_id` y `tipo_punto` se agregaron a `cuentas` después, en
`20260823213716`, y la vista se quedó sin ellas.

El expediente pedía esas columnas, PostgREST devolvía error, la pantalla lo leía como "no
existe" y **404 en toda cuenta**. Ni `tsc` ni `eslint` ni el build lo delataban: el error solo
aparece contra la base real.

Arreglado en `20260823235831_arregla_vista_y_motivo`, y anotado como regla en
`03-seguridad-rls.md`: **toda migración que agregue una columna a `cuentas` tiene que rehacer
la vista** — y al rehacerla, `security_invoker` sigue sin ser opcional.

### El motivo que faltaba

`motivo_descarte` gana **`negocia_en_panama`** — "se negocia en Panamá, aquí no deciden".

El local existe y vende, pero no decide: la compra se acuerda en la casa matriz. Descartarlo
como "no le interesó" sería falso —sí interesa— pero no es la conversación del vendedor de
ruta. Y es más que un descarte: **es un hallazgo**. Un punto marcado así es cuenta del líder, y
agrupados dibujan qué cadenas hay que atacar por arriba en vez de local por local.

### La búsqueda parecía dos búsquedas

Categorías arriba, texto abajo, en tarjetas separadas. La pregunta *"¿a cuál le hace caso?"*
era la respuesta correcta a un diseño malo.

Ahora es una sola búsqueda en dos pasos: **1 · Qué buscas** (las categorías, que siempre
mandan) y **2 · Dónde** (escribiendo el área, o cerca de mí). Llegando desde una lista arranca
en "área", porque casi siempre es un pueblo al que todavía no ha ido.

### Los radios confundían

1, 3 y 5 km solo sirven estando en la zona. **Ahora solo aparecen dentro de "cerca de mí"**,
que es donde significan algo.

### El botón del mapa mentía

*"Buscar en esta zona"* traía de todo cuando no había categorías escogidas, y parecía un
control de Google. Ahora dice qué va a traer: **"Buscar farmacias aquí"** o **"Buscar de todo
aquí"**.

### El mapa de la lista abría vacío

Dos causas encadenadas. El enlace filtraba por poblado, y **el alta en tanda no le ponía
poblado a las cuentas** — así que el filtro no encontraba nada.

Las dos arregladas: las cuentas heredan el poblado de la lista al entrar, y el enlace ahora es
`/mapa?lista=<id>`, que filtra por pertenencia a la lista en vez de por zona. La pantalla
además dice cuántas hay y **cuántas llegaron sin coordenadas**, que es mejor que un mapa vacío
sin explicación.

---

## Los potenciales salían en la cartera — 2026-08-23

Segundo reporte del gerente armando Aguadulce, y el más de fondo: los potenciales levantados en tanda
aparecían en `/cuentas`. Proyectó el desenlace antes de sufrirlo —cien potenciales sin atender tapando
la cartera en un mes—.

Era D-015 aplicado a medias: se creó la superficie aparte para los potenciales y **no se los sacó de
la cartera**, así que caían en los dos lados.

| Qué | Dónde |
|---|---|
| `potencial` escondido por omisión | [src/lib/filtros.ts](../src/lib/filtros.ts) |
| Interruptor «Mostrar potenciales» | [src/components/panel-filtros.tsx](../src/components/panel-filtros.tsx) |
| Aviso con el conteo y enlace a Listas | [src/app/cuentas/page.tsx](../src/app/cuentas/page.tsx) |
| `lista` y `cuenta` sobreviven al panel | [src/lib/filtros.ts](../src/lib/filtros.ts), [src/components/cuentas-con-filtros.tsx](../src/components/cuentas-con-filtros.tsx) |
| El mapa de una lista pide los potenciales | [src/app/listas/[id]/page.tsx](../src/app/listas/[id]/page.tsx) |

Sin migración: es filtro de pantalla, no de esquema. Los potenciales siguen viviendo en `cuentas`
—ver D-019 para por qué no van en tabla aparte—. **Escondido no es oculto:** la cartera dice
cuántos hay y a dónde ir por ellos.

De paso salió un error que nadie había visto: en `/mapa?lista=X`, tocar un filtro borraba
`lista=X` de la dirección y aparecía la cartera entera (D-020). El arreglo del mapa vacío de
ayer se habría roto el mismo día.

**Una nota que quedó mal escrita y se corrige aquí.** Se sugirió que una lista con muchos sin
tocar señalaba un problema de tamaño. **No es así, y el modelo es al revés a propósito:** la
lista se alimenta del tamaño que se quiera —Aguadulce es Aguadulce y se levanta entero— y el
compromiso no está en la lista sino en **el plan de la semana**, donde el vendedor apuesta
cuántos va a tocar. Una lista larga no es deuda; es inventario.

Lo que sí mide `sin_tocar_hace_mucho` es **antigüedad**, no exceso: puntos que llevan meses en
la lista sin que nadie los mire. Eso se resuelve decidiendo en bloque —dejarlos o descartarlos
con motivo—, no achicando la lista.

---

## La leyenda de la búsqueda ahora cuenta — 2026-08-23

Pregunta de gerencia: si el vendedor levanta los potenciales de Aguadulce, ¿puede el líder entrar al
mapa de Aguadulce y ver cuáles fueron seleccionados y cuáles no, para verificar que el barrido
está completo?

**Ya se podía, y no hacía falta construir nada:** `estado_de_puntos` es `security definer` y
devuelve, para cada punto de Google, si hay cuenta, de quién es, y si fue descartado con qué
motivo y por quién. El líder corre la misma búsqueda y lee el mapa por colores.

Lo que faltaba era el número. **La leyenda ahora cuenta:** *«31 de otro vendedor · 5
descartados · 7 nuevos»*. Los verdes son los huecos. Antes había que contarlos a ojo.

De paso, `colorDe()` y la leyenda pasan a leer la misma función `situacionDe()`, para que el
color del pin y el número no puedan discrepar.

**Los límites, escritos para no pedirle de más:**

- Es **por categoría**. Si el vendedor barrió farmacias y el líder busca panaderías, todo sale
  verde y no prueba nada.
- Es una **foto, no un indicador**. No queda guardado ningún porcentaje de cobertura; hay que
  correr la búsqueda. Un número permanente exige antes la lista de categorías que cuentan como
  mercado nuestro — sigue pendiente y sigue bloqueando §7.5.
- **El gris es lo que hace justa la revisión.** Un descartado no es un hueco. Sin esa
  distinción el líder leería como pereza lo que fue trabajo hecho, y el vendedor aprendería a
  no descartar nada para no salir mal — el hábito que vacía la base.

---

## Los potenciales dicen desde cuándo esperan — 2026-08-23

Pedido de gerencia: en las listas, saber si un potencial se levantó anteayer o lleva medio año ahí.
Sin fecha se ven exactamente igual.

`listas_cuentas.agregada_en` ya se guardaba desde que se creó la tabla —*«la fecha de entrada
mide la calidad de la planificación»*, dice su comentario— pero no se mostraba en ninguna parte.

| Qué | Dónde |
|---|---|
| Cómo se dicen los plazos, en un solo lugar | [src/lib/fechas.ts](../src/lib/fechas.ts) |
| La ficha muestra la espera donde un cliente muestra su última visita | [src/components/ficha-punto.tsx](../src/components/ficha-punto.tsx) |
| La cabecera de «Sin tocar» dice cuántos llevan más de dos meses | [src/app/listas/[id]/page.tsx](../src/app/listas/[id]/page.tsx) |

Sin migración: el dato ya estaba.

**Tres cosas que no son obvias.**

1. **Ocupa el hueco de la última interacción**, que en un potencial sin tocar está vacío. La ficha no
   crece ni cambia de alto — §17 exige que se pueda escanear de un vistazo.
2. **A los 60 días se pone en ámbar**, que es el mismo umbral con que `listas_resumen` cuenta
   los viejos. Si no coincidieran, la lista diría «3 llevan mucho» y ninguna ficha se vería
   vieja.
3. **Cambia de unidad**: días, semanas, meses. «Esperando 97 días» obliga a restar de cabeza
   para saber si eso es mucho, y se lee al sol y con prisa.

De paso, `haceDias()` unifica el resto: la cartera y el mapa decían «Hace 97 días» del mismo
punto que la lista habría llamado «Hace 3 meses». Una sola forma de decir los plazos, por la
misma razón que hay un solo sistema de tokens.

---

## El reloj y el catálogo — 2026-08-24

Dos reportes de gerencia en la misma sesión de uso real. Los dos venían de lo mismo: **una
regla que se veía correcta al leerla.**

### «Hoy» no era hoy después de las 7 de la tarde

*«Acabo de crear en la tarde un registro, pero ahora parece que dice ayer.»* Eran las 7:55 p.m.
en Panamá.

La base corre en UTC y `current_date` ya decía 24. Las vistas restaban ese `current_date` de
una fecha convertida a Panamá: dos relojes en la misma expresión.

Comprobado contra `sgv-pacsa-dev` antes y después. El registro de las 7:16 p.m. pasó de
`dias_sin_contacto = 1` a `0`.

| Qué | Dónde |
|---|---|
| `hoy_panama()`, y `current_date` desterrado del esquema | [migración](../supabase/migrations/20260824012616_hoy_en_panama.sql) |
| `cuentas_resumen` rehecha —días sin contacto, días hasta el compromiso, fuera de cadencia— | ídem |
| La oportunidad vencida ya no se congela la noche de su propio vencimiento | ídem |

**Afectaba todas las noches**, y justo a la hora en que el vendedor cierra su día.

### El catálogo de tipos de comercio se llenaba de duplicados

*«Ahora tengo dos categorías de panadería, una con tilde en la i y otra sin la tilde.»* Y un
`mimisuper` que es un dedazo.

Tres causas, no una:

1. **El campo.** Era un `datalist`, que compara letra por letra: escribiendo «panaderia» no
   ofrecía «Panadería». El duplicado no lo creó un descuido, lo creó el campo (D-023).
2. **El índice único** comparaba `lower(trim(nombre))`, sin tocar los acentos.
3. **La cuenta nunca se alineaba con el catálogo**: `tipo_comercio` es texto libre, así que el
   catálogo decía «Panadería» y la cuenta decía «Panaderia».

| Qué | Dónde |
|---|---|
| `normalizar_texto()` y el índice único sobre él | [migración](../supabase/migrations/20260824013500_catalogo_de_categorias.sql) |
| `asegurar_categoria()` devuelve la grafía buena | ídem |
| `fusionar_categoria()` y `renombrar_categoria()`, que arrastran las cuentas | ídem |
| `puede_depurar_catalogo()` — líder **y** gerencia (D-022) | ídem |
| Vista `categorias_uso` con el conteo por categoría | ídem |
| Las categorías escritas en cuentas entran al catálogo | [migración](../supabase/migrations/20260824014500_categorias_de_las_cuentas.sql) |
| Campo con sugerencias propias, sin acentos, desde la primera letra | [campo-categoria.tsx](../src/components/campo-categoria.tsx) |
| Pantalla de depuración | [/categorias](../src/app/categorias/page.tsx), [depurar-categorias.tsx](../src/components/depurar-categorias.tsx) |
| `normalizar`, `distancia` y `parecidos` | [src/lib/texto.ts](../src/lib/texto.ts) |

La pantalla detecta parejas sospechosas por distancia de edición —«mimisuper» y «minisuper»
están a un cambio— y propone unirlas conservando la más usada. Se llega desde Cuentas, solo
si el rol es líder o gerente.

**Segunda vez en dos migraciones que una guardia falla en silencio.** El alta al catálogo
exigía un perfil con rol `gerente` para `created_by`, y en dev solo hay un vendedor de prueba:
no insertó nada y no avisó. Se corrigió tomando el autor de la cuenta que usa la categoría.

### Verificado contra `sgv-pacsa-dev`

| Prueba | Esperado | Resultado |
|---|---|---|
| `asegurar_categoria('panaderia')` | Devuelve «Panadería» | Devuelve «Panadería» |
| `asegurar_categoria('  PANADERÍA ')` | Devuelve «Panadería» | Devuelve «Panadería» |
| `asegurar_categoria('Ferretería')` | La crea y la devuelve | «Ferretería» |
| Un vendedor renombra una categoría | Rechazado | `42501: Depurar el catálogo es del líder o de gerencia` |
| El líder corrige «mimisuper» → «Minisuper» | Arrastra la cuenta | La cuenta dice «Minisuper» |
| El líder fusiona dos categorías | La sobrante desaparece | Desaparece |
| Insertar «panaderia» existiendo «Panadería» | Rechazado | `23505: categorias_nombre_unico` |

Todas dentro de transacciones revertidas: no dejaron rastro.

**Pendiente de verificar en pantalla:** las dos pantallas nuevas solo se pueden ver entrando
con usuario y contraseña. La comprobación de que `/categorias` redirige a `/entrar` sin sesión
sí se hizo.

---

## Cadencias: de cuatro a ocho, más una libre — 2026-08-24

Observación de gerencia editando una cuenta: entre mensual y trimestral no había nada, y
después de trimestral tampoco. Propuso además una fecha específica para los casos raros.

Las ocho opciones y el número libre están hechos. **La fecha específica no, y es deliberado**
(D-024): una cadencia es un ritmo que se repite, y una fecha ocurre una vez. Para «volver el 15
de marzo» ya está el próximo paso, que entra a la agenda; guardado como cadencia sería un dato
muerto dentro de la ficha.

| Qué | Dónde |
|---|---|
| Ocho cadencias sugeridas y los límites de la base | [src/lib/catalogos.ts](../src/lib/catalogos.ts) |
| Campo con «Otra» y número libre de días | [src/components/campo-cadencia.tsx](../src/components/campo-cadencia.tsx) |

Sin migración: `cuentas_cadencia_valida` ya aceptaba de 1 a 365 días.

El campo dice en meses lo que se escribe en días —«240 días · unos 8 meses»— porque «cada 240
días» no se entiende de un vistazo y el punto de escribirlo a mano es poder comprobarlo.

---

## La ficha dice dónde queda y de quién es — 2026-08-24

Dos observaciones de gerencia sobre la pantalla de Cuentas: qué significa el «sin calificar»
que sale en todas las tarjetas, y que con la cartera mezclada no se sabe si una cuenta es de
Aguadulce, de Chitré o de la lista de bancos.

**Lo primero era una promesa sin construir.** «Potencial 3/5» es el puntaje de §7.5, que se
calcula desde la facturación de Zoho y todavía no existe; el campo nunca llegó a la base, así
que la ficha decía «Sin calificar» en el cien por ciento de los casos. Ocupaba un tercio de la
tarjeta.

Ese hueco lo toma ahora lo que sí se sabe:

| Línea | Izquierda | Derecha |
|---|---|---|
| 1 | Nombre | Estado |
| 2 | Tipo de comercio | **Lista** a la que pertenece |
| 3 | **Zona** · **vendedor** | Última interacción o espera |

| Qué | Dónde |
|---|---|
| La ficha, sin `potencial` y con `zona`, `lista` y `vendedor` | [ficha-punto.tsx](../src/components/ficha-punto.tsx) |
| Las listas de cada cuenta se cargan con la cartera | [src/lib/cartera.ts](../src/lib/cartera.ts) |
| La cartera pasa los tres datos | [cuentas-con-filtros.tsx](../src/components/cuentas-con-filtros.tsx) |

**El vendedor solo aparece cuando hay más de uno a la vista.** A un vendedor mirando su propia
cartera no le dice nada, y ocuparía sitio en la línea donde va la zona.

**Filtrar por vendedor ya existía** —panel de filtros, y como dimensión de color en el mapa— y
también solo aparece cuando hay más de uno. Lo que faltaba era verlo **sin** filtrar: con tres
carteras mezcladas, saber de quién es cada tarjeta sin tener que abrirla.

En la pantalla de una lista se muestra la zona pero no la lista, que ya se sabe cuál es. Una
cuenta en varias listas muestra la primera y cuántas más: dos nombres no caben en esa línea.

**Pendiente de verificar en pantalla:** el cambio es de maquetación y solo se ve con sesión
iniciada.

---

## De «lead» a «potencial» — 2026-08-24

Cambio de vocabulario pedido por gerencia. Barrido completo: pantallas, esquema, código y
documentación. Ver D-025.

| Qué | Antes | Ahora |
|---|---|---|
| El término en toda la interfaz | lead / leads | potencial / potenciales |
| Estado de la cuenta | `sin_clasificar` | `potencial` |
| Columna del contrato semanal | `cierres.apuesta_leads` | `cierres.apuesta_potenciales` |
| Bandera de filtro | `incluirSinClasificar` | `incluirPotenciales` |
| El puntaje 1–5 de §7.5 | «potencial» | **«puntaje»** |

Tres migraciones: [el rename de la columna](../supabase/migrations/20260824021500_potenciales_en_vez_de_leads.sql),
[el del valor del enum](../supabase/migrations/20260824022000_tipo_potencial.sql) y
[el comentario del puntaje](../supabase/migrations/20260824022500_puntaje_no_potencial.sql).

**Lo delicado era el enum.** `alter type ... rename value` rompe cualquier vista o política que
guarde el literal en su definición; se comprobó antes contra `pg_policy` y `pg_views` que no
hubiera ninguna. Verificado después: el valor por omisión de `cuentas.tipo` quedó en
`'potencial'::tipo_cuenta` y las 12 cuentas de dev respondieron al nombre nuevo sin tocar
una fila.

**El choque que había que resolver.** «Potencial» ya significaba el puntaje 1–5 de §7.5. Se
renombró ese puntaje a «puntaje» antes de que exista, que es cuando sale barato.

`docs/00-vision.md` queda sin tocar, por la regla de siempre: es el levantamiento original.

---

## Los objetivos se escriben — 2026-08-24

El líder armó una lista de bancos, escribió «Banco General» y la aplicación le buscó las
sucursales en el mapa. No es lo que quería: **quiere llegar a alguien en la oficina central.**

Era un error de diseño, no un error de la búsqueda: le puse al líder la herramienta del
vendedor de calle. Ver D-026.

| Qué | Dónde |
|---|---|
| `origen = 'objetivo'` en el enum | [migración](../supabase/migrations/20260824030000_objetivos_sin_mapa.sql) |
| Formulario para escribir el objetivo | [agregar-objetivo.tsx](../src/components/agregar-objetivo.tsx) |
| La lista de objetivos no ofrece mapa ni búsqueda | [/listas/[id]](../src/app/listas/[id]/page.tsx) |
| La tarjeta dice qué falta averiguar | [ficha-punto.tsx](../src/components/ficha-punto.tsx) |

**El formulario se queda abierto al guardar.** Armar una lista de objetivos es escribir seis o
siete seguidos —Banco General, Banco del Istmo, BAC…— y cerrarlo en cada uno serían seis toques
de más.

**Los huecos son la tarea.** Donde una cuenta de zona dice su poblado, un objetivo dice *«Solo
tienes el nombre»* o *«Falta teléfono, correo»*. Cuando se completan, la línea desaparece sola:
esa es la señal de que ya se puede llamar.

### Verificado contra `sgv-pacsa-dev`

Creación completa como líder, en transacción revertida: lista de objetivos + cuenta + membresía.
La cuenta quedó `potencial · origen objetivo · tipo_punto oficina · sin_ubicacion true`, y
`cuentas_resumen` la devuelve correctamente unida a su lista.

**Pendiente de verificar en pantalla**, como siempre con lo que exige sesión iniciada.

---

## La identidad, corregida — 2026-08-24

Tres observaciones de gerencia sobre la primera versión de la barra de marca, y las tres eran
del mismo tipo: **la identidad estaba, pero en tamaño de nota al pie.**

| Qué estaba mal | Cómo quedó |
|---|---|
| «Papelería Comercial» a 12 px, más chico que el título de la pantalla | 18 px, **el mismo tamaño que «Agenda» o «Cuentas»** |
| Decía «SGV» a secas | `Sistema de Gestión de Ventas`, debajo del nombre del dueño |
| A la derecha el rol, que se leía como si fuera quién entró | A la derecha **quién entró**, su rol, y el botón de salir |
| Salir era un botón suelto en Agenda y en Cuentas | Vive en la barra, al lado de quién está dentro |
| Cuentas repetía nombre y rol en una tarjeta de perfil | Se quitó |

La barra pasa de 32 a 62 px. Es el costo de que se lea, y gerencia lo pidió sabiéndolo.

Verificado a 375 px con la marcación real: las cuatro líneas caben sin cortarse y la página no
desborda a lo ancho. El título de pantalla y el nombre del dueño miden los mismos 18 px.

---

## El color también en la lista — 2026-08-24

Pedido de gerencia: poder filtrar y colorear por vendedor en la pantalla de Cuentas.

**Filtrar ya se podía**; **colorear no**, y ese era el hueco real: `conColor` estaba atado a
`vista === "mapa"`, así que la lista no tenía color en ninguna dimensión. Un gerente que abre
Cuentas con las tres carteras mezcladas veía treinta tarjetas iguales.

| Qué | Dónde |
|---|---|
| El color se ofrece en las dos vistas | [cuentas-con-filtros.tsx](../src/components/cuentas-con-filtros.tsx) |
| La ficha lleva el punto de color antes del nombre | [ficha-punto.tsx](../src/components/ficha-punto.tsx) |
| La leyenda deja de depender de la vista | ídem |

**Es el mismo color en las dos vistas.** Cambiar de lista a mapa no cambia el código de colores,
que era la mitad del valor de D-013 y se estaba perdiendo.

**El punto nunca va solo** (§17): lo que agrupa está escrito en la propia ficha —el vendedor en
la línea de abajo, el tipo en la insignia— y la leyenda de arriba lo nombra. El color solo hace
que se vea de un golpe dónde termina una cartera y empieza la otra.

La leyenda aparece cuando hay más de un valor en pantalla: explicar un color único es explicar
algo que no distingue nada.

### Por qué no se ve todavía

**En `sgv-pacsa-dev` hay un solo perfil.** El filtro por vendedor y la dimensión de color por
vendedor están escritos para aparecer solo cuando hay más de una persona a la vista —a un
vendedor filtrar por sí mismo no le dice nada—, así que hoy los dos están escondidos con razón.

Aparecen solos en cuanto existan los otros dos usuarios. Crearlos exige contraseña y eso lo hace
el usuario en el panel de Supabase; el perfil —nombre, rol y líder— se asigna después.

---

## Los cuatro usuarios reales, y Zoho en preparación — 2026-08-24

### El equipo entró al sistema

Se crearon los tres usuarios que faltaban y se les asignó perfil. **Primera prueba del modelo de
roles con gente de verdad**, y pasó limpia:

| Entra como | Cuentas | Listas | Personas que ve | Depura catálogo |
|---|---|---|---|---|
| Gerencia | 18 | 2 | 4 | Sí |
| Christopher Guerra · líder | 18 | 2 | 3 — él y sus dos, **no el gerente** | Sí |
| Albert Batista · vendedor | 13 | 1 | 1 | No |
| Javier Rodríguez · vendedor | 4 | 0 | 1 | No |

Los usuarios se habían creado primero en `sgv-pacsa-prod` por confusión entre los dos proyectos.
Se dejaron ahí —cuando se salga a producción ya estarán— y se rehicieron en `sgv-pacsa-dev`.

**Las cuentas de prueba se repartieron.** Estaban todas en el perfil del gerente, así que los
otros tres entraban a una aplicación vacía y el filtro por vendedor mostraba cuatro nombres con
todo en uno. Albert —el del interior— se quedó con Aguadulce y su lista de zona; Javier con las
sueltas de ciudad; Christopher con el objetivo «Banco General» y su lista. **Gerencia quedó en
cero cuentas, que es lo correcto: el gerente no vende.**

### Zoho: preparado, a la espera de credenciales

Confirmado el centro de datos —`books.zoho.com`, EE. UU.— y la organización `630051923`.

| Qué | Dónde |
|---|---|
| Alcance, orden de traída y paso a paso | [docs/15-zoho.md](15-zoho.md) |
| Diagnóstico previo del maestro de clientes | [scripts/zoho-diagnostico.mjs](../scripts/zoho-diagnostico.mjs) |

**El diagnóstico contesta la pregunta que decide el diseño:** dónde vive el RUC en los contactos
de Zoho y en cuántos está puesto. No imprime datos de clientes —de cada valor muestra su forma,
dígitos como 9 y letras como A— así que se ve el formato del RUC sin que salga ningún RUC.

Eso además **le da vuelta a un bloqueo viejo**: la higiene del maestro de Zoho estaba anotada
como bloqueante de §7.6 sin que nadie supiera qué tan sucio estaba. El diagnóstico lo convierte
en un número.

**Pendiente del usuario:** generar el `refresh_token` de solo lectura y ponerlo en `.env.local`.
Las credenciales no pasan por aquí.

---

## Lo que Books sabe, en la pantalla — 2026-08-25

Gerencia entró con el perfil de Albert y no vio la cadencia por ninguna parte. **Estaba
calculada y guardada, pero ninguna pantalla la mostraba.** El dato existía y no se veía.

| Qué | Dónde |
|---|---|
| Bloque «Qué compra» en el expediente | [que-compra.tsx](../src/components/que-compra.tsx) |
| Adoptar la cadencia calculada, de un toque | [adoptar-cadencia.tsx](../src/components/adoptar-cadencia.tsx) |
| El expediente pide los datos de Books y las líneas | [/cuentas/[id]](../src/app/cuentas/[id]/page.tsx) |

**Se propone, no se impone.** El sistema calcula la mediana de los días entre compras y la
ofrece con un botón; el vendedor decide. Si se escribiera sola sobre lo que él puso, dejaría de
ponerla — y lo que él sabe del cliente («este pide más seguido en temporada escolar») no está en
ninguna factura. El botón desaparece cuando las dos coinciden.

**«Dejó de comprar» no es «fuera de cadencia».** Uno mide si el vendedor lo visitó; el otro, si
el cliente compró. Se puede estar al día en visitas y estar perdiendo la cuenta, y hasta hoy
nada lo delataba.

**El umbral de una línea abandonada es relativo al cliente**, no un número plano: dos veces su
propia cadencia. Sin ese contraste «60 días» no dice nada — es normal en quien compra cada dos
meses y alarmante en quien compra cada semana.

Ejemplo real de la cartera de Albert, ya cargado:

| Cuenta | Producto | Sin pedirlo |
|---|---|---|
| Supermarket Mi Pueblo | Caja Rollos Térmicos 80×70 | **307 días** |
| El Punto Poderoso | Caja Rollos Térmicos 80×70 | **274 días** |
| Supermarket Mi Pueblo | FC-Kraft Natural No. 03 | 139 días |

Los dos primeros siguen comprando otras líneas: dejaron de pedir **esa**. Eso es una
conversación de venta con nombre y fecha.

De paso, el campo «Poblado o distrito» pasa a llamarse **«Poblado o zona»**: el vendedor de
Panamá trabaja por zonas, no por poblados.

---

## Badger: los prospectos y las coordenadas — 2026-08-25

Zoho trajo quién compra. **Badger trae dónde queda y a quién se visita sin que haya comprado
todavía** — que por definición no está en ninguna factura.

| Qué | Dónde |
|---|---|
| Leer una hoja `.ods` sin dependencias | [scripts/leer-ods.mjs](../scripts/leer-ods.mjs) |
| Las reglas del cruce, compartidas | [scripts/badger-cruce.mjs](../scripts/badger-cruce.mjs) |
| El informe | [scripts/badger-analizar.mjs](../scripts/badger-analizar.mjs) |
| La carga | [scripts/badger-cargar.mjs](../scripts/badger-cargar.mjs) |

### Cómo quedó la cartera

| Vendedor | Cuentas | De Zoho | De Badger | Con ubicación | Con poblado |
|---|---|---|---|---|---|
| Albert | 217 | 55 | 114 | 178 | **174** |
| Javier | 211 | 144 | 63 | 101 | 0 |
| Christopher | 97 | 33 | 62 | 70 | 0 |

Poblados reales del interior: Chitré 37, Aguadulce 32, Santiago 13, Las Tablas 13, Penonomé 12.

### Poblado solo para el vendedor del interior

Fue decisión de gerencia y los datos la confirmaron. Las direcciones de Albert traen el pueblo
—Santiago, Aguadulce, Las Tablas—; las de Javier dicen **«Panamá» 98 veces y «San Miguelito»
60**, que no es una zona de trabajo sino la ciudad entera.

Ponérselo habría llenado el campo de una palabra inútil y, peor, **habría hecho creer que ya
estaba resuelto**. Javier y Christopher las ponen mirando el mapa, que es donde saben si eso es
Calle 50 o Vía España.

### Qué se dejó fuera, y por qué

- **6 cuentas técnicas** de Badger — `ZZZ NO BORRAR`, `ZZZ DATA ACCOUNT` — con coordenadas en
  Argentina y en el Ártico. Cargadas sin filtro, tres vendedores tendrían pines en Buenos Aires.
- **78 parejas dudosas**, para revisar a mano.
- **120 marcados «cliente» que no engancharon.** Un prospecto que no está en el SGV es un
  prospecto nuevo y punto. Un *cliente* que no engancha es sospechoso: o su nombre en Badger
  difiere mucho del de Zoho —y crearlo duplicaría una cuenta con su facturación encima— o es
  cartera de la casa que dejamos fuera a propósito.

### Dos errores del emparejador que valió la pena cazar

**El primero, falsos positivos.** La primera versión medía el parecido contra el nombre **más
corto**, así que un nombre breve encajaba con cualquiera que lo contuviera: «ABC STORE PLUS» con
«ABC STORE», «Pollo Asaito» con «Asaito». Midiendo contra el más largo, **lo que sobra cuenta en
contra** — y eso que sobra suele ser justo lo que distingue una sucursal de otra.

**El segundo, falsos negativos.** Comparaba las cadenas enteras, así que «RAPOPAN» contra
«RapoPan, S.A.» no coincidía: el sufijo societario mandaba a revisión manual una pareja
evidente. Ahora se comparan solo las palabras que distinguen, y se admite un dedazo en nombres
largos — «Mini Super Valle Centro» contra «Mni Super Valle Centro» está a una letra.

### Lo que NO se automatizó, a propósito

Se evaluó bajar el umbral al 66 % para resolver 43 dudosos de un golpe. **Habría sido un
desastre:** ahí están «MINI SUPER ECONÓMICA» contra «Mini Super Amy», «Selina» y «Milenio», o
«CASA MAYORISTA JK» contra «Casa Mayorista Isabel». Son negocios distintos que comparten el
genérico — emparejar por «Mini Super» en Panamá es como emparejar por «Farmacia».

---

## Poder ver no es que sea tuyo — 2026-08-25

El líder entró y encontró su agenda con las paradas de otros, y su pantalla de listas con las
rutas de Aguadulce y Chitré que había armado otro vendedor.

**No era un fallo del RLS: el RLS estaba bien.** Un líder debe poder ver el trabajo de su
equipo. El fallo era de las pantallas, que confundieron dos cosas distintas:

> El RLS decide **qué puedes ver**. La pantalla decide **qué es tuyo**.

La agenda y las listas son superficies de trabajo personal — qué me toca hoy, qué estoy
armando— y ahora filtran por `vendedor_id = auth.uid()`. «Cómo va el equipo» es otra pregunta y
no es esa pantalla.

| Qué | Dónde |
|---|---|
| La agenda pide solo los compromisos propios | [src/app/page.tsx](../src/app/page.tsx) |
| `cargarListas(vendedorId)` filtra por dueño | [src/lib/listas.ts](../src/lib/listas.ts) |
| Interruptor «Las mías / Las del equipo» | [/listas](../src/app/listas/page.tsx) |

En la vista de equipo cada lista dice de quién es. Y el interruptor solo aparece para líder y
gerencia: a un vendedor, «las mías» y «las del equipo» son lo mismo.

### El filtro de vendedor pasa a ser el primero

Estaba en séptimo lugar, más abajo de lo que llega el pulgar sin desplazar. Para quien ve tres
carteras mezcladas **la primera pregunta no es qué clase de cuenta es: es de quién**. A un
vendedor no le aparece.

### El catálogo de tipos de comercio no se enteró de las cargas

38 tipos escritos en las cuentas, 3 en el catálogo. Las cargas de Zoho y Badger escriben directo
en `cuentas` sin pasar por `asegurar_categoria()`, así que **lo que había que corregir era justo
lo que la pantalla de depuración no podía tocar**.

Se pusieron al día —35 categorías— y se agregó un disparador para que no vuelva a pasar:
cualquier cuenta que se guarde con un tipo que el catálogo no tenga lo agrega, venga de la
pantalla, de una carga o de una consulta a mano.

Y ahí está el caso de manual esperando: **«Mini Super» con 34 cuentas y «Minisuper» con 28.**

---

## La cartera arranca en lo propio, y buscar va al final — 2026-08-25

Dos ajustes a Cuentas y a Mapa, que comparten el mismo panel.

**Arrancan en lo mío.** Con tres carteras mezcladas, entrar y ver 525 fichas de todo el mundo no
le sirve a nadie: lo primero que se busca es lo propio. El filtro de vendedor viene puesto con
uno mismo.

Solo cuando la dirección viene limpia. **Si trae cualquier parámetro es que alguien ya tocó los
filtros —o quitó este a propósito— y volver a ponerlo sería pelearse con el usuario.** Por eso
el mapa de una lista no se filtra: llega con `?lista=`.

**Buscar por nombre pasa al final del panel.** Estaba arriba del todo: se escribía, y para ver
qué había salido tocaba desplazarse por los nueve grupos de filtros hasta llegar a los
resultados. Abajo, lo que se escribe y lo que aparece quedan a un dedo de distancia.

La razón de fondo: los filtros de arriba **se tocan una vez y se dejan puestos**; este **se
escribe y se borra veinte veces seguidas**. El orden del panel debería seguir esa frecuencia, no
la importancia aparente.

---

## Limpiar filtros dejaba al líder mirando a todos — 2026-08-25

Dos cosas que reportó el líder desde el mapa, y las dos eran mías.

**«Quitar todos los filtros» quitaba también el suyo.** Terminaba viendo las tres carteras sin
haberlo pedido, y tenía que volver a seleccionarse a sí mismo.

El error era de lectura: **cuando alguien dice «quita mis filtros» se refiere a los que fue
poniendo, no a la vista con la que entró.** Limpiar ahora vuelve al punto de partida —su
cartera, color por tipo de cuenta— y el botón lo dice: *«Limpiar y volver a lo mío»*.

**La leyenda del mapa se quedaba anunciando la dimensión anterior.** Elegía colorear por
producto de interés, luego cambiaba de filtro, y la leyenda seguía diciendo «Producto de
interés» — la única forma de recuperarla era salir de la pantalla y volver.

Técnicamente no estaba mal: el color es un control aparte del filtro y no tiene por qué
cambiar con él. **Pero se leía como un filtro pegado**, y eso es un fallo igual. Dos arreglos:
limpiar devuelve el color a «tipo de cuenta», y la leyenda ahora dice **«Color: …»** para que no
se confunda con lo que filtra.

---

## El mapa se acordaba de nada — 2026-08-26

El líder filtró en el mapa, se acercó a San Francisco, tocó un pin, entró a la cuenta y volvió.
**El mapa se había reencuadrado a escala de Panamá y Puerto Rico**, y había perdido dónde iba.
Sondear un área así es imposible.

Eran dos problemas encadenados.

**Uno: el mapa no recordaba nada.** Cada vez que se montaba, encuadraba la cartera entera desde
cero. Ahora anota dónde quedó —centro y acercamiento— cuando se queda quieto, y al volver
regresa ahí.

Se guarda **fuera de la dirección**, y eso es una decisión, no un descuido. Los filtros sí viven
en la dirección (D-014) y el panel la reescribe cada vez que se toca uno: si el encuadre viviera
ahí también, **los dos se pisarían** — mover el mapa borraría un filtro o al revés. Y una
dirección que cambia cada vez que el dedo roza el mapa no sirve para compartir nada.

**Dos: un solo punto lejano arruinaba el encuadre inicial.** Hay un cliente real en Puerto Rico,
así que encuadrar «todo» abría el mapa a escala de medio Caribe con las 200 cuentas de Panamá
apretadas en un pixel.

Ahora se encuadra **el grueso y no los extremos**: se recortan los percentiles 5 y 95. El punto
de Puerto Rico sigue ahí; solo hay que alejarse para verlo. Es lo correcto — la vista inicial
debe servir para el trabajo de todos los días, no para el caso raro.

---

## Ya se puede cotizar — 2026-08-26

Estaba construida la base —tablas, tope, generador del PDF— pero **no había pantalla que lo
usara**. Lo señaló gerencia: «¿y dónde cotizo?». Ya está.

**Se llega desde el expediente**, con el botón *Cotizar*, y **solo si la cuenta es tuya**: la
venta tiene que quedar a nombre de quien la trabajó. El líder puede ver la cuenta, pero cotizar
por otro embarraría a quién se le mide.

| Qué | Dónde |
|---|---|
| La pantalla de armado | [/cuentas/[id]/cotizar](../src/app/cuentas/[id]/cotizar/page.tsx) |
| El armador | [armar-cotizacion.tsx](../src/components/armar-cotizacion.tsx) |
| Ver y reenviar una emitida | [descargar-cotizacion.tsx](../src/components/descargar-cotizacion.tsx) |

### Cómo se arma

Busca el producto en el catálogo, lo toca, y **el precio sale solo si ese cliente ya lo
compró** — con la fecha: *«Es el precio que le hiciste en mar 2026. Cámbialo si subió.»* Si nunca
se lo vendió, el campo queda vacío y avisa: *«el precio lo pones tú»*.

Eso es lo que convierte armar una cotización en cosa de un minuto. Un precio de lista no
serviría: el mismo rollo se vende a $21.25 y a $29.50 según a quién.

### El tope se explica antes de chocar

El total se compara con el tope **mientras se escribe**, y al pasarse aparece qué hacer: quitar
renglones, o pedírsela a la oficina. El botón se desactiva.

La regla vive igualmente en la base —el disparador la aplica al emitir— pero **rebotar sin
explicación no enseña nada**. La pantalla es donde se entiende; la base es donde no se puede
saltar.

### El orden de las operaciones importa

Primero se guardan la cotización y sus renglones como borrador; después se genera el PDF, se
sube, y **solo al final se marca como emitida**. Ese último paso es el que dispara la
comprobación del tope.

Así, **si algo falla no se pierde lo escrito**: queda como borrador y se puede reintentar. Al
revés —emitir primero— un fallo al subir el PDF dejaría una cotización emitida sin documento.

### La bitácora

Las emitidas salen en el expediente con su código, su total y dos botones: **ver** y
**reenviar**. Reenviar usa la hoja de compartir del teléfono, porque el cliente que pide
«mándamela otra vez» casi nunca la pide por donde llegó la primera.

**El PDF se descarga, no se rehace.** Si se regenerara con los precios de hoy, el papel que tiene
el cliente y el que ve la oficina dejarían de coincidir.

---

## Mandaba la cotización sin que nadie la hubiera visto — 2026-08-26

Al confirmar, la aplicación abría **de inmediato** la hoja de compartir. El vendedor acababa
mandando por WhatsApp un documento que **no había abierto nunca**.

**Una cotización es una promesa de precio.** Un dígito mal puesto lo cobra el cliente, y para
cuando se nota ya salió de la casa. Automatizar el envío ahorraba un toque y quitaba el único
momento en que alguien podía revisar.

Ahora son dos gestos:

1. **Generar la cotización** — se guarda y se sube, pero no se manda
2. **Ver el PDF** — primero y con el peso visual, porque es el paso que hay que dar
3. **Enviar** — después, y a propósito

**No se bloquea el envío sin haber mirado**, que sería tratar al vendedor como a un niño. Pero
el botón lo dice: si no ha abierto el PDF, se lee **«Enviar sin verlo»**.

De paso, el botón de confirmar dejó de prometer lo que no hacía: decía «Generar y enviar» y
ahora dice «Generar la cotización».

---

## Qué falta, contra el diseño original — auditado 2026-08-26

> **Este repaso quedó desfasado la misma noche.** Lo que cambió está al final del documento, en
> «Dónde quedó el repaso de §7». Se deja tal cual porque es la foto de la que salió el trabajo
> que vino después.

Repaso módulo por módulo de §7 de la visión, contra lo que hay construido.

### §7.1 · App móvil del vendedor — **casi completo**

| | |
|---|---|
| Mapa con filtros | Hecho |
| Alta con GPS, foto y aviso de duplicados | Hecho |
| Agenda con vencidos primero | Hecho |
| Bitácora con fotos | Hecho |
| Oportunidades | Hecho |
| Lista de precios consultable | Hecho — `/productos` |
| **Filtrar por «dormidos» / última compra** | **Falta.** El dato existe —`dias_sin_comprar`, `dejo_de_comprar`— y se ve en el expediente, pero **no hay filtro**. Es de lo más barato que queda y de lo más útil |

### §7.2 · Oficina y administración — **el más atrasado**

| | |
|---|---|
| Bandeja de solicitudes | Hecho |
| Enlazar el número de cotización de Zoho a la solicitud | Falta |
| Bandeja de prospectos ganados pendientes de alta como cliente | Falta |
| Atribución manual de facturas sin vendedor | Falta |
| Estado de pedidos y fecha de entrega desde el SGP | Falta — el SGP no está conectado |

**Y el ciclo de administración nunca se diseñó.** Es el único rol sin su documento de flujo, y
ahora tiene nombre: Verónica. Sigue siendo lo primero a escribir antes de programar nada aquí.

### §7.3 · Gerencia — **parcial**

| | |
|---|---|
| Franja de «requiere tu atención» | Hecho — Excepciones |
| El cierre del líder, completo | Hecho |
| Aprobación de precios especiales | Falta |
| Ventas en vivo por vendedor **contra meta** | Falta — y **no hay metas en el esquema** |
| Tasa de cierre por vendedor, zona y producto | Falta |
| Tiempo del ciclo: creación → cotización → cierre | Falta. Ahora es posible: hay cotizaciones con fecha |
| Mapa de cobertura con zonas en desarrollo | Falta — bloqueado por la lista de categorías que cuentan como mercado |

### §7.4 · Búsqueda de prospectos — **completo**

### §7.5 · Calificación de prospectos — **falta lo principal**

El **modelo de gemelos** —«las panaderías de tu cartera compran en promedio X al mes»— no está.
**Pero ya se puede construir:** están los renglones de venta y el tipo de comercio de cada
cuenta. Es cruzar dos cosas que ya viven en la base.

Lo que sí hay: conteo de reseñas para ordenar la búsqueda, y conteo de sucursales por nombre.
Lo que no: el puntaje 1–5 sobre cada prospecto.

### §7.6 · Inteligencia comercial — **los datos sí, el tablero no**

Están las 1 536 transacciones y sus renglones. Falta la pantalla que conteste las preguntas de
gerencia: venta por canal —casa contra vendedores—, por geografía, por línea de producto.

El mix por cliente sí está, en el expediente.

### §7.7 · Reposición, muestras y competencia — **parcial**

| | |
|---|---|
| Inteligencia de competencia | Hecho — `/mercado` |
| Cadencia calculada del ritmo real | Hecho |
| **Avisar *antes* de que se quede sin producto** | **Falta, y es el corazón del módulo.** Hoy el aviso llega *después*: «dejó de comprar». La visión pide lo contrario — avisar unos días antes del ciclo estimado. Todo lo necesario ya está calculado |
| Trazabilidad de muestras | Falta. Existe el tipo de interacción, no el seguimiento de qué se entregó y en qué terminó |

### §7.8 · Colaboración y consultas internas — **no empezado**

Hilos de comentarios anclados al registro. No hay tabla ni pantalla.

### §7.9 · Cuentas de grupo desde fuentes públicas — **no empezado**

---

### Lo que no es de módulo pero bloquea

| | |
|---|---|
| **Tarea programada** para las sincronizaciones | Hoy nada corre solo. Sin esto, el sistema deja de estar al día en la primera semana |
| **Migración a producción** | El piloto no debe correr en dev |
| Pantalla de revisión de Badger | 78 parejas dudosas y 120 clientes sin enganchar |
| Depurar «Mini Super» contra «Minisuper» | Ya se puede, desde `/categorias` |
| Cuotas y alerta de gasto en Google Cloud | Sigue pendiente desde el principio |
| La cuenta de la empresa como dueña del proyecto de Google | Ídem |

### Decisiones que siguen abiertas

Los tres catálogos provisionales por validar con los vendedores, las metas por vendedor, los
umbrales de dormido, y la higiene del maestro de Zoho —que dejó de ser un bloqueo abstracto: es
**848 clientes sin RUC**—.

---

## La misma confusión, en tres pantallas más — 2026-08-26

Cerrando la semana, al líder le aparecían las listas de Aguadulce y Chitré —de Albert— para
repartir en sus días. Es el mismo fallo de ayer: **poder ver algo no lo hace tuyo.**

Y al buscarlo aparecieron dos más:

| Pantalla | Qué mostraba |
|---|---|
| **Plan de la semana** | Las listas del equipo, para planificar los días propios |
| **Seguimientos** | Los compromisos del equipo, en la pantalla de «a qué me comprometí yo» |
| **Ventas en marcha** | Las oportunidades de todos |

Las tres arregladas. Ventas y Listas ganan interruptor para mirar al equipo a propósito;
Seguimientos y el plan no lo necesitan — son personales y punto.

### El arreglo de fondo: la opción peligrosa ya no es la que sale por omisión

`cargarListas()` se podía llamar **sin dueño**, y entonces devolvía todo lo que el RLS
permitiera. Así se coló tres veces: agenda, listas y plan de la semana. Con la revisión de ayer
arreglé los síntomas y dejé la trampa puesta.

Ahora **el dueño es obligatorio**. Ver lo del equipo hay que pedirlo por su nombre —
`cargarListasDelEquipo()`— y eso ya no se escribe por descuido.

Es la lección que se repite: **cuando un fallo aparece tres veces, el error no está en las tres
pantallas — está en lo que las tres llaman.**

---

## Lo que lleva vendido, y lo que le queda del mes — 2026-08-26

> «Al final no hay posibilidad de mostrar al vendedor cuánto lleva vendido en el mes y cuánto
> lleva de comisión, que es lo que realmente lo incentiva.»

Sí la había: las facturas y entregas de Zoho ya estaban en la base desde el 25. Solo faltaba
la regla y la pantalla.

### La regla

**1,5 % de lo facturado en el mes, sin el ITBMS**, contando facturas y entregas. Los dos valores
—el porcentaje y si va sobre el neto— viven en `parametros`, no en el código: un cambio de
comisión no puede ser un despliegue, y cada cambio queda en `auditoria` porque afecta lo que la
gente cobra.

El neto **sale de los renglones**, no de restarle 7 % al total. Hay documentos exentos y otros
con líneas exentas; restar a ojo daría un número que no cuadra con ninguna factura. Ver
[D-033](06-decisiones.md).

Migración `20260826200000_comision.sql`: la vista `ventas_del_mes` (hereda el RLS de
`transacciones_zoho`) y la función `comision_del_mes(perfil, mes)`. **La comisión se calcula al
leer, no se guarda** — así siempre dice la verdad de hoy con la regla de hoy.

Agosto, medido contra la base real:

| Vendedor | Vendido | Base sin ITBMS | Comisión | Documentos | Por cobrar |
|---|---:|---:|---:|---:|---:|
| Christopher Guerra | $18 284.57 | $17 088.35 | **$256.33** | 26 | $16 847.78 |
| Javier Rodríguez | $8 963.09 | $8 380.30 | **$125.70** | 47 | $4 951.46 |
| Albert Batista | $2 945.77 | $2 783.60 | **$41.75** | 11 | $1 600.19 |

### La pantalla

`/oportunidades` deja de ser solo el embudo y pasa a llamarse **Ventas** a secas. Queda partida
en dos, porque contesta dos preguntas distintas:

- **Arriba, el mes.** Lo vendido, la comisión ganada, y un botón que abre el detalle factura por
  factura en `/oportunidades/cerradas`. **Un total que no se puede abrir no se discute, y por eso
  no se cree**: la primera vez que no le cuadre con lo que él recuerda, deja de mirarlo.
- **Debajo, lo que todavía puede entrar.** Sus cotizaciones vivas y las ventas con cierre
  estimado dentro del mes, cada una con lo que le dejaría a él. Marca las que cree que entran y
  el total se mueve. **Nada de eso se guarda** — ver [D-034](06-decisiones.md).
- **Abajo, el embudo de siempre**, con sus dos vistas por etapa y por mes.

En la vista de equipo el bloque del mes no aparece: la comisión es de una persona, no de un grupo.

### Un aviso que va con el número

La pantalla dice que el total es lo que dice Zoho hasta la última sincronización, y que no
incluye devoluciones ni notas de crédito. Sin eso, el primer mes que la planilla no cuadre con la
pantalla se pierde la confianza en todo lo demás.

### Ventas entra a la barra del vendedor

Se había sacado porque el vendedor de ruta casi no negocia. Eso sigue siendo cierto; lo que
cambió es que la pantalla ya no es solo el embudo. Ver [D-035](06-decisiones.md). La barra del
vendedor pasa a seis casillas y la letra baja a 10 px cuando hay más de cinco — el ícono y el
alto táctil no cambian.

Actualizados `docs/12-flujo-vendedor.html` (cinco pantallas → seis, y la sección de Oportunidades
reescrita como «Ventas: el mes arriba, el embudo abajo») y `docs/13-flujo-lider.html` (los
bocetos decían «Oportunidades» en la barra cuando la aplicación dice «Ventas» desde hace
semanas).

### Lo que falta de esto

- **Verificación visual pendiente.** El navegador de la vista previa no tiene sesión iniciada, así
  que lo construido se comprobó contra la base real y con `tsc`, `eslint` y `next build`, pero
  nadie ha visto la pantalla todavía.
- **Metas por vendedor.** Sin ellas la pantalla dice cuánto lleva, pero no *contra qué*. Sigue
  siendo una decisión abierta de §12 de la visión.

---

## Ventas, partida en tres y con dueño — 2026-08-26

> «Esta ventana de ventas, para el líder cuando está en la vista del equipo muestra solo las
> oportunidades, pero no dice de qué vendedor.»

Era el mismo hueco de siempre, otra vez: **el líder mirando una mezcla sin saber de quién es
cada cosa.** Y de paso salió que la pantalla estaba haciendo tres trabajos apretados en uno.

### Tres pestañas, en orden de dureza

| Pestaña | Qué contesta | Qué tan firme es |
|---|---|---|
| **Facturado** | Cuánto se vendió y cuánta comisión salió | Ya ocurrió. No se discute |
| **Cotizaciones** | Qué precio se prometió por escrito y hace cuántos días | Promesa firmada |
| **Oportunidades** | Qué se está negociando, por etapa o por mes de cierre | Intención |

Arranca en Facturado. **Quien abre Ventas ve primero el número que es verdad.** Ver
[D-036](06-decisiones.md).

Cotizaciones no tenía pantalla propia: vivían escondidas dentro del expediente de cada cuenta.
Ahora se ven juntas, con los días que llevan enviadas y una insignia ámbar cuando pasaron los
quince de validez — **una cotización de la que nadie se acordó es la forma más cara de perder una
venta**: el trabajo ya se hizo, el precio ya se dio, y solo faltó volver a llamar.

La proyección se queda en Facturado aunque sus renglones salgan de las otras dos pestañas. No es
duplicación: en Cotizaciones una cotización es trabajo pendiente; en Facturado es un sumando.

### El filtro de vendedor, arriba de todo

*Mis ventas · Albert · Javier · Todo el equipo*. Cambia las tres pestañas a la vez, así que el
líder ve el mes, la comisión, las cotizaciones y el embudo de cualquiera de los suyos — o de
todos juntos. Ver [D-037](06-decisiones.md).

Sustituye al interruptor «Ver el equipo», que solo tenía dos estados para una pregunta que tiene
tantos estados como vendedores. Y cada oportunidad y cada cotización dice de quién es **cuando se
mira a más de uno**, y solo entonces: al vendedor que mira lo suyo, su propio nombre en cada
tarjeta es ruido.

Con **Todo el equipo**, Facturado muestra el total, las comisiones en plural, y una tarjeta por
vendedor con su barra comparativa. Cada tarjeta lleva a la vista de esa persona, que es la
pregunta siguiente natural: *«¿de dónde salieron esos $8 963 de Javier?»*.

Agosto, todo el equipo:

| | Vendido | Comisión | Documentos |
|---|---:|---:|---:|
| Christopher Guerra | $18 284.57 | $256.33 | 26 |
| Javier Rodríguez | $8 963.09 | $125.70 | 47 |
| Albert Batista | $2 945.77 | $41.75 | 11 |
| **Equipo** | **$30 193.43** | **$423.78** | **84** |

### Migración

`20260826210000_comision_del_equipo.sql` — `comision_del_equipo(perfiles[], mes)`. Una fila por
perfil pedido, **en cero si no vendió**. Reemplaza al patrón de llamar `comision_del_mes` una vez
por vendedor, que con tres funciona y con quince no.

No filtra por visibilidad: la vista `ventas_del_mes` es `security_invoker`, así que un vendedor
que no se puede ver sale en cero. Filtrar aquí sería una segunda regla de visibilidad, y las
segundas reglas se desincronizan.

### Lo que sigue faltando

- **Verificación visual.** Otra vez sin sesión en el navegador de la vista previa. Comprobado
  contra la base real con `tsc`, `eslint` y `next build` limpios.
- **Metas por vendedor.** La comparación de la vista de equipo es entre ellos; falta la
  comparación que importa, que es contra lo que cada uno debía vender.

---

## Tres correcciones de la pantalla de Ventas — 2026-08-26

### «Todo el equipo» no cargaba

`VentasEquipo` recibía `hrefDe` — una **función** — desde la pantalla de servidor. Una función no
cruza esa frontera: Next.js no la puede serializar y aborta el render entero. De ahí el «no se
pudo cargar la página», y solo en esa vista, porque es la única que usaba ese componente.

Ahora cada fila trae su `href` ya armado como texto.

**Ni `tsc` ni `next build` lo iban a atrapar**: el tipo es válido y la pantalla es dinámica, así
que no se renderiza al compilar. Se revisaron los otros nueve componentes de cliente con props de
función y todos viven dentro de otros componentes de cliente — este era el único cruce.

### «En negociación» era la etiqueta equivocada

El total de arriba del embudo decía **En negociación** y sumaba las oportunidades de las cuatro
etapas abiertas. Pero *Negociación* **es una de esas etapas**, así que la pantalla parecía estar
sumando mal cuando lo que estaba mal era la palabra.

Ahora dice **«Por cerrar, en todas las etapas»**. Es la misma cuenta con el nombre correcto.

Es la regla de §14 aplicada al revés: si una palabra ya nombra algo concreto en el sistema, no
puede nombrar además el conjunto que la contiene.

### Gerencia dejó de ser vendedor

El perfil «Gerencia» tenía `rol = vendedor` desde las pruebas de rol de la semana pasada, y por
eso aparecía como una cuarta opción del filtro que siempre iba a dar cero. Queda en `gerente`,
sin líder.

Lo que le colgaba era todo de prueba —3 oportunidades, 3 compromisos y 4 seguimientos del 21 y 22
de agosto, en Restaurante Waikiki y Minisuper la Esquina— y **cero cuentas, cero cotizaciones y
cero facturas**. No se borró nada: al dejar de ser vendedor simplemente sale de las pantallas de
Ventas. Si se quiere limpiar de verdad, se borra desde el expediente.

Con eso el embudo del equipo queda en cero oportunidades, que es la verdad: las tres que había
eran de prueba.

---

## Avisar antes, no después — §7.7 — 2026-08-26

El módulo de reposición tenía todo calculado y le faltaba una resta.

`cuentas_resumen` gana **`dias_para_reponer`** = cadencia observada − días desde la última compra.
Positivo, los días de producto que le quedan; negativo, que ya se le acabó. Migración
`20260826220000_toca_reponer.sql` — la vista se rehace entera, cuarta vez, por la regla del
`select c.*`.

De las 196 cuentas con historia, **118 tienen ritmo medible**: 59 pasadas de su ciclo y 59 al día.

### En la Agenda, solo lo que viene

Sección **«Se les acaba el producto»**, de 0 a 7 días, ordenada por quién se queda sin nada
antes. Lo que ve cada uno hoy:

| Vendedor | Se les acaba esta semana | Ya sin producto |
|---|---:|---:|
| Javier Rodríguez | 5 | 38 |
| Albert Batista | 2 | 11 |
| Christopher Guerra | 1 | 10 |

El tamaño es el correcto: una sección de una a cinco tarjetas no tapa el trabajo del día. Los que
ya se quedaron sin nada van por un enlace al pie —son recuperación, no reposición— y meterlos en
la agenda la llenaría de gente que se fue hace medio año. Ver [D-038](06-decisiones.md).

### En Cuentas y Mapa, para armar la ruta

Filtro **«Se le acaba el producto dentro de»** con 0 / 7 / 15 / 30 días, donde 0 quiere decir
exactamente «ya se le acabó». Y una dimensión de color nueva, **«Cuánto producto le queda»**, con
tramos fijos y no gama relativa: «ya se le acabó» y «le quedan treinta días» son estados
distintos, no dos puntos de una escala. Una gama relativa pintaría de rojo al menos bueno de una
cartera toda al día — que es la alarma falsa que hace que la gente deje de mirar los colores.

**El orden de la lista se me fue al revés y lo corregí:** ponía de primero al que llevaba 200 días
sin comprar, que es el peor candidato de todos. Ver [D-039](06-decisiones.md).

### Lo que queda de este módulo

- **El umbral es absoluto y debería ser relativo.** Cinco días de atraso en quien compra cada 4 es
  grave; en quien compra cada 90, no es nada.
- **Trazabilidad de muestras.** Sigue sin empezar.

---

## La sincronización de noche, y el filtro incremental que nunca corrió — 2026-08-26

### La tarea programada

`.github/workflows/sincronizar-zoho.yml`. Corre a las 2:00 de la madrugada de Panamá —07:00 UTC—,
primero la cartera y después los renglones, con un candado que impide que dos pasadas se pisen.
En GitHub Actions y no en Vercel; el porqué está en [D-040](06-decisiones.md).

**Falta que alguien ponga los secretos** en Settings → Secrets and variables → Actions. Son los
seis del `.env.local`: `ZOHO_ORG_ID`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`,
`ZOHO_REFRESH_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Hasta entonces la
tarea existe y falla.

Y conviene poner la variable **`SUPABASE_REF_ESPERADO`** —no secreta— con el identificador del
proyecto al que debe escribir. Es un seguro contra el día que se cambien los secretos a producción
y uno quede mal pegado.

De paso, `scripts/entorno.mjs`: las credenciales salen del entorno primero y del `.env.local`
después. **El orden importa** — si ganara el archivo, correr la pasada de producción desde esta
máquina escribiría en desarrollo.

### El filtro incremental estaba roto desde el día uno

Al probar la pasada apareció esto:

```
Zoho respondió 2: Invalid value passed for last_modified_time
```

**La pasada incremental del historial nunca llegó a correr.** La primera funcionó porque no había
marca de agua todavía y filtró por fecha; todas las siguientes murieron en la primera consulta. Es
decir: desde el 25 de agosto los renglones de venta no se estaban actualizando, y nadie lo sabía
porque nada corría solo.

Books quiere `yyyy-MM-ddTHH:mm:ss±HHmm` exacto. Postgres devuelve
`2026-08-25T14:23:29.127+00:00`, con las milésimas y los dos puntos del desfase — las dos cosas
que sobran. Se probaron los seis formatos contra la API y solo pasan los dos que cumplen esa
forma.

El mensaje de error nombraba el parámetro pero no decía con qué valor le estaba llegando, así que
se agregó `DEPURAR=1` para imprimir la dirección exacta. Fue lo que lo destapó.

Ya corregido y corrido:

```
Trayendo lo modificado desde 2026-08-25 14:23.
9 facturas y 0 entregas por abrir.
9 transacciones · 10 renglones escritos.
```

Nueve facturas en **dos consultas** en vez de dos mil cien. Y la siguiente pasada, segundos
después: «Nada nuevo. Listo.»

### De paso

`npm run zoho` corre las dos de un tirón; `npm run zoho:seco` las ensaya sin escribir.

---

## El modelo de gemelos, y por qué dice un rango — §7.5 — 2026-08-26

Escrito el módulo que faltaba: [docs/05-modulos/7.5-calificacion-de-prospectos.md](05-modulos/7.5-calificacion-de-prospectos.md).
Y construida su pieza principal, la que la visión llama la fuente más valiosa.

> **Panadería** — la mitad compra entre **$7 y $75 al mes**, cada 39 días.
> *Este compra $180 — por encima de sus iguales.*

Aparece en el expediente de la cuenta. **164 cuentas la ven, y 124 de ellas no han comprado
nunca** — que es exactamente el caso para el que se construyó: un punto en el mapa que deja de ser
un nombre y pasa a ser una expectativa.

### Tres versiones hasta llegar a algo honesto

**Promedio.** Descartado enseguida: en «Distribuidora» da $4 480 al año contra $179 de mediana. Un
cliente grande arrastrando a otros ocho.

**Mediana sola.** Parecía bien hasta medir el reparto completo:

| Tipo | n | Cuartil bajo | Mediana | Cuartil alto | Máximo | Alto ÷ bajo |
|---|---:|---:|---:|---:|---:|---:|
| Mini Super | 10 | $3 | $13 | $38 | $160 | 13,5× |
| Distribuidora | 9 | $4 | $15 | $109 | $2 608 | 26,7× |
| Panadería | 8 | $7 | $20 | $75 | $645 | 10,5× |
| Restaurante | 7 | $8 | $19 | $37 | $63 | 4,9× |

*(al mes)*

**Rango.** Es lo que quedó. Ver [D-041](06-decisiones.md).

### El susto del cuadre, que era mío

Al ver las medianas tan bajas comparé el espejo contra las transacciones y me dio **$545 735
contra $353 843, con 164 de 233 cuentas descuadradas**. Estuve a punto de dar el modelo por
inservible.

**El error era mío:** PostgREST devuelve mil filas por omisión y yo sumé solo las mil primeras de
1 541. Paginando bien, el cuadre da **$546 689 contra $545 735 — 0,2 %**, y solo 8 contactos
difieren, por el día de desfase entre las dos ventanas de doce meses.

De paso quedó comprobado que el historial está completo: una pasada entera encuentra 1 534
documentos y en la base hay 1 541.

### Lo que limita la cobertura: 5 tipos de 33

- **El catálogo tiene la misma categoría escrita de varias formas.** «Mini Super» (34) +
  «Minisuper» (28), «Farmacias» (22) + «Farmacia» (11), «Panadería»/«Panaderías»/«Panaderia» (24
  entre las tres). Las que solo cambian por acento ya se unen solas; las que cambian por plural o
  por un espacio, no. **Unirlas es un toque en `/categorias` y hace que Farmacia pase el piso y
  que Mini Super y Panadería casi dupliquen su muestra.** No las uní: cuál nombre sobrevive es
  vocabulario de la casa, y la fusión no se deshace.
- **227 de 526 cuentas no tienen tipo de comercio.** Las trajo la carga de Zoho.

### Un falso positivo peligroso en la pantalla de depurar

Proponía meter «Cooperativa agro ferretería y supermercado» dentro de «Supermercado». Y también
dentro de «Ferretería». Aceptar cualquiera de las dos borraba lo único que ese nombre dice.
Corregido — ver [D-042](06-decisiones.md). Ahora propone 5 uniones y las 5 son correctas.

### Lo que sigue en manos del negocio

- **El puntaje 1 a 5.** Los pesos son decisión de negocio.
- **El umbral mínimo de pedido.** Ahora hay con qué discutirlo: la mitad de los minisúper compra
  entre $3 y $38 al mes.
- **La mezcla de producto por tipo.** Están los 2 160 renglones, falta el mapeo de producto a
  línea. Los nombres de Zoho traen prefijos que **parecen** sistemáticos —`TE…` rollos térmicos,
  `FP-Kraft`/`FC-Kraft` bolsas, `FP-Antigrasa`, `Tubos…`— pero son 141 nombres y esa lectura es
  mía, no de nadie de la casa. Confirmar los cuatro prefijos desbloquea esto y la pregunta de §7.6
  sobre venta por línea de producto.

### Y un dato para revisar

Hay cuentas mal clasificadas: «Minisuper La esquina 2» y «Refresquería Las Abejas» aparecen como
**Panadería**. No lo toqué — corregirlo es trabajo de quien conoce el local.

---

## El plan de salida a producción — 2026-08-26

Escrito [docs/16-paso-a-produccion.md](16-paso-a-produccion.md): los nueve pasos en orden, qué se
copia y qué no, y el corte con Badger.

Lo que se comprobó al escribirlo, y que quita trabajo manual del día de la salida:

- **Las 48 migraciones bastan.** Crean el esquema, el RLS, las funciones, las vistas y **también
  los dos buckets de Storage** con sus políticas. No hay nada que tocar en el panel de Supabase.
- **Los datos de arranque también son migración**: los datos de la empresa para el encabezado de
  las cotizaciones, el catálogo inicial de tipos de comercio, y los cinco parámetros —comisión,
  base de la comisión, tope de cotización, ITBMS y piso de gemelos—. Producción los recibe solos.
- **Los cuatro usuarios ya existen en `sgv-pacsa-prod`**, de cuando se crearon ahí por error. Solo
  hay que ponerles rol y líder — **sin `lider_id` Christopher no ve a su equipo**.

Lo único que no viene de migración son los datos reales, y para cada uno hay un script: productos,
clientes y facturación, historial, y Badger. En ese orden, porque cada uno cuelga del anterior.

**La decisión que falta no es técnica:** si el piloto arranca con los tres vendedores o con uno.
Con uno se aprende barato pero el líder trabaja con dos sistemas; con los tres se corta de una vez
y el riesgo es que un problema los pare a todos.

---

## Dónde quedó el repaso de §7 — cierre del 2026-08-26

Lo que cambió respecto al repaso de la mañana, después de la noche de trabajo.

| Módulo | Estaba | Quedó |
|---|---|---|
| §7.1 · Filtrar por dormidos | Falta | **Hecho**, y mejor de lo pedido: filtra por cuánto producto le queda, no por cuánto lleva sin comprar |
| §7.5 · Modelo de gemelos | Falta lo principal | **Hecho.** Falta el puntaje 1–5, que necesita los pesos del negocio |
| §7.7 · Avisar antes de que se quede sin producto | «Falta, y es el corazón del módulo» | **Hecho.** En la Agenda, de 0 a 7 días |
| Tarea programada | «Hoy nada corre solo» | **Hecha** — falta que alguien pegue los secretos en GitHub |
| Migración a producción | Sin plan | **Plan escrito**: [docs/16-paso-a-produccion.md](16-paso-a-produccion.md) |
| §7.3 · Ventas por vendedor contra meta | Falta | La mitad hecha: se ve por vendedor y del equipo. **Contra meta sigue sin poder hacerse: no hay metas en el esquema** |

Y dos fallos que aparecieron al construir:

- **El filtro incremental del historial de Zoho nunca corrió.** Desde el 25 de agosto los
  renglones de venta no se actualizaban, y nadie lo sabía porque nada corría solo. Corregido.
- **La pantalla de depurar tipos de comercio proponía una unión que borraba información.**
  Corregido.

### Lo que sigue pendiente, por orden de lo que bloquea

**Necesita una decisión del negocio:**

1. **Metas por vendedor.** Sin ellas, Ventas dice cuánto lleva cada uno pero no contra qué. Es lo
   que le falta a §7.3 para cerrar.
2. **Depurar cinco tipos de comercio** en `/categorias`. La pantalla ya propone las uniones y las
   cinco son correctas; cuál nombre sobrevive es vocabulario de la casa. Mientras no se haga, el
   modelo de gemelos cuenta la misma categoría dos veces.
3. **Confirmar los cuatro prefijos de producto** —`TE…`, `FP-Kraft`/`FC-Kraft`, `FP-Antigrasa`,
   `Tubos…`—. Desbloquea la mezcla por tipo de comercio y la venta por línea de §7.6.
4. **El umbral mínimo de pedido** y **el puntaje 1–5** de §7.5.
5. **Si el piloto arranca con los tres vendedores o con uno.**

**No necesita decisión, se puede construir:**

6. **Pantalla de revisión de Badger** — 83 parejas dudosas y 114 clientes sin enganchar. Pide
   tabla nueva: hoy el cruce se recalcula desde el archivo cada vez.
7. **§7.6 · El tablero de inteligencia comercial.** Los datos están —1 541 transacciones, 2 160
   renglones—; falta la pantalla.
8. **§7.8 · Hilos de comentarios.** Sin tabla ni pantalla.
9. **Trazabilidad de muestras** (§7.7).
10. **Cuotas y alerta de gasto en Google Cloud**, y pasar el proyecto a la cuenta de la empresa.

**Bloqueado por documentación:**

11. **§7.2 · El módulo de oficina.** Es el más atrasado y sigue siendo el único rol sin documento
    de flujo. Nada se programa ahí hasta escribir el ciclo de Verónica.

---

## Venta cruzada — 2026-08-26

> «Creo que más valor tiene que puedas darme un mecanismo de venta cruzada: saber qué panaderías
> me compran bolsas pero no me compran rollos.»

Sustituye a la tarjeta de consumo típico, que era cierta y no servía para nada — decía el tamaño
del cliente, no qué hacer el martes por la mañana. Ver [D-043](06-decisiones.md).

### Lo que hizo falta primero

`lineas_por_cuenta`, a pesar del nombre, agrupa por **producto**: con 141 nombres distintos no
podía contestar «¿compra bolsas?». Faltaba el escalón de línea, y para eso el mapeo de nombre a
línea que quedó confirmado con la casa:

| Nombre en Books | Línea |
|---|---|
| `TE…`, «Rollos Térmicos» | Rollos fiscales |
| «Antigrasa» | Papel antigrasa |
| «Kraft», «Bolsa» | Bolsas de papel |
| «Tubos» | Tubos de cartón |

**Clasifica 2 151 de los 2 160 renglones vendidos** — 99,6 %. Ver [D-044](06-decisiones.md).

### En el expediente

```
Lo que no te compra
  Rollos fiscales                    ~$7/mes
  ████████░░  8 de cada 10 lo compran y gastan eso al mes.

  Papel antigrasa                   ~$45/mes
  ██░░░░░░░░  2 de cada 10 lo compran.        ← apagado

Ya te compra
  Bolsas de papel                   $19/mes
  Bolsas de papel: no lo pide desde hace 4 meses.
```

La proporción es lo que separa una oportunidad de un capricho. Que una panadería no compre tubos
no dice nada si ninguna panadería los compra; que no compre rollos cuando ocho de cada diez sí, es
una visita.

En una cuenta sin compras la misma tarjeta contesta la otra pregunta —qué compra la gente de ese
rubro—, que es con lo que se prepara la primera visita.

### En la cartera

`/venta-cruzada`, enlazada desde Ventas · Facturado. Agrupada **por línea y no por cliente**:
«esta semana salgo a ofrecer rollos» es una ruta; «a este le falta rollos y a este otro bolsas» es
una lista que no se puede caminar.

Lo que sale hoy:

| Vendedor | Clientes comparables | Huecos |
|---|---:|---:|
| Javier Rodríguez | 34 | 7 — todos de rollos fiscales |
| Christopher Guerra | 7 | 1 |
| Albert Batista | 16 | 0 |

Ejemplos reales: *Mini Super 1* y *Mini Super Amy* compran bolsas y no rollos, cuando 8 de cada 10
minisúper compran rollos. *Sazón Único* igual. Tres distribuidoras sin rollos, y las que sí los
compran gastan ~$102 al mes.

### El techo, y es uno solo

**De los 233 clientes que compran algo, 177 llegaron de Zoho sin tipo de comercio.** Sin tipo no
hay con quién compararlos. Descontando además los 16 cuyo tipo no llega a cinco compradores,
quedan **40 clientes comparables de 233**.

No es que no haya huecos: es que tres de cada cuatro clientes están a oscuras. Por eso la pantalla
lo dice en su primera tarjeta, con enlace al filtro de cuentas sin clasificar. **Un límite que se
calla se lee como «tu cartera está completa».**

Clasificar un cliente es un toque en su expediente, y cada uno que se clasifique mejora el
denominador para todos.

### Un fallo de seguridad, detectado antes de producción

La primera versión de `venta_cruzada` era una sola función `security definer` —lo necesitaba para
contar los pares de toda la empresa— y eso hacía que **la parte de la cuenta también leyera por
encima del RLS**: un vendedor podía pasarle el identificador de una cuenta ajena y ver qué compra.

Partida en dos: el agregado cruza, el dato del cliente no. Ver [D-045](06-decisiones.md).

---

## La venta cruzada pasa a las listas — 2026-08-26

> «Para mí sería en la pantalla de listas… él lo selecciona y lo agrega a la lista de Aguadulce.»

Tenía razón: lo que construí ayer era un informe —contesta *qué podría vender*— y lo que produce
trabajo es *a quién visito el martes*. Ver [D-046](06-decisiones.md).

**En la lista de zona**, un botón nuevo: «Agregar clientes por cruzar». Abre los clientes de ese
poblado a los que les falta una línea que sí compra la mitad o más de sus iguales, con lo que hay
que ofrecerle a cada uno y qué tan fuerte es el argumento. Se marcan varios y entran de un golpe.

`listas_cuentas` ya apuntaba a `cuentas` sin mirar el tipo, así que no hizo falta esquema nuevo
para el contenido. Lo que no aguantaba eran los contadores:

- **«Trabajada» pasa a ser «trabajada desde que entró a la lista».** Un cliente entra con años de
  visitas encima; con la regla vieja habría quedado marcado como hecho antes de que nadie lo
  visitara, y el compromiso de la semana se arma con ese número.
- **Los conteos se parten**: «16 por abrir · 4 por cruzar». El cierre ya apostaba por separado.

Migración `20260827020000_listas_con_clientes.sql`, y la misma corrección en la pantalla de la
lista — que lo calculaba por su cuenta y ahora habría discrepado de la vista.

### Lo que rinde hoy

Poco, y por la misma razón de siempre: **177 de los 233 clientes que compran no tienen tipo de
comercio**, y Albert tiene una sola cuenta clasificada por poblado. El mecanismo está bien; el
combustible falta.

| Lista | Clientes en zona | Por cruzar |
|---|---:|---:|
| Bancos (Christopher) | 7 | 1 — Anti Burger, le faltan rollos (7 de 10) |
| Aguadulce (Albert) | 1 | 0 |
| Chitré (Albert) | 1 | 0 |

Clasificar clientes es lo que enciende esto, y es un toque por cuenta.

---

## La oficina, rediseñada — §7.2 — 2026-08-26

Escrito el módulo que faltaba —[docs/05-modulos/7.2-oficina-y-administracion.md](05-modulos/7.2-oficina-y-administracion.md)—
y construido. Era el último rol sin diseñar, y resultó ser el que menos pantalla necesita.

> **La oficina no llena formularios: acusa recibo.**

Antes el vendedor describía el pedido en un párrafo de texto libre y alguien en la oficina lo
volvía a escribir en Zoho — **dos veces lo mismo, y la segunda sin el cliente delante**. Ver
[D-047](06-decisiones.md).

### Los dos documentos, que son el mismo

`cotizaciones` gana `tipo` y `destino`. Cotización y orden de venta comparten todo; cambian el
título, el prefijo del código —`COT-` contra `ORD-`— y a dónde van. Ver [D-050](06-decisiones.md).

La **orden de venta** es la nota de entrega de la libreta, hecha en el teléfono, para el cliente
que pide algo más formal. **La libreta no se jubila**: es una comodidad, no un procedimiento
nuevo.

En el PDF, una orden de venta dice «Entregado a» en vez de «Cotizado a» y **no lleva línea de
validez** — la mercancía ya se entregó, y un «válida hasta» invitaría a pensar en devoluciones.

### Las dos reglas de a dónde va cada uno

| | |
|---|---|
| **El tope enruta, no bloquea** | Por encima de $500 el vendedor sí puede armar la cotización; lo que desaparece es el botón de dársela al cliente. Antes se trababa el formulario, y **un vendedor trabado vuelve a la libreta y no regresa**. Ver [D-048](06-decisiones.md) |
| **Con ITBMS solo va a la oficina** | El vendedor no factura. Lo impone la base y sin excepción de rol. Ver [D-049](06-decisiones.md) |

Comprobadas contra la base, siete casos, todos correctos — entre ellos que una orden **sin** ITBMS
de $900 sí puede entregarse: el tope es de la cotización, no de la orden.

### Lo que quedó en «pedir a la oficina»

Solo **muestra** y **precio o condición especial**. Pedido y cotización siguen existiendo como
tipo de solicitud —se crean solos al mandar el documento— para que conserven su reloj de
respuesta, que es la mitad del valor de la tabla.

El botón del expediente pasa a llamarse **«Pedir muestra o precio»**, y al lado aparece **«Hacer
orden de venta»**.

### La bandeja de Verónica

La misma pantalla de Solicitudes, con dos cosas nuevas donde hacen falta:

- **El documento**, con su código, su total, si lleva ITBMS y un botón para abrir el PDF. Es lo
  que hace la bandeja atendible: sin él, «cotización COT-260827-A3F1» es un número y hay que ir a
  buscarlo. Se descarga con la sesión de quien mira —el bucket es privado— y el RLS de Storage ya
  contemplaba a administración.
- **El nombre del vendedor**, porque atiende a tres personas y tiene que saber a quién contestar.
  No se muestra en las propias: a quien la pidió, su propio nombre no le dice nada.

El acuse ya existía y guarda quién, cuándo y una nota. **La nota importa en las muestras**: por
dónde va lo que se mandó. Sin eso el vendedor pregunta por WhatsApp y el acuse no sirvió.

### Cuarta vez con el mismo tropiezo

`solicitudes_resumen` se crea con `select s.*`, así que la columna `documento_id` —agregada media
hora antes— no existía para la vista y la bandeja no podía abrir nada. Rehecha entera.

De paso se retiró `bandeja_oficina`, que había creado para lo mismo. **Dos vistas que contestan la
misma pregunta se desincronizan**: una gana una columna, la otra no, y a los tres meses la
pantalla del vendedor y la de la oficina dicen cosas distintas del mismo encargo.

### Lo que se perdió y hay que reponer

El formulario viejo pedía el **RUC** cuando el encargo iba a la oficina, aprovechando que el
vendedor estaba delante del cliente. Al sacar pedido y cotización del formulario, ese momento se
perdió.

Por ahora la bandeja **muestra si la cuenta tiene RUC o no**, así que Verónica lo ve antes de
facturar. Falta volver a pedirlo en el camino del documento, que es donde estaba bien pedido.

---

## El tablero de gerencia — §7.6 — 2026-08-26

`/tablero/negocio`, enlazado desde el tablero. **Solo gerencia** — no por secreto, sino porque a
un vendedor saber que la casa factura el doble que él no le dice qué hacer el martes.

### Lo primero que hizo falta: ver el negocio completo

El espejo guardaba solo los clientes de calle: **$545 881 de $1 930 281, el 28 %**. Con eso no se
puede contestar la primera pregunta de la visión. Ahora `transacciones_zoho` cubre las 4 193
transacciones de la empresa, con `canal` por documento. Ver [D-051](06-decisiones.md).

**El hallazgo es que la casa es el 65 % de la venta.** El sistema estaba mirando el tercio pequeño
y llamándolo el negocio.

| | 12 meses | |
|---|---:|---:|
| La casa | $1 256 198 | 65 % |
| Los vendedores | $674 083 | 35 % |
| **Total** | **$1 930 281** | |

### Lo que contesta la pantalla

| Pregunta de §7.6 | Respuesta hoy |
|---|---|
| ¿Cuánto vende la casa y cuánto cada vendedor? | Casa 65 %, calle 35 %. Mes a mes, con barras |
| ¿Quién firma la venta? | Javier 17 %, Christopher 13 %, Albert 4 %, Verónica 7 % |
| ¿De quién depende el negocio? | **Los 10 primeros clientes son el 48 %** de 582 |
| ¿Entran clientes nuevos? | 15 a 27 por mes, sobre 150–215 que compran |
| ¿Qué se vende? | Rollos 59 %, bolsas 29 %, tubos 9 %, antigrasa 3 % |
| ¿Por geografía? | **Falta.** El poblado solo existe en las cuentas de la cartera |
| ¿Mix por cliente? | Ya estaba, en el expediente |

### El segundo hallazgo: 58 % de la venta no tiene vendedor

**$1 115 072 de facturas salen de Zoho sin nombre en el campo de vendedor.** No es venta perdida:
es venta que no se puede atribuir a nadie, y por eso no se puede premiar ni pedir cuentas de ella.
La pantalla lo dice en ámbar, con esas palabras.

### Detalles de lectura que se cuidaron

- **El mes en curso va atenuado y con los días que lleva.** Un mes de 26 días al lado de uno de 31
  se lee como una caída, y es el error más fácil de cometer en una pantalla así.
- **La venta por línea dice que solo cubre la calle.** Sin esa línea se leería como la venta de
  toda la empresa, y es un tercio.
- **«Primera vez» se explica**: es dentro de los doce meses del espejo, así que quien volvió
  después de años sale como nuevo.
- **Barras hechas a mano, sin librería de gráficos.** Media hora de trabajo contra medio megabyte
  y una paleta ajena; y la barra nunca va sola, siempre con su número al lado.

### De paso, la comisión se puso al día

La pasada completa trajo facturas del 25 y 26 que la sincronización rota nunca había traído:

| | Antes | Ahora |
|---|---:|---:|
| Christopher Guerra | $256.33 | **$267.80** |
| Javier Rodríguez | $125.70 | **$139.24** |
| Albert Batista | $41.75 | **$42.32** |

Comprobado que no es un error de carga: los tres deltas dan **exactos** contra las facturas nuevas
—$818.56 de Christopher son Cervecería La Rana Dorada y Combustible del Oeste— y hay **cero
transacciones duplicadas** entre las 4 193.

### Lo que queda de §7.6 y §7.3

- **Venta por geografía.** Necesita poblado en los clientes de la casa, que no tienen cuenta.
- **Renglones de la venta de la casa**, si alguna vez se quiere el mix del negocio completo.
- **Contra meta** (§7.3): sigue sin haber metas en el esquema.
- **Tasa de cierre y tiempo de ciclo** (§7.3): ahora son posibles —hay cotizaciones con fecha—
  pero todavía hay dos cotizaciones en la base, así que medir no diría nada.

---

## El tablero por ejercicio, la cartera del vendedor, y un borrado que costó caro — 2026-08-26

### Lo que se arregló de lo que probaste

| Lo que reportaste | Qué pasaba |
|---|---|
| Gerencia entra a Agenda | El login manda a `/` sin mirar el rol. Ahora gerencia aterriza en el Tablero y administración en Solicitudes |
| No puedo escribir la respuesta: se cierra el teclado | **`Fila` estaba definida dentro de `ListaSolicitudes`.** React creaba una función nueva en cada render y desmontaba la tarjeta entera —con el campo adentro—. Cada tecla remontaba el input. Extraída a nivel de módulo |
| Faltan enero y febrero | La pantalla cortaba a seis meses. Ahora muestra el año completo |
| ¿De qué período son estas cifras? | Selector de año: 2025 completo, 2026 hasta hoy. Y el año en curso se rotula «todavía abierto» |
| No puedo cuadrar contra el total | Cada sección cierra con su total. Donde no cuadra —la venta por línea— se dice por qué |

Ver [D-053](06-decisiones.md).

Con el año calendario, los números cambian de cara:

| | 2025 | 2026 (8 meses) |
|---|---:|---:|
| Facturado | $1 750 982 | $1 261 442 |
| La casa | 84 % | 64 % |
| Los vendedores | 16 % | **36 %** |
| Top 10 clientes | 60 % | 48 % |

**La fuerza de ventas pasó del 16 % al 36 % del negocio en un año**, y la concentración bajó de
60 % a 48 %. Eso no se veía con la ventana móvil.

### La pantalla del vendedor: «Mi cartera»

Cuarta pestaña en Ventas, con el mismo filtro de vendedor que ya tenía. Doce meses móviles.

- **De quién depende su cartera**, con aviso cuando un solo cliente pasa del 30 %.
- **Quién le compra más**, con barras y el peso de cada uno.
- **Qué le vende**, por línea — y **qué línea no ha vendido en todo el año**, que es lo que más
  dice: un vendedor que mueve rollos y bolsas y nunca tubos no tiene mala suerte, no los ofrece.

Lo que sale hoy:

| Vendedor | Clientes | 12 meses | Su mayor cliente | Mezcla |
|---|---:|---:|---|---|
| Christopher | 33 | $250 295 | Farmacias Arrocha, **40 %** | rollos 71 % |
| Javier | 145 | $213 832 | Supermercados Xtra, 21 % | rollos 49 % · bolsas 48 % |
| Albert | 55 | $83 085 | Supermarket Mi Pueblo, **38 %** | rollos 63 % · bolsas 36 % |

**Albert no ha vendido ni tubos ni antigrasa en todo el año.**

### Lo que quedó roto y hay que reponer

Una pasada del historial reventó a mitad y **se llevó los renglones**: quedan 743 de 2 151. Ver
[D-054](06-decisiones.md). Mientras tanto, estas tres cosas están ciegas:

- La venta cruzada del expediente y de las listas.
- «Qué le vende» de Mi cartera.
- «Qué se vende» del tablero, para 2025.

**La cuota de Zoho está agotada** (337 de los 400 que pide la pasada), así que se repone cuando
reinicie. Son 18 minutos de pasada completa. El resto del tablero —canal, quién firma,
concentración, clientes nuevos— **no depende de renglones y está bien**.

El orden de escritura ya está corregido, así que esto no vuelve a pasar.

---

## Salida a producción — 2026-08-26

Se salió, y **no por el camino que decía el plan**. Ver [D-055](06-decisiones.md).

En vez de crear producción de cero, **se intercambiaron los dos proyectos de Supabase**: el de
desarrollo —que ya tenía todos los datos reales— pasó a ser producción, y el que estaba vacío pasó
a ser el nuevo desarrollo. Ahorró las 57 migraciones, las 2 300 llamadas a Zoho, los perfiles,
Badger y el catálogo.

### Lo que se hizo

| Paso | Quién | Estado |
|---|---|---|
| Renombrar los dos proyectos en Supabase | Guido | Hecho |
| `Site URL` y `Redirect URLs` de producción | Guido | Hecho |
| Variables de Production en Vercel → la base de siempre | Guido | Hecho |
| Fusionar `dev` en `main` y desplegar | Claude | Hecho — 102 commits, 57 migraciones |
| Retirar las cinco cuentas de prueba y lo que colgaba | Claude | Hecho — borrado lógico |

La base al salir:

```
521 cuentas · 233 clientes de Zoho · 5 736 transacciones · 1 834 productos
6 seguimientos · 2 compromisos · 2 cotizaciones
Aguadulce 17 puntos · Chitré 30 · Bancos 2
```

Los perfiles ya estaban correctos —Gerencia gerente, Christopher líder, Albert y Javier con su
líder— porque son los mismos de siempre. Ese paso del plan viejo se ahorró entero.

### Lo que falta

| | |
|---|---|
| **Secretos de GitHub** | Sin ellos la sincronización de la noche no corre. Son los seis del `.env.local`, sin cambiar nada, más la variable `SUPABASE_REF_ESPERADO` |
| **Usuario de Verónica** | La oficina no puede entrar hasta que exista |
| **Cuotas y alerta de gasto en Google Cloud** | Lo único de la lista que no es opcional: en producción la búsqueda de prospectos se usa de verdad |
| **Migraciones en el nuevo desarrollo** | Hasta entonces no hay dónde probar una migración riesgosa |
| **Renglones incompletos** | 743 de 2 151, por la pasada que reventó. Programada la reposición a las 00:30 |
| **Caminar el flujo del vendedor** | Nadie lo ha visto. Las pantallas de gerencia dieron cuatro fallos el primer día que alguien las miró |

---

## Google Cloud: el freno y la alarma — 2026-08-26

Quedó puesto lo que faltaba desde el principio del proyecto.

### La cuota diaria, que es el freno

En **Places API (New) → Cuotas**, tres renglones a **1 000 por día**:

| Renglón | Para qué lo usa la aplicación |
|---|---|
| `SearchNearbyRequest per day` | Buscar prospectos «cerca de mí» |
| `SearchTextRequest per day` | Buscar prospectos por texto |
| `GetPlaceRequest per day` | Ubicar una cuenta tocando un punto del mapa |

**Esos tres son los únicos que la aplicación toca.** La API ofrece una docena más —fotos,
autocompletar, reseñas— y todos siguen en su valor de fábrica porque nunca se llaman.

Los `per minute` se dejaron como estaban: protegen contra ráfagas, y el que controla el gasto del
mes es el diario.

**Por qué 1 000 y no 300.** El primer número que propuse protegía el mes pero rompía un día
fuerte: cuatro personas levantando dos zonas hacen 300 o 400 búsquedas en un día, y toparse
justo el día que más se usa la herramienta es la peor forma de estrenarla. Con 1 000 nadie se topa
trabajando, y un error en bucle sigue cortado —sin freno, una madrugada puede hacer cien mil
llamadas—.

### La alarma de gasto

Presupuesto de facturación en **$5**. **No corta: avisa.** Es la que vigila el mes, porque la
cuota diaria no sabe nada de meses.

Los dos frenos hacen cosas distintas y ninguno solo alcanza:

| | Contra qué protege |
|---|---|
| Cuota diaria | Un error en bucle. Corta de verdad |
| Alarma de $5 | Salirse de las 10 000 llamadas gratis del mes. Solo avisa |

### Lo que hay que medir

Una búsqueda del vendedor = **una llamada**, y devuelve hasta 20 resultados. La estimación es de
150 a 300 llamadas al día —unas 5 000 al mes, debajo de las 10 000 gratis— pero **es una
estimación mía, no un dato**. La primera semana con los vendedores trabajando da el número real:
está en la columna «Porcentaje de uso actual» de esa misma pantalla.

### Un pendiente que no es de hoy

El proyecto de Google está en la **cuenta personal de Guido**, no en la de Papelería Comercial. No
se pudo entrar a la de la empresa ese día. Funciona igual, pero si se pierde acceso a ese correo,
los mapas dejan de andar y nadie más puede arreglarlo. La solución no es migrar nada: es agregar
la cuenta de la empresa como **propietaria** del proyecto.

---

## La oficina ya puede entrar — 2026-08-26

Creado el quinto usuario. Los cinco del sistema:

| Perfil | Rol | Aterriza en |
|---|---|---|
| Gerencia | `gerente` | Tablero |
| Christopher Guerra | `lider` | Agenda |
| Albert Batista | `vendedor` | Agenda |
| Javier Rodríguez | `vendedor` | Agenda |
| **Operaciones** | `administracion` | Solicitudes |

**Se llama «Operaciones» y no Verónica** porque son dos personas que hacen ese trabajo
indistintamente: el perfil es del puesto. La consecuencia es que el acuse de una solicitud guarda
«Operaciones» y no cuál de las dos la atendió. Si hace falta distinguirlas, son dos usuarios en
vez de uno — el esquema no lo impide.

El correo venía con un dedazo de una letra —`papeleriacomerial` en vez de `papeleriacomercial`— y
se corrigió dejándolo confirmado, para que pueda entrar sin esperar ningún correo de verificación.
Importaba: ese correo es el de acceso y el de restablecer contraseña, y el equivocado no llegaba a
ningún buzón.
