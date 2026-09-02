# Arquitectura

Stack, entornos, flujos de trabajo e integraciones del SGV. Complementa §16 de
`00-vision.md`, que fija las reglas de base de datos y seguridad.

---

## Stack

| Capa | Elección | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.1 |
| UI | React | 19.2.8 |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Íconos | `lucide-react` | 1.33.x |
| Base de datos y auth | Supabase (`supabase-js` + `@supabase/ssr`) | 2.x |
| CLI de migraciones | `supabase` como devDependency | 2.115.x |
| Despliegue | Vercel | — |

Next.js 16 trae cambios de API respecto a versiones anteriores. Antes de escribir código
se consulta `node_modules/next/dist/docs/`, como indica `AGENTS.md`.

No hay entorno local de Supabase: no se usa Docker. La decisión y su porqué están en
`06-decisiones.md` (D-003).

---

## Entornos

| | Desarrollo | Producción |
|---|---|---|
| Proyecto Supabase | `sgv-pacsa-dev` | `sgv-pacsa-prod` |

> ### ⚠ Esto describe el diseño, no lo que hay hoy — comprobado el 2 de septiembre de 2026
>
> **Producción y las previsualizaciones usan la misma base de datos**, `xoesriakyqhpzwxzmkcu`. Se
> verificó leyendo la dirección de Supabase dentro del código que ambos sitios envían al navegador:
> los dos apuntan al mismo proyecto.
>
> **Y el proyecto que iba a ser producción está vacío**: `yzztxbumcyhcogoiwryv` no tiene ninguna
> tabla — ni `perfiles`, ni `cuentas`. Coincide con lo que `07-estado.md` dejó escrito el primer
> día y nunca se actualizó.
>
> **Los nombres en el panel de Supabase están cruzados respecto a los documentos.** No existe ningún
> proyecto llamado `sgv-pacsa-prod`. El que tiene todo se llama `sgv-pacsa`; el vacío se llama
> `sgv-pacsa-dev`. **Guiarse por el nombre lleva a la base equivocada**, y el archivo local
> `supabase/.temp/linked-project.json` también trae el nombre viejo.
>
> **Consecuencia práctica:** no hay dónde probar un cambio destructivo, y los datos de prueba viven
> entre los reales. Decisión pendiente del usuario.
| Ref del proyecto | `xoesriakyqhpzwxzmkcu` | `yzztxbumcyhcogoiwryv` |
| Región | us-east-1 | us-east-1 |
| Rama de Git | `dev` | `main` |
| Vercel | previews por rama | `https://sgv-pacsa.vercel.app` |

Ramas de trabajo: `feat/<módulo>`, que se integran a `dev`. De `dev` a `main` solo cuando
lo que hay en integración está probado.

**Los dos proyectos de Supabase están separados desde el día uno** (§16). Nunca uno solo
que después se limpia.

### Variables de entorno

Dos variables, con distinto valor según el ambiente de Vercel:

| Variable | Production | Preview y Development |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | prod | dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | dev |

En local, `.env.local` apunta a dev y está fuera del repositorio.

**Production y Preview nunca pueden apuntar a la misma base.** Un preview que escriba en
producción ensucia datos reales desde una rama de prueba.

### Llaves

La llave `anon` es pública por diseño: viaja al navegador y por eso lleva el prefijo
`NEXT_PUBLIC_`. Lo que la hace segura es el RLS — sin políticas, esa llave lo vería todo.

Las llaves `service_role` y `sb_secret_` saltan el RLS por completo. **No van en Vercel ni
en el repositorio** mientras no exista código de servidor que las necesite, y cuando exista
irán solo en variables sin prefijo `NEXT_PUBLIC_`.

### URLs autorizadas para autenticación

En Authentication → URL Configuration de cada proyecto:

- **prod:** Site URL `https://sgv-pacsa.vercel.app`, con `https://sgv-pacsa.vercel.app/**`
  en la lista de redirección.
- **dev:** Site URL `http://localhost:3000`, con `http://localhost:3000/**` y
  `https://sgv-pacsa-*-papeleria-comercial.vercel.app/**` (el comodín cubre todas las URLs
  de preview, que cambian en cada rama y en cada commit).

---

## Flujo de cambios en la base de datos

**Prohibido alterar el esquema desde el dashboard de Supabase.** Si se toca por ahí, el
repositorio deja de ser la verdad.

1. `npx supabase migration new <nombre>` crea el archivo versionado.
2. Se escribe el SQL a mano, **con RLS y políticas en la misma migración** (§16).
3. `npx supabase db push` la aplica al proyecto vinculado.
4. Se verifica el resultado consultando el catálogo (`pg_policies`, `pg_proc`).
5. Se anota en `07-estado.md`.

La migración se aplica primero en dev. A prod solo pasa cuando el cambio está probado.

`db reset --linked` reconstruye un proyecto entero desde las migraciones del repositorio.
Es la red de seguridad si dev se ensucia; nunca se ejecuta contra prod con datos reales.

---

## Flujo de despliegue

- Push a `dev` o a `feat/*` → deploy de **preview**, con URL propia, contra la base de dev.
- Merge a `main` → deploy de **producción**, contra la base de prod.

Vercel construye en cada push; no hay paso manual de despliegue.

---

## Integraciones

Todas son de **lectura** en Fase 1. No se escribe en ningún sistema externo: reduce el
riesgo de ensuciar la contabilidad.

| Sistema | Dirección | Qué aporta | Cuándo |
|---|---|---|---|
| Zoho CRM | lectura | Cuentas, contactos, tipo de comercio, propietario | Después del núcleo de campo |
| Zoho Books / Inventory | lectura | Maestro de clientes, facturación con vendedor atribuido, estado de cotizaciones | Después del núcleo de campo |
| SGP | lectura | Estado del pedido y fecha estimada de entrega | Después del núcleo de campo |
| Google Places API (New) | lectura | Búsqueda de prospectos por área y categoría | Módulo §7.4 |
| Panamá Emprende | lectura | Formalidad, RUC, aperturas nuevas | Módulo §7.5 |

**Zoho escritura: ninguna en Fase 1.** Administración crea la cotización y el cliente a
mano, y enlaza el número en la app.

**Decisión pendiente con el SGP:** debe exponer una consulta de estado de pedidos. Conviene
definirla antes de construir, para no hacer dos veces la misma lógica.

### Google Places: restricción legal que condiciona el diseño

Los términos de Google Maps Platform solo permiten almacenar indefinidamente el `place_id`.
Las coordenadas se pueden guardar hasta 30 días. Nombres, teléfonos, reseñas y fotos **no**
pueden guardarse en base propia.

El patrón correcto: los resultados de búsqueda son una **lista temporal**. Solo cuando el
vendedor selecciona un candidato y lo convierte en prospecto, los datos se capturan o
confirman como propios — él los verifica en la visita de todos modos. El `place_id` se
guarda como llave silenciosa, y es lo que permite avisar "ya visitaste este punto" o "esto
ya es cliente de la casa" sin incumplir los términos.

**Cuota por usuario en Google Cloud desde el día uno**, antes de liberar el módulo.

---

## Modo offline

Es un requisito, no una mejora: el vendedor del interior pierde señal y las fotos pesan.

- **IDs UUID generados en el cliente.** El celular tiene que poder crear registros sin
  conexión. Esta decisión condiciona todo el esquema y no se puede tomar después.
- **Cola local** de operaciones pendientes en el dispositivo.
- **Resolución por última escritura, con registro del conflicto.** Nunca descartar en
  silencio.
- **Fotos comprimidas en el cliente** antes de subir, con tamaño máximo definido.
- Toda pantalla muestra qué quedó pendiente de sincronizar (§17).

La implementación se endurece en el Tramo 5, con uso real en el interior. El esquema, en
cambio, se diseña desde ya asumiendo offline.

---

## Storage

Bucket de fotos con políticas propias, alineadas al mismo modelo de roles de `perfiles`.
Se define junto con la tabla de visitas, en el Tramo 3.

---

## Convenciones regionales

Fechas almacenadas en **UTC** y presentadas en `America/Panama`. Moneda **USD**. Idioma
`es-PA`. El atributo `lang` del documento debe reflejarlo.

---

## Lo que todavía no está decidido

- Cómo se consulta Panamá Emprende: si hay API o requiere consulta asistida.
- La forma exacta de la consulta de pedidos del SGP.
- Si la cotización se envía al prospecto desde la app o sigue por correo del vendedor.
- Estrategia de pruebas automatizadas: no hay ninguna configurada todavía.
