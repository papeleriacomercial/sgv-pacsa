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
| Auth URL Configuration | Listo | Verificado el 2026-08-20: prod acepta `https://sgv-pacsa.vercel.app/**`; dev acepta `http://localhost:3000/**` y el comodín de previews `https://sgv-pacsa-*-papeleria-comercial.vercel.app/**`. |

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
- `docs/06-decisiones.md` — bitácora de decisiones. Vivo. Registradas D-001 (slug),
  D-002 (nomenclatura en español) y D-003 (sin Docker).
- `docs/07-estado.md` — este archivo. Vivo.
- `docs/sgv-preview.html` — maqueta visual de referencia, no especificación.

---

## En curso

Nada abierto en este momento.

---

## Pendiente

### Bloquea el arranque del desarrollo

1. **Escribir los documentos de `/docs` que faltan.** Ninguno de estos existe todavía y
   `01`–`04` condicionan cómo se programa:
   - `01-arquitectura.md`, `02-modelo-datos.md`, `03-seguridad-rls.md`, `04-design-system.md`
   - `05-modulos/` (un archivo por módulo; **ningún módulo se programa antes de tenerlo**)

### Trabajo de producto (orden de §13)

1. **Núcleo de campo** (§7.1): alta de prospecto con GPS y foto, bitácora, compromisos con
   fecha, mapa con filtros. Piloto con un solo vendedor durante dos semanas.
2. **Inteligencia comercial** (§7.6), en paralelo — no depende de la adopción de los
   vendedores. Bloqueado por la higiene del maestro de clientes y productos de Zoho.
3. Búsqueda y calificación de prospectos (§7.4 y §7.5).
4. Cotizaciones y aprobaciones de precio.
5. Lectura de Zoho y del SGP.
6. Tablero de gerencia (§7.3).

### Esquema que falta para el núcleo de campo

`prospectos`, `visitas`, `compromisos`, `oportunidades`, `territorios` y la tabla de
auditoría. Cada una nace con RLS y sus políticas en la misma migración.

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

Las que condicionan esquema y no se pueden inventar: catálogo cerrado de "resultado de
visita" y de "motivo de pérdida", umbral de pedido mínimo, rango permitido de ajuste del
umbral de dormido, y metas por vendedor.

---

## Cómo retomar

1. Leer `CLAUDE.md` (índice y reglas) y este archivo.
2. Escribir `06-decisiones.md` con las decisiones ya tomadas y sin registrar.
3. Seguir con lo que marque *Pendiente*.
