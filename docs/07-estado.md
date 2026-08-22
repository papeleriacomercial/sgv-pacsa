# Estado del proyecto

**Última actualización:** 2026-08-20 · **Rama activa:** `dev`

Se actualiza al cerrar cada tarea (§15 de la visión). Si una tarea terminó y este archivo
no cambió, la tarea no terminó.

> **Fase actual:** cimientos. Todavía no arranca el núcleo de campo (§7.1), que es el
> primer módulo del orden sugerido en §13.

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
de cadencia · sin clasificar · sin ubicación.

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
