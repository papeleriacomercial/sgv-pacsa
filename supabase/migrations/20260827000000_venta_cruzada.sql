-- ===========================================================================
-- Venta cruzada: qué le falta comprar a cada cliente
--
-- «Esta panadería te compra bolsas pero no rollos, y siete de cada diez
-- panaderías compran rollos.» Es una conversación de venta concreta, con un
-- cliente que ya te conoce y ya te compra.
--
-- Sustituye en la pantalla al consumo típico por tipo de comercio, que decía
-- cuánto compra un comercio parecido pero no qué hacer con eso. El cálculo del
-- consumo se queda —es de donde salen los denominadores— pero lo que se enseña
-- es esto.
--
-- --------------------------------------------------------------------------
-- 1. De 141 nombres de producto a cuatro líneas
-- --------------------------------------------------------------------------
--
-- Los nombres de Books traen una convención consistente, confirmada por la
-- casa:
--
--   TE… , «Rollos Térmicos»        rollos fiscales
--   …Kraft… , «Bolsa…»             bolsas de papel
--   …Antigrasa…                    papel antigrasa
--   Tubos…                         tubos de cartón
--
-- Clasifica **2 151 de los 2 160 renglones vendidos**. Los nueve que quedan
-- fuera son un servicio de confección y dos códigos sueltos, y caen en «otros»
-- sin hacer ruido.
--
-- El orden de las comprobaciones importa: «FP-Antigrasa» lleva las dos cosas y
-- es antigrasa, no bolsa. Por eso antigrasa se pregunta antes que Kraft.
-- ===========================================================================

create function public.linea_de_producto(nombre text)
returns text
language sql
immutable
as $fn$
  select case
    when nombre is null then 'otros'
    when upper(nombre) ~ '\mTE\d' then 'rollos_fiscales'
    when upper(nombre) like '%ROLLOS TERMICOS%' then 'rollos_fiscales'
    when upper(nombre) like '%ROLLOS TÉRMICOS%' then 'rollos_fiscales'
    -- Antes que Kraft: «FP-Antigrasa» trae las dos palabras y es antigrasa.
    when upper(nombre) like '%ANTIGRASA%' then 'papel_antigrasa'
    when upper(nombre) like '%KRAFT%' then 'bolsas_papel'
    when upper(nombre) like '%BOLSA%' then 'bolsas_papel'
    when upper(nombre) like '%TUBO%' then 'tubos_carton'
    else 'otros'
  end;
$fn$;

comment on function public.linea_de_producto is 'De qué línea es un producto de Books, leyendo su nombre. La convención de nombres la confirmó la casa: TE… rollos, Kraft bolsas, Antigrasa, Tubos. Clasifica el 99,6 % de lo vendido.';

-- ---------------------------------------------------------------------------
-- 2. Qué línea compra cada cuenta
--
-- Un escalón por encima de `lineas_por_cuenta`, que a pesar del nombre agrupa
-- por **producto** — y con 141 nombres distintos eso no contesta «¿compra
-- bolsas?».
-- ---------------------------------------------------------------------------

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
group by r.cuenta_id, public.linea_de_producto(r.nombre);

comment on view public.compra_por_linea is 'Qué líneas de producto compra cada cuenta. Hereda el RLS de renglones_zoho.';

-- ---------------------------------------------------------------------------
-- 3. Qué le falta, contra lo que compran los de su tipo
--
-- **La proporción es lo que separa una oportunidad de un capricho.** Que una
-- panadería no compre tubos de cartón no dice nada si ninguna panadería los
-- compra. Que no compre rollos cuando siete de cada diez sí, es una visita.
--
-- `security definer` por lo mismo que el modelo de gemelos: el denominador
-- tiene que contar toda la empresa, no la cartera de quien pregunta. Y por lo
-- mismo lleva el piso de `gemelos_minimo` — con menos de cinco pares, «tres de
-- cuatro» no es una proporción, es una anécdota, y además delata a los cuatro.
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
security definer
set search_path = public
as $fn$
  with piso as (
    select coalesce(public.parametro('gemelos_minimo'), 5) as minimo
  ),
  yo as (
    select c.id, public.normalizar_texto(c.tipo_comercio) as tipo
    from public.cuentas c
    where c.id = p_cuenta and c.deleted_at is null
  ),
  -- Los clientes del mismo tipo de comercio que sí compran algo. Se excluye la
  -- propia cuenta: compararse consigo misma sube el denominador y baja la
  -- señal justo en el caso que importa.
  pares as (
    select c.id
    from public.cuentas c, yo
    where c.deleted_at is null
      and c.id <> yo.id
      and public.normalizar_texto(c.tipo_comercio) = yo.tipo
      and exists (
        select 1 from public.renglones_zoho r where r.cuenta_id = c.id
      )
  ),
  lineas as (
    select unnest(array[
      'rollos_fiscales', 'bolsas_papel', 'papel_antigrasa', 'tubos_carton'
    ]) as linea
  ),
  mio as (
    select l.linea, l.total, l.dias_sin_pedirla
    from public.compra_por_linea l
    where l.cuenta_id = p_cuenta
  ),
  delPar as (
    select
      public.linea_de_producto(r.nombre) as linea,
      r.cuenta_id,
      sum(r.total) as total
    from public.renglones_zoho r
    join pares p on p.id = r.cuenta_id
    group by public.linea_de_producto(r.nombre), r.cuenta_id
  )
  select
    l.linea,
    mio.total is not null,
    round(coalesce(mio.total, 0) / 12, 2),
    mio.dias_sin_pedirla::integer,
    coalesce(d.cuantos, 0)::integer,
    (select count(*) from pares)::integer,
    -- Lo que gastan al mes **los que sí la compran**, no todos. Promediar
    -- incluyendo a los que no la compran daría un número bajo que hace
    -- parecer pequeña la oportunidad.
    case when (select count(*) from pares) >= piso.minimo
      then round(coalesce(d.tipico, 0) / 12, 2) end,
    (select count(*) from pares) >= piso.minimo
  from lineas l
  cross join piso
  left join mio on mio.linea = l.linea
  left join lateral (
    select
      count(*)::integer as cuantos,
      (percentile_cont(0.5) within group (order by dp.total))::numeric as tipico
    from delPar dp
    where dp.linea = l.linea
  ) d on true
  order by
    -- Primero lo que no compra y sus pares sí: es la lista de trabajo.
    (mio.total is not null),
    coalesce(d.cuantos, 0) desc;
$fn$;

comment on function public.venta_cruzada is 'Qué líneas compra y cuáles no una cuenta, contra la proporción de los comercios de su mismo tipo que sí las compran. La proporción es lo que separa una oportunidad de un capricho.';

grant execute on function public.venta_cruzada(uuid) to authenticated;
