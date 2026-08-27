-- ===========================================================================
-- Toda cifra de venta que se le muestre a alguien va sin ITBMS
--
-- El vendedor no maneja números con impuesto. Su comisión ya se calcula sobre
-- el neto (D-033), pero las pantallas le estaban enseñando el bruto: «vendiste
-- $250 295» cuando lo suyo son $234 000 y el resto es plata del Estado que pasa
-- por la factura.
--
-- **Y de paso arregla una incoherencia que ya se había notado.** El desglose
-- por producto suma renglones —sin impuesto— y el total facturado sumaba el
-- bruto, así que no cuadraban nunca. Con las dos cifras en la misma unidad,
-- cuadran solas y sobra la explicación.
--
-- --------------------------------------------------------------------------
-- De dónde sale el neto
-- --------------------------------------------------------------------------
--
-- **De los renglones, no de restarle 7 % al total.** Hay documentos exentos y
-- otros con líneas exentas; restar a ojo daría un número que no cuadra con
-- ninguna factura, y un número que el vendedor no puede cuadrar con su papel es
-- un número que deja de mirar.
--
-- Cuando un documento no trae renglones —porque la pasada no lo abrió todavía—
-- se usa su total. Es contar de más, y es preferible a esconderle una venta al
-- vendedor. Es la misma regla que ya usa `ventas_del_mes` para la comisión.
-- ===========================================================================

drop function if exists public.ranking_de_clientes(date, date, uuid);

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
  neto            numeric,
  por_cobrar      numeric,
  primera_compra  date,
  ultima_compra   date
)
language sql
stable
set search_path = public
as $fn$
  with movimientos as (
    select
      t.contacto_id,
      t.contacto_nombre,
      t.cuenta_id,
      t.perfil_id,
      t.canal,
      t.vendedor_zoho,
      t.total,
      t.saldo,
      t.fecha,
      -- El neto de este documento: lo que suman sus renglones, o su total si
      -- todavía no se han traído.
      coalesce(r.neto, t.total) as neto
    from public.transacciones_zoho t
    left join lateral (
      select sum(x.total) as neto
      from public.renglones_zoho x
      where x.transaccion_id = t.id
    ) r on true
    where t.deleted_at is null
      and t.fecha >= p_desde
      and t.fecha <= p_hasta
      and (p_perfil is null or t.perfil_id = p_perfil)
  )
  select
    m.contacto_id,
    max(m.contacto_nombre),
    -- Agrupa por cliente y no por cliente y canal: si Inmobiliaria Don Antonio
    -- es el 15 % de la venta, es el 15 %, lo atienda quien lo atienda.
    max(m.cuenta_id::text)::uuid,
    max(m.perfil_id::text)::uuid,
    mode() within group (order by m.canal),
    count(*)::integer,
    count(distinct m.vendedor_zoho)::integer,
    sum(m.total),
    sum(m.neto),
    sum(m.saldo),
    min(m.fecha),
    max(m.fecha)
  from movimientos m
  group by m.contacto_id
  order by sum(m.neto) desc;
$fn$;

comment on function public.ranking_de_clientes is 'Cuánto compró cada cliente en un período, con y sin ITBMS. Lo que se muestra es el neto: el vendedor no maneja números con impuesto. El neto sale de los renglones, no de restarle 7 % al total.';

grant execute on function public.ranking_de_clientes(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Lo mismo por mes, para el tablero
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
  sum(coalesce(r.neto, t.total)) as neto,
  sum(t.saldo) as por_cobrar
from public.transacciones_zoho t
left join lateral (
  select sum(x.total) as neto
  from public.renglones_zoho x
  where x.transaccion_id = t.id
) r on true
left join public.vendedores_zoho v
  on v.nombre_zoho = t.vendedor_zoho and v.deleted_at is null
where t.deleted_at is null
group by
  extract(year from t.fecha),
  date_trunc('month', t.fecha),
  t.canal,
  t.vendedor_zoho,
  v.perfil_id;

comment on view public.venta_por_mes is 'La venta de la empresa por año, mes, canal y quien firma, con y sin ITBMS. Hereda el RLS de transacciones_zoho.';
