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
- `docs/06-decisiones.md` — bitácora de decisiones. Vivo. Registradas D-001 (slug),
  D-002 (nomenclatura en español), D-003 (sin Docker), D-004 (catálogos como enum) y
  D-005 (negociación como etapa ancha).
- `docs/07-estado.md` — este archivo. Vivo.
- `docs/sgv-preview.html` — maqueta visual de referencia, no especificación.

---

## En curso

**Tramo 3 — núcleo de campo, captura.** Escrito `05-modulos/7.1-app-movil-vendedor.md`.
Siguen las migraciones de `prospectos`, `visitas`, `compromisos` y `auditoria`, cada una con
su RLS, y después las tres pantallas.

---

## Plan de construcción

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

### Tramo 3 — Núcleo de campo, captura

Alta de prospecto con GPS y foto, validación de duplicados, bitácora de interacciones y
compromisos con fecha.

**Se ve al final:** un vendedor frente a un local registra el prospecto y deja agendado el
próximo paso.

**Criterio de aceptación:** que la captura completa baje de 30 segundos, medido con
cronómetro. §12 marca la resistencia al registro en campo como el riesgo real del
proyecto; si es lento, no se usa.

**Tablas nuevas:** `prospectos`, `visitas`, `compromisos`, y la tabla de auditoría. Cada
una nace con RLS y sus políticas en la misma migración.

### Tramo 4 — Núcleo de campo, consulta

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
