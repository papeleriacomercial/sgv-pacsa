-- ===========================================================================
-- El mismo dato, dos ventanas distintas
--
-- Gerencia lee por **año calendario**: 2025 completo contra lo que va de 2026.
-- El vendedor lee sus **últimos doce meses**, y el año fiscal le da igual — lo
-- que quiere saber es cómo viene su último año de trabajo.
--
-- Las vistas `venta_por_cliente` y `venta_por_linea` no podían servir a las
-- dos: una vista no lleva parámetros, así que su ventana quedaba clavada.
-- Pasan a ser funciones con desde y hasta.
--
-- **Sin `security definer`.** El RLS de `transacciones_zoho` y `renglones_zoho`
-- ya dice quién ve qué: gerencia todo, el líder su equipo, el vendedor lo suyo.
-- El parámetro `p_perfil` filtra, no autoriza — pedir la cartera de otro
-- devuelve lo que el RLS permita y nada más.
-- ===========================================================================

drop view if exists public.venta_por_cliente;
drop view if exists public.venta_por_linea;

create function public.ranking_de_clientes(
  p_desde date,
  p_hasta date,
  p_perfil uuid default null
)
returns table (
  contacto_id     text,
  nombre          text,
  cuenta_id       uuid,
  perfil_id       uuid,
  canal_habitual  public.canal_venta,
  documentos      integer,
  vendedores      integer,
  total           numeric,
  por_cobrar      numeric,
  primera_compra  date,
  ultima_compra   date
)
language sql
stable
set search_path = public
as $fn$
  select
    t.contacto_id,
    max(t.contacto_nombre),
    -- Agrupa por cliente y no por cliente y canal: si Inmobiliaria Don Antonio
    -- es el 15 % de la venta, es el 15 %, lo atienda quien lo atienda.
    max(t.cuenta_id::text)::uuid,
    max(t.perfil_id::text)::uuid,
    mode() within group (order by t.canal),
    count(*)::integer,
    count(distinct t.vendedor_zoho)::integer,
    sum(t.total),
    sum(t.saldo),
    min(t.fecha),
    max(t.fecha)
  from public.transacciones_zoho t
  where t.deleted_at is null
    and t.fecha >= p_desde
    and t.fecha <= p_hasta
    and (p_perfil is null or t.perfil_id = p_perfil)
  group by t.contacto_id
  order by sum(t.total) desc;
$fn$;

comment on function public.ranking_de_clientes is 'Cuánto compró cada cliente en un período. Sin p_perfil, todo lo que el RLS deje ver; con él, la cartera de ese vendedor.';

grant execute on function public.ranking_de_clientes(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Qué se vendió, por línea
--
-- **Solo cubre la venta de calle**, y hay que decirlo en las dos pantallas. Los
-- renglones se traen abriendo documento por documento y eso se hace solo para
-- los clientes de la cartera; de la venta de la casa se guarda la cabecera.
-- ---------------------------------------------------------------------------

create function public.venta_por_linea(
  p_desde date,
  p_hasta date,
  p_perfil uuid default null
)
returns table (
  linea       text,
  clientes    integer,
  renglones   integer,
  cantidad    numeric,
  total       numeric
)
language sql
stable
set search_path = public
as $fn$
  select
    public.linea_de_producto(r.nombre),
    count(distinct r.cuenta_id)::integer,
    count(*)::integer,
    sum(r.cantidad),
    sum(r.total)
  from public.renglones_zoho r
  where r.fecha >= p_desde
    and r.fecha <= p_hasta
    and (p_perfil is null or r.perfil_id = p_perfil)
  group by public.linea_de_producto(r.nombre)
  order by sum(r.total) desc;
$fn$;

comment on function public.venta_por_linea is 'Qué se vendió por línea en un período. Solo la venta de calle: de la casa se guarda la factura, no lo que llevaba dentro.';

grant execute on function public.venta_por_linea(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Y `venta_por_mes` gana el año, para que el tablero pueda separar ejercicios
-- ---------------------------------------------------------------------------

drop view if exists public.venta_por_mes;

create view public.venta_por_mes
with (security_invoker = true)
as
select
  extract(year from t.fecha)::integer as anio,
  date_trunc('month', t.fecha)::date as mes,
  t.canal,
  t.vendedor_zoho,
  v.perfil_id as vendedor_id,
  count(*)::integer as documentos,
  count(*) filter (where t.tipo = 'factura')::integer as facturas,
  count(*) filter (where t.tipo = 'entrega')::integer as entregas,
  count(distinct t.contacto_id)::integer as clientes,
  sum(t.total) as total,
  sum(t.saldo) as por_cobrar
from public.transacciones_zoho t
left join public.vendedores_zoho v
  on v.nombre_zoho = t.vendedor_zoho and v.deleted_at is null
where t.deleted_at is null
group by
  extract(year from t.fecha),
  date_trunc('month', t.fecha),
  t.canal,
  t.vendedor_zoho,
  v.perfil_id;

comment on view public.venta_por_mes is 'La venta de la empresa por año, mes, canal y quien firma el documento. Hereda el RLS de transacciones_zoho.';
