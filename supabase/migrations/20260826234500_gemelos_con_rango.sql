-- ===========================================================================
-- Los gemelos, con su rango
--
-- La primera versión devolvía una sola cifra por tipo de comercio: la mediana.
-- Al mirarla contra los datos de verdad se ve que una cifra sola miente por
-- omisión.
--
--   tipo             n    p25   mediana    p75     máx
--   mini super      10     $3      $13     $38    $160
--   distribuidora    9     $4      $15    $109  $2 608
--   panadería        8     $7      $20     $75    $645
--   restaurante      7     $8      $19     $37     $63
--
-- Entre el cuartil de abajo y el de arriba hay de tres a veintisiete veces. No
-- es ruido ni son datos sucios —se comprobó el cuadre contra las 1 541
-- transacciones y da 0,2 % de diferencia—: **los comercios del mismo tipo de
-- verdad compran cantidades muy distintas.**
--
-- Decir «una panadería compra $20 al mes» ante ese reparto es dar por típico lo
-- que no lo es. El vendedor que entra a la que compra $75 y el que entra a la
-- que compra $7 reciben el mismo número y ninguno de los dos lo reconoce.
--
-- **Un rango sí es honesto**: «la mitad de las panaderías compra entre $7 y $75
-- al mes». Dice el orden de magnitud, dice que varía, y no promete precisión
-- que no hay.
-- ===========================================================================

drop function if exists public.consumo_por_tipo();

create function public.consumo_por_tipo()
returns table (
  tipo             text,
  cuentas          integer,
  clientes         integer,
  mensual_bajo     numeric,
  mensual_tipico   numeric,
  mensual_alto     numeric,
  cadencia_tipica  integer,
  suficiente       boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  with piso as (
    select coalesce(public.parametro('gemelos_minimo'), 5) as minimo
  ),
  base as (
    select
      public.normalizar_texto(c.tipo_comercio) as clave,
      c.tipo_comercio as escrito,
      z.total_12m,
      z.cadencia_observada
    from public.cuentas c
    left join public.clientes_zoho z
      on z.cuenta_id = c.id and z.deleted_at is null
    where c.deleted_at is null
      and c.tipo_comercio is not null
      and c.tipo_comercio <> ''
  ),
  agrupado as (
    select
      clave,
      -- El nombre que se muestra es el más usado de las variantes que
      -- `normalizar_texto` considera iguales. Da igual cuál gane; lo que no
      -- puede pasar es que cambie de una consulta a otra, y por eso se decide
      -- con `mode()` y no con `min()` sobre un orden arbitrario.
      mode() within group (order by escrito) as nombre,
      count(*)::integer as cuentas,
      count(*) filter (where total_12m > 0)::integer as clientes,
      -- `percentile_cont` devuelve `double precision` y `round(x, 2)` solo
      -- existe para `numeric`. Se convierte aquí, una vez.
      (percentile_cont(0.25) within group (
        order by total_12m
      ) filter (where total_12m > 0))::numeric as bajo,
      (percentile_cont(0.5) within group (
        order by total_12m
      ) filter (where total_12m > 0))::numeric as tipico,
      (percentile_cont(0.75) within group (
        order by total_12m
      ) filter (where total_12m > 0))::numeric as alto,
      (percentile_cont(0.5) within group (
        order by cadencia_observada
      ) filter (where cadencia_observada is not null))::numeric as cadencia
    from base
    group by clave
  )
  select
    a.nombre,
    a.cuentas,
    a.clientes,
    case when a.clientes >= piso.minimo then round(a.bajo / 12, 2) end,
    case when a.clientes >= piso.minimo then round(a.tipico / 12, 2) end,
    case when a.clientes >= piso.minimo then round(a.alto / 12, 2) end,
    case when a.clientes >= piso.minimo then round(a.cadencia)::integer end,
    a.clientes >= piso.minimo
  from agrupado a, piso
  order by a.clientes desc, a.cuentas desc;
$fn$;

comment on function public.consumo_por_tipo is 'Modelo de gemelos (§7.5): entre cuánto y cuánto compra al mes un comercio de cada tipo. Devuelve el rango del medio —cuartil 25 al 75— porque una sola cifra da por típico lo que no lo es. Vacío por debajo del piso de `gemelos_minimo`, que es a la vez garantía de honestidad y de privacidad.';

grant execute on function public.consumo_por_tipo() to authenticated;
