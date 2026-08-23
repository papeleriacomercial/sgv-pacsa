@AGENTS.md

# SGV — Sistema de Gestión de Ventas

CRM de campo para la fuerza de ventas de una papelería comercial en Panamá. Aplicación
móvil para el vendedor de calle: prospección, visitas con check-in GPS, compromisos y
pipeline. **Principio rector: el vendedor no reporta avance; el avance es consecuencia de
hechos registrados** (check-ins, cambios de etapa, cotizaciones, facturas).

No reemplaza a Zoho CRM ni a Zoho Books/Inventory: los lee. Tampoco al SGP (app de
producción, proyecto hermano), del que lee estado y fecha estimada de entrega.

El levantamiento completo está en [docs/00-vision.md](docs/00-vision.md). **Es la fuente de
verdad del alcance**: ante cualquier duda de qué construir, se consulta ahí antes de decidir.

---

## Índice de la documentación

| Archivo | Contenido | Estado |
|---|---|---|
| [docs/00-vision.md](docs/00-vision.md) | Levantamiento de requerimientos Fase 1: alcance, entidades, flujo, reglas de negocio, módulos, prioridades. | Completo |
| [docs/01-arquitectura.md](docs/01-arquitectura.md) | Stack, entornos, integraciones (Zoho, SGP, Google Places, Panamá Emprende). | Completo |
| [docs/02-modelo-datos.md](docs/02-modelo-datos.md) | Esquema, convenciones y diccionario de campos. | Completo |
| [docs/03-seguridad-rls.md](docs/03-seguridad-rls.md) | Roles y políticas por tabla. | Completo |
| [docs/04-design-system.md](docs/04-design-system.md) | Tokens y componentes (deriva de §17 de la visión). | Completo |
| [docs/05-modulos/](docs/05-modulos/) | Un archivo por módulo (§7.1 … §7.9). | §7.1 y §7.4 escritos |
| [docs/06-decisiones.md](docs/06-decisiones.md) | Bitácora de decisiones: qué se decidió, cuándo y por qué. | Vivo |
| [docs/07-estado.md](docs/07-estado.md) | Qué está hecho, qué está en curso, qué falta. | Vivo |
| [docs/08-plan-v2.md](docs/08-plan-v2.md) | Replanteamiento de 2026-08-21: conciliación con la visión, impacto y plan por etapas. | Vigente |
| [docs/09-medicion-y-gestion.md](docs/09-medicion-y-gestion.md) | Qué mide el sistema y para qué: efectividad de caza y de cuidado, tiempo operativo, cobertura. Reordena las etapas 6 en adelante. | Propuesta |
| [docs/10-concepto.html](docs/10-concepto.html) | El concepto acordado el 2026-08-22, para leer de corrido: de sistema de registro a sistema de inteligencia, el contrato semanal y los compromisos de gerencia. | Vigente |
| [docs/11-diseno-operativo.html](docs/11-diseno-operativo.html) | Cómo se aplica el concepto: la semana paso a paso, las pantallas con su dueño y su momento, qué calcula el sistema solo, y los obstáculos reales. | Vigente |
| [docs/12-flujo-vendedor.html](docs/12-flujo-vendedor.html) | El ciclo del vendedor de ruta: sus cuatro pantallas, con bocetos y un lunes completo. | Vigente |
| [docs/13-flujo-lider.html](docs/13-flujo-lider.html) | El ciclo del líder: ventas rápidas, ventas grandes y administración del equipo en la misma semana. | Vigente |
| [docs/14-flujo-gerencia.html](docs/14-flujo-gerencia.html) | El ciclo de gerencia: el tablero del lunes, la media hora con el líder y el informe mensual. | Vigente |

`docs/sgv-preview.html` es una maqueta visual de referencia, no especificación.

**Secciones de la visión que se citan seguido:** §7 módulos · §14 nomenclatura ·
§15 especificación maestra · §16 base de datos y seguridad · §17 sistema de diseño.

---

## Stack y entornos

- **Next.js 16.3.1** (App Router) · React 19 · TypeScript · Tailwind CSS v4 · `lucide-react`.
- **Supabase** — `@supabase/supabase-js` + `@supabase/ssr`. CLI local vía `npx supabase`.
- **Vercel** para despliegue.

| Entorno | Supabase | Rama | Vercel |
|---|---|---|---|
| Desarrollo | `sgv-pacsa-dev` | `dev` | previews por rama |
| Producción | `sgv-pacsa-prod` | `main` | `sgv-pacsa` |

Slug único `sgv-pacsa` en GitHub, Vercel y Supabase (estos dos últimos con sufijo `-dev` y
`-prod`). §14 de la visión dice `sgv`; se corrigió a lo que realmente quedó desplegado —
ver `docs/06-decisiones.md`. Ramas de trabajo: `feat/<módulo>`. Los dos
proyectos de Supabase están separados **desde el día uno**; nunca uno solo que después
"se limpia".

---

## Reglas de trabajo

### Antes de escribir código

1. **Ningún módulo se programa antes de que exista su archivo en `docs/05-modulos/`.**
   Si no existe, se escribe primero.
2. Leer la sección correspondiente de `docs/00-vision.md`. El alcance ya está decidido;
   no se reinterpreta sobre la marcha.
3. Next.js 16 trae cambios de API respecto a versiones anteriores — consultar
   `node_modules/next/dist/docs/` antes de escribir, según indica `AGENTS.md`.

### Base de datos (§16 — la lección del SGP)

En el SGP se levantaron prototipos con datos de muestra y la base de datos y el RLS
llegaron después, obligando a una depuración completa. **No se repite.**

- **RLS activado en la misma migración que crea la tabla.** Ninguna tabla nace sin sus
  políticas, aunque esté vacía. *Deny by default*: sin política explícita, nadie ve nada.
- **Prohibido alterar el esquema desde el dashboard de Supabase.** Todo cambio entra por
  migración versionada en el repo (`npx supabase migration new <nombre>`). Si se toca por
  el dashboard, el repo deja de ser la verdad.
- **Los prototipos de pantalla consumen la base real de `sgv-pacsa-dev`**, nunca datos quemados
  en el JSX. Si la pantalla nace leyendo datos falsos, el esquema se diseña al revés.
- `snake_case` en tablas y columnas; **plural** en tablas. Nomenclatura en **español**,
  igual que la interfaz (`perfiles`, `rol_usuario`, `lider_id`).
- **IDs UUID generados en el cliente.** Forzado por el modo offline: el celular debe poder
  crear registros sin conexión. Si se decide después, se rehace media base de datos.
- Toda tabla lleva `created_at`, `updated_at`, `created_by` y `deleted_at`.
- **Borrado lógico (`deleted_at`), nunca borrado físico.**
- Tabla de auditoría para cambios sensibles: reasignaciones, precios, umbrales, ediciones
  de plan.
- Fechas en **UTC**, presentadas en `America/Panama`. Moneda **USD**. Idioma `es-PA`.
- Las funciones que consultan `perfiles` desde una política van `security definer` con
  `set search_path = public`, para evitar recursión al evaluar RLS.
- Storage: bucket de fotos con políticas propias, alineadas al mismo modelo de roles.

**Modelo de permisos:** tabla `perfiles` con rol `gerente` | `lider` | `vendedor` |
`administracion`. Las políticas se escriben contra **rol + vendedor asignado**:
`vendedor` → solo sus registros · `lider` → todo el equipo + su cartera · `gerente` → todo ·
`administracion` → bandejas de cotización, alta de clientes y pedidos.

### Interfaz (§17)

**La restricción que manda no es estética, es física:** el vendedor usa el celular a pleno
sol, con una mano y con prisa. De ahí: contraste alto, áreas táctiles grandes, poco texto.

- **El color significa estado, no decora.** Los saturados se reservan para el semáforo de
  estados; queda un solo acento de marca para las acciones primarias.
- **Regla del ámbar** (`#FE9A00`): en el cromo (navegación, pestaña activa) significa
  identidad; en los datos significa riesgo o dormido. **Nunca como botón de acción** — esa
  función la toma `slate-800` (`#1D293D`), para que no compitan.
- **Ningún color, tamaño ni radio se escribe suelto en el JSX.** Todos los tokens son
  variables desde el día uno.
- Una sola familia sans para toda la interfaz, más una monoespaciada para identificadores y
  medidas (números de orden, códigos, cantidades, montos).
- **44px de alto táctil mínimo en todo control.** Innegociable: se usa en la calle con una mano.
- Un solo verde. Un solo sistema de tamaños de texto. `rounded-lg` como radio constante.
  Íconos `lucide-react` de 14 a 18px.
- **Sin acentos por sección** (nada de índigo/púrpura/cian por módulo): el color es estado.
- Componentes compartidos de tarjeta, insignia, campo y tabla. Su ausencia en el SGP produjo
  ocho variantes distintas de campo de formulario.
- Los estados **nunca dependen solo del color**: siempre con ícono o etiqueta.
- **Estados obligatorios en toda pantalla:** cargando, vacío, error y **sin conexión**. El
  estado sin conexión indica siempre qué quedó pendiente de sincronizar.
- **Elemento firma — la "ficha de punto":** un solo componente que representa un cliente o
  prospecto y se ve idéntico en el mapa, en la lista de búsqueda, en el plan del día y en el
  expediente.
- Dos densidades (campo/móvil y oficina/escritorio), **un solo sistema de tokens**.
- Verbos en voz activa y consistentes: si el botón dice "Guardar visita", la confirmación
  dice "Visita guardada".

### Restricción legal que condiciona la arquitectura

De Google Places API solo puede almacenarse indefinidamente el `place_id`; las coordenadas
hasta 30 días; y nombres, teléfonos, reseñas o fotos **no** pueden guardarse en base propia.
Los resultados de búsqueda son una **lista temporal**; los datos se vuelven propios solo
cuando el vendedor convierte el candidato en prospecto y los verifica. El `place_id` se
guarda como llave silenciosa.

---

## Mantenimiento de `/docs`

La documentación es **viva**: da contexto a Claude Code durante el desarrollo y termina
siendo la documentación final del sistema. Mantenerla no es trabajo extra al final.

- **`CLAUDE.md` se lee al inicio de cada sesión** y apunta al resto. Si se agrega un archivo
  a `/docs`, se agrega su fila al índice de arriba en la misma tarea.
- **Toda decisión de diseño o arquitectura se registra en `docs/06-decisiones.md` en el
  momento**, con su justificación. Evita rediscutir lo mismo tres meses después. Formato:
  fecha, decisión, alternativas consideradas, por qué.
- **`docs/07-estado.md` se actualiza al cerrar cada tarea.** Es lo que permite retomar el
  trabajo sin releer todo. Si una tarea terminó y el estado no cambió, la tarea no terminó.
- **Los documentos de referencia se actualizan en el mismo empujón que el código, sin que
  nadie lo pida.** Si cambia el esquema, cambian `02-modelo-datos.md` y `03-seguridad-rls.md`;
  si cambia una pantalla, cambia su archivo en `05-modulos/`. Actualizar la documentación es
  parte de terminar la tarea, no un paso posterior.

  El 2026-08-21 esos dos documentos seguían describiendo las tablas `prospectos` y `visitas`
  dos etapas después de haberlas renombrado, porque la regla solo obligaba a tocar el estado.
  **Una referencia desactualizada es peor que no tenerla: se cree.**
- `docs/00-vision.md` **no se edita** para reflejar avances — es el levantamiento original.
  Solo se corrige si cambia el alcance acordado con el negocio, y ese cambio se anota en
  `06-decisiones.md`.
- Un archivo por módulo en `docs/05-modulos/`, nombrado por la sección de la visión que
  desarrolla (ej. `7.4-busqueda-prospectos.md`).
- Los documentos se escriben en español, con el mismo vocabulario que ve el usuario final.

## Decisiones pendientes que bloquean trabajo

Están en §12 de la visión. Las que condicionan esquema o alcance: catálogo cerrado de
"resultado de visita" y de "motivo de pérdida", umbral de pedido mínimo, rango de ajuste del
umbral de dormido, metas por vendedor, e higiene del maestro de clientes de Zoho
(bloqueante para §7.6). **No inventar valores para estos: preguntar.**
