-- Inteligencia de competencia: por qué le compra al otro.
--
-- Hoy la empresa guarda religiosamente sus ventas en Zoho y tira a la basura
-- sus rechazos. Pero la venta dice una sola cosa —que el producto sirvió para
-- ese caso—; los cuarenta rechazos dicen qué quiere el mercado.
--
-- Y hay una razón práctica para capturarlo: es lo que le devuelve munición al
-- vendedor. Saber que en Aguadulce seis de nueve minisúper compran chino por
-- crédito y no por precio cambia la conversación en la próxima puerta.
--
-- Ver docs/09-medicion-y-gestion.md y docs/10-concepto.html.

-- ===========================================================================
-- 1. Por qué le compra al otro
--
-- **Lista provisional.** El negocio pidió arrancar con una propuesta para
-- poder mostrar la aplicación funcionando, y afinarla después con los tres
-- vendedores usando sus propias palabras.
--
-- Vale la pena insistir en por qué esa conversación sigue pendiente: estos
-- valores son **las únicas preguntas que la empresa va a poder contestar en
-- dos años**. Si "paisanaje" no estuviera en la lista, nunca se podría
-- demostrar que existe; si "precio" y "crédito" fueran uno solo, nunca se
-- sabría cuál de los dos está matando la venta.
--
-- Agregar valores después es una línea; separar dos que se juntaron mal
-- obliga a releer el histórico a mano.
-- ===========================================================================

create type public.motivo_competencia as enum (
  'precio',
  'credito',
  'paisanaje',
  'cercania',
  'entrega',
  'especificacion',
  'pedido_minimo',
  'otro'
);

comment on type public.motivo_competencia is 'Por qué el comercio le compra a otro. Catálogo provisional: se afina con los vendedores.';

-- ===========================================================================
-- 2. Quiénes son los competidores
--
-- `proveedor_actual` es texto libre desde el núcleo de campo, y ahí está el
-- problema: "el chino", "chino de la esquina", "Distribuidora Wang" y "wang"
-- son cuatro filas que no se pueden sumar. **Sobre texto libre no se construye
-- inteligencia de competencia.**
--
-- Se resuelve como `categorias_comercio` (D-012): catálogo abierto y global
-- que crece con lo que escriben los vendedores y sugiere lo que ya existe. El
-- texto libre se conserva —el campo no cambia— pero la sugerencia empuja a que
-- todos escriban igual, que es lo único que hace falta para poder agregar.
-- ===========================================================================

create table public.competidores (
  id         uuid primary key,
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.perfiles (id),
  deleted_at timestamptz,

  constraint competidores_nombre_no_vacio check (length(trim(nombre)) > 0)
);

comment on table public.competidores is 'Competidores. Catálogo abierto: crece con lo que escriben los vendedores, igual que las categorías de comercio (D-012).';

create unique index competidores_nombre_unico
  on public.competidores (lower(trim(nombre)))
  where deleted_at is null;

alter table public.competidores enable row level security;

-- Todo el equipo lee el catálogo: una lista que cada quien ve distinta no
-- sirve para comparar nada.
create policy "competidores_lectura"
  on public.competidores
  for select
  to authenticated
  using (true);

-- Cualquiera agrega uno escribiéndolo. Es lo que mantiene el catálogo vivo sin
-- depender de que alguien lo administre.
create policy "competidores_insert"
  on public.competidores
  for insert
  to authenticated
  with check (true);

-- Fusionar duplicados y desactivar los que sobren es de gerencia.
create policy "competidores_gerencia"
  on public.competidores
  for update
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger competidores_tocar_updated_at
  before update on public.competidores
  for each row execute function public.tocar_updated_at();

-- ===========================================================================
-- 3. Los motivos, en el seguimiento
--
-- Van en arreglo porque casi nunca es uno solo: le compra al paisano *y* le da
-- crédito. Forzar a elegir una sola razón produciría un dato más limpio y
-- menos cierto.
-- ===========================================================================

alter table public.seguimientos
  add column motivos_competencia public.motivo_competencia[] not null default '{}';

comment on column public.seguimientos.motivos_competencia is 'Por qué le compra al competidor. Varias a la vez: casi nunca es una sola.';

comment on column public.seguimientos.proveedor_actual is 'Quién le vende hoy. Se escribe con sugerencia del catálogo de competidores para que sea agregable.';

-- Para el informe mensual: los rechazos por zona, categoría y motivo.
create index seguimientos_motivos_idx
  on public.seguimientos using gin (motivos_competencia)
  where deleted_at is null;
