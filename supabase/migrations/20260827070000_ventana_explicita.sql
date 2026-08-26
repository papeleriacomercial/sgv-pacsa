-- ===========================================================================
-- Las vistas dicen su ventana en vez de heredarla de la carga
--
-- `compra_por_linea` y `venta_cruzada` suman **todo lo que haya** en
-- `renglones_zoho` y después dividen entre doce para dar un promedio mensual.
-- Eso funcionaba por casualidad: la pasada cargaba doce meses justos.
--
-- El tablero de gerencia necesita ver años calendario completos, así que el
-- historial pasa a traer desde enero del año anterior — veinte meses hoy. Con
-- la regla vieja, «gasto mensual» pasaría a ser la suma de veinte meses
-- dividida entre doce: un 67 % de más, en la pantalla que le dice al vendedor
-- cuánto compra un cliente.
--
-- **Una vista que depende de cuántos datos se cargaron no es una vista, es una
-- coincidencia.** Se escribe la ventana donde se usa.
-- ===========================================================================

drop view if exists public.compra_por_linea cascade;

create view public.compra_por_linea
with (security_invoker = true)
as
select
  r.cuenta_id,
  public.linea_de_producto(r.nombre) as linea,
  count(*) as veces,
  sum(r.total) as total,
  max(r.fecha) as ultima_vez,
  (public.hoy_panama() - max(r.fecha)) as dias_sin_pedirla
from public.renglones_zoho r
where r.cuenta_id is not null
  -- Doce meses, dichos aquí. Es lo que hace que «al mes» signifique al mes.
  and r.fecha >= public.hoy_panama() - interval '12 months'
group by r.cuenta_id, public.linea_de_producto(r.nombre);

comment on view public.compra_por_linea is 'Qué líneas compró cada cuenta en los últimos doce meses. La ventana se declara aquí y no se hereda de cuánto trajo la sincronización.';

-- El `cascade` no se lleva la función: el cuerpo de una función SQL no cuenta
-- como dependencia registrada. Se borra a mano.
drop function if exists public.venta_cruzada(uuid);

create function public.venta_cruzada(p_cuenta uuid)
returns table (
  linea             text,
  la_compra         boolean,
  gasto_mensual     numeric,
  dias_sin_pedirla  integer,
  pares_compran     integer,
  pares_totales     integer,
  gasto_tipico      numeric,
  suficiente        boolean
)
language sql
stable
set search_path = public
as $fn$
  with yo as (
    select c.id, public.normalizar_texto(c.tipo_comercio) as tipo
    from public.cuentas c
    where c.id = p_cuenta and c.deleted_at is null
  ),
  mio as (
    select l.linea, l.total, l.dias_sin_pedirla
    from public.compra_por_linea l
    where l.cuenta_id = p_cuenta
  )
  select
    p.linea,
    mio.total is not null,
    round(coalesce(mio.total, 0) / 12, 2),
    mio.dias_sin_pedirla::integer,
    -- La propia cuenta no cuenta como par suyo: compararse consigo misma sube
    -- el denominador y baja la señal justo en el caso que importa.
    case when mio.total is not null then p.pares_compran - 1 else p.pares_compran end,
    case when exists (select 1 from mio) then p.pares_totales - 1 else p.pares_totales end,
    p.gasto_tipico,
    p.suficiente
  from yo
  join public.proporcion_por_tipo() p on p.tipo = yo.tipo
  left join mio on mio.linea = p.linea
  order by
    (mio.total is not null),
    p.pares_compran desc;
$fn$;

comment on function public.venta_cruzada is 'Qué líneas compra y cuáles no una cuenta, contra los comercios de su mismo tipo. Lee la cuenta con los permisos de quien pregunta; solo el denominador cruza el RLS.';

grant execute on function public.venta_cruzada(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Lo mismo en los agregados por tipo de comercio
-- ---------------------------------------------------------------------------

create or replace function public.proporcion_por_tipo()
returns table (
  tipo           text,
  linea          text,
  pares_compran  integer,
  pares_totales  integer,
  gasto_tipico   numeric,
  suficiente     boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  with piso as (
    select coalesce(public.parametro('gemelos_minimo'), 5) as minimo
  ),
  desde as (
    select public.hoy_panama() - interval '12 months' as d
  ),
  compradores as (
    select
      c.id,
      public.normalizar_texto(c.tipo_comercio) as tipo
    from public.cuentas c, desde
    where c.deleted_at is null
      and c.tipo_comercio is not null
      and c.tipo_comercio <> ''
      and exists (
        select 1 from public.renglones_zoho r
        where r.cuenta_id = c.id and r.fecha >= desde.d
      )
  ),
  totales as (
    select tipo, count(*)::integer as cuantos
    from compradores
    group by tipo
  ),
  gasto as (
    select
      k.tipo,
      public.linea_de_producto(r.nombre) as linea,
      r.cuenta_id,
      sum(r.total) as total
    from public.renglones_zoho r
    join compradores k on k.id = r.cuenta_id
    cross join desde
    where r.fecha >= desde.d
    group by k.tipo, public.linea_de_producto(r.nombre), r.cuenta_id
  ),
  lineas as (
    select unnest(array[
      'rollos_fiscales', 'bolsas_papel', 'papel_antigrasa', 'tubos_carton'
    ]) as linea
  )
  select
    t.tipo,
    l.linea,
    coalesce(g.cuantos, 0)::integer,
    t.cuantos,
    case when t.cuantos >= piso.minimo then round(coalesce(g.tipico, 0) / 12, 2) end,
    t.cuantos >= piso.minimo
  from totales t
  cross join lineas l
  cross join piso
  left join lateral (
    select
      count(*)::integer as cuantos,
      (percentile_cont(0.5) within group (order by x.total))::numeric as tipico
    from gasto x
    where x.tipo = t.tipo and x.linea = l.linea
  ) g on true;
$fn$;

-- ---------------------------------------------------------------------------
-- Y en el modelo de gemelos, que divide `total_12m` entre doce
--
-- Ese no cambia: `clientes_zoho.total_12m` lo calcula `zoho-sincronizar.mjs`
-- sobre doce meses justos, y esa pasada **sigue con ventana de doce meses**. La
-- que se estira es la del historial, que es la que alimenta el tablero.
-- ---------------------------------------------------------------------------
