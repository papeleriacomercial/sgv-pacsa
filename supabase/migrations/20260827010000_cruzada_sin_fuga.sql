-- ===========================================================================
-- La venta cruzada, sin la fuga que traía
--
-- `venta_cruzada(p_cuenta)` se escribió `security definer` porque necesita
-- contar los pares de toda la empresa, no la cartera de quien pregunta. Pero
-- eso mismo hacía que **la parte de la cuenta también leyera por encima del
-- RLS**: un vendedor podía pasarle el identificador de una cuenta de otro y
-- enterarse de qué le compra.
--
-- El error está en haber mezclado dos cosas que necesitan permisos distintos:
--
--   - **El denominador** —cuántos comercios del mismo tipo compran cada línea—
--     es un agregado y tiene que cruzar el RLS.
--   - **El numerador** —qué compra esta cuenta— es dato de un cliente y no
--     puede cruzarlo nunca.
--
-- Se parten en dos. El agregado sigue siendo `security definer` con su piso
-- mínimo; la cuenta pasa a leer con los permisos de quien pregunta, así que si
-- no la puede ver, la función devuelve vacío. **No hace falta comprobar nada:
-- el RLS ya sabe la respuesta.**
-- ===========================================================================

drop function if exists public.venta_cruzada(uuid);

-- ---------------------------------------------------------------------------
-- El denominador: qué proporción de cada tipo de comercio compra cada línea
--
-- Solo agregados, nunca filas de cliente. Con menos de `gemelos_minimo` pares
-- no se contesta: «tres de cuatro» no es una proporción sino una anécdota, y
-- además delata a los cuatro.
-- ---------------------------------------------------------------------------

create function public.proporcion_por_tipo()
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
  -- Solo los que compran algo. Una cuenta sin una sola compra no dice nada
  -- sobre qué compra su rubro, y metida en el denominador hunde todas las
  -- proporciones por igual.
  compradores as (
    select
      c.id,
      public.normalizar_texto(c.tipo_comercio) as tipo
    from public.cuentas c
    where c.deleted_at is null
      and c.tipo_comercio is not null
      and c.tipo_comercio <> ''
      and exists (select 1 from public.renglones_zoho r where r.cuenta_id = c.id)
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
    -- Lo que gastan al mes **los que sí la compran**, no todos. Promediar
    -- incluyendo a los que no la compran daría un número bajo que hace
    -- parecer pequeña la oportunidad.
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

comment on function public.proporcion_por_tipo is 'Qué proporción de los comercios de cada tipo compra cada línea, y cuánto gastan los que sí. Solo agregados con piso mínimo: es lo único que puede cruzar el RLS.';

grant execute on function public.proporcion_por_tipo() to authenticated;

-- ---------------------------------------------------------------------------
-- El numerador: qué compra esta cuenta
--
-- **Sin `security definer` y a propósito.** Lee `compra_por_linea`, que hereda
-- el RLS de `renglones_zoho`. Si quien pregunta no puede ver la cuenta, no hay
-- filas y la función devuelve vacío — la misma respuesta que daría el sistema
-- si la cuenta no existiera, que es la respuesta correcta.
-- ---------------------------------------------------------------------------

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
    -- Primero lo que no compra y sus pares sí: es la lista de trabajo.
    (mio.total is not null),
    p.pares_compran desc;
$fn$;

comment on function public.venta_cruzada is 'Qué líneas compra y cuáles no una cuenta, contra los comercios de su mismo tipo. Lee la cuenta con los permisos de quien pregunta; solo el denominador cruza el RLS.';

grant execute on function public.venta_cruzada(uuid) to authenticated;
