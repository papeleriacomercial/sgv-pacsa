-- Etapa 2 del plan v2: la cuenta completa.
-- Ver docs/08-plan-v2.md.

-- ===========================================================================
-- 1. Catálogo abierto de categorías de comercio
--
-- Es la excepción deliberada a D-004, que fijó todos los catálogos como enums
-- cerrados. Nadie puede enumerar por adelantado los tipos de comercio de un
-- país entero, y la lista crece con cada zona nueva que se abre.
--
-- Global y no por vendedor: §7.6 necesita que `tipo_comercio` sea comparable
-- con la clasificación de Zoho. Un catálogo por usuario se fragmenta en tres
-- versiones de "minisuper" la primera semana. Ver D-012.
-- ===========================================================================

create table public.categorias_comercio (
  id         uuid primary key,
  nombre     text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.perfiles (id),
  deleted_at timestamptz,

  constraint categorias_nombre_no_vacio check (length(trim(nombre)) > 0)
);

comment on table public.categorias_comercio is 'Categorías de comercio. Catálogo abierto: crece con lo que escriben los vendedores.';

-- Sin distinguir mayúsculas: "Minisuper" y "minisuper" son la misma categoría.
create unique index categorias_nombre_unico
  on public.categorias_comercio (lower(trim(nombre)))
  where deleted_at is null;

alter table public.categorias_comercio enable row level security;

-- Todo el equipo lee el catálogo: de nada sirve una lista que cada quien ve
-- distinta.
create policy "categorias_lectura"
  on public.categorias_comercio
  for select
  to authenticated
  using (true);

-- Cualquier vendedor puede agregar una categoría nueva escribiéndola. Es lo
-- que mantiene el catálogo vivo sin depender de que alguien lo administre.
create policy "categorias_insertar"
  on public.categorias_comercio
  for insert
  to authenticated
  with check (true);

-- Depurar duplicados y desactivar las que sobren es de gerencia.
create policy "categorias_gerencia"
  on public.categorias_comercio
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger categorias_tocar_updated_at
  before update on public.categorias_comercio
  for each row
  execute function public.tocar_updated_at();

-- ===========================================================================
-- 2. Volumen de venta
--
-- El juicio del vendedor, disponible desde el día uno. Convive con el puntaje
-- de potencial de §7.5, que será calculado desde la facturación cuando exista
-- §7.6. Comparar los dos es en sí mismo un dato: dónde el olfato acierta.
-- ===========================================================================

create type public.volumen_cuenta as enum ('alta', 'media', 'baja');

alter table public.cuentas add column volumen public.volumen_cuenta;

comment on column public.cuentas.volumen is 'Volumen estimado por el vendedor. No confundir con el potencial calculado de §7.5.';

-- ===========================================================================
-- 3. Ubicación en texto
--
-- Las coordenadas sirven para el mapa pero no para agrupar por poblado ni
-- para leer de un vistazo dónde queda un local.
--
-- Se llenan como sugerencia —desde el mapa o desde la búsqueda— y el vendedor
-- las confirma. Ahí dejan de ser dato de Google y pasan a ser propias, que es
-- el mismo patrón del nombre (§7.4).
-- ===========================================================================

alter table public.cuentas
  add column direccion text,
  add column poblado text;

comment on column public.cuentas.poblado is 'Distrito, corregimiento o pueblo. Permite agrupar la cartera por zona.';

create index cuentas_poblado_idx on public.cuentas (poblado) where deleted_at is null;

-- ===========================================================================
-- 4. Cadencia objetivo
--
-- "Días sin contacto" por sí solo no dice si algo está bien o mal: 20 días sin
-- contactar a un restaurante que recompra cada 15 es una alarma; a una oficina
-- que compra cada tres meses, es normal.
--
-- Este campo es contra qué se mide. Es lo que convierte un filtro en una
-- alerta, y la versión trabajable del "umbral de dormido" de §6.
-- ===========================================================================

alter table public.cuentas add column dias_cadencia smallint;

alter table public.cuentas
  add constraint cuentas_cadencia_razonable
    check (dias_cadencia is null or dias_cadencia between 1 and 365);

comment on column public.cuentas.dias_cadencia is 'Cada cuántos días debería contactarse esta cuenta. Nulo: sin cadencia definida.';

-- ===========================================================================
-- 5. Vista de resumen
--
-- Los días desde el último contacto y hasta el próximo compromiso son cálculo,
-- no dato: guardarlos obligaría a recalcularlos en cada escritura y quedarían
-- desactualizados el día que nadie tocara el registro.
--
-- `security_invoker = true` es obligatorio: sin eso la vista correría con los
-- permisos de quien la creó y saltaría el RLS de las tablas de abajo, dejando
-- que cualquier vendedor viera la cartera completa.
-- ===========================================================================

create view public.cuentas_resumen
with (security_invoker = true)
as
select
  c.*,
  ult.fecha as ultimo_contacto,
  case
    when ult.fecha is null then null
    else (current_date - (ult.fecha at time zone 'America/Panama')::date)
  end as dias_sin_contacto,
  prox.fecha_compromiso as proximo_compromiso,
  case
    when prox.fecha_compromiso is null then null
    else (prox.fecha_compromiso - current_date)
  end as dias_hasta_compromiso,
  -- Vencida contra su propia cadencia, no contra un número plano igual para
  -- todos. Nulo si la cuenta no tiene cadencia definida.
  case
    when c.dias_cadencia is null then null
    when ult.fecha is null then true
    else (current_date - (ult.fecha at time zone 'America/Panama')::date) > c.dias_cadencia
  end as fuera_de_cadencia,
  (c.lat is null or c.lng is null) as sin_ubicacion,
  (select count(*) from public.oportunidades o
    where o.cuenta_id = c.id and o.deleted_at is null
      and o.etapa not in ('ganado', 'perdido')) as oportunidades_abiertas
from public.cuentas c
left join lateral (
  select s.fecha
  from public.seguimientos s
  where s.cuenta_id = c.id and s.deleted_at is null
  order by s.fecha desc
  limit 1
) ult on true
left join lateral (
  select cp.fecha_compromiso
  from public.compromisos cp
  where cp.cuenta_id = c.id and cp.deleted_at is null and cp.cumplido_en is null
  order by cp.fecha_compromiso asc
  limit 1
) prox on true
where c.deleted_at is null;

comment on view public.cuentas_resumen is 'Cuentas con sus días calculados. Hereda el RLS de las tablas de abajo por security_invoker.';
