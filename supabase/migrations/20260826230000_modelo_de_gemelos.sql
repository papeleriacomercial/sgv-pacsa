-- ===========================================================================
-- Modelo de gemelos (§7.5)
--
-- «Las panaderías de la cartera compran unos $X al mes.» Es el número que hace
-- que un punto en el mapa deje de ser un nombre y pase a ser una expectativa.
--
-- La visión lo llama la fuente **más valiosa** de la calificación de
-- prospectos, y con razón: no depende de nadie —sale de la facturación que ya
-- existe— y mejora solo con el tiempo.
--
-- --------------------------------------------------------------------------
-- Tres decisiones que cambian lo que dice el número
-- --------------------------------------------------------------------------
--
-- **1. Mediana y no promedio.** En «Distribuidora» el promedio anual da $4 480
-- y la mediana $179. La diferencia es un cliente grande que arrastra a los
-- ocho restantes. Un vendedor que oiga «las distribuidoras compran $4 480» y
-- vaya a una que compra $200 no vuelve a creerle a la pantalla.
--
-- **2. Con menos de cinco clientes no se dice nada.** No es prudencia
-- estadística nada más: con dos clientes, el número **es** el de esos dos, y
-- cualquiera que sepa quiénes son acaba de enterarse de cuánto compran. El
-- piso es a la vez lo que hace el dato honesto y lo que impide que sirva para
-- espiar.
--
-- **3. Cuenta toda la empresa, no la cartera de quien pregunta.** Diez
-- panaderías compradoras repartidas entre tres vendedores son tres, cuatro y
-- tres: ninguno llegaría al piso. Por eso la función es `security definer` y
-- lee por encima del RLS — un agregado sobre cinco o más cuentas no revela
-- ninguna.
--
-- --------------------------------------------------------------------------
--
-- Las categorías se comparan por `normalizar_texto`, igual que en todo el
-- resto del sistema: «Panadería» y «Panaderia» son la misma. Las que difieren
-- por plural o por un espacio —«Farmacia»/«Farmacias», «Mini Super»/
-- «Minisuper»— **siguen contando aparte**, y unirlas es trabajo de la pantalla
-- de depuración. Hacer aquí una segunda idea de «misma categoría», distinta de
-- la que usan los filtros, es exactamente la clase de deriva que ya costó tres
-- errores en este proyecto.
-- ===========================================================================

-- Con menos de esto la respuesta viene vacía. Vive en `parametros` porque es un
-- juicio de negocio —cuántos gemelos hacen falta para creerle al número— y no
-- una constante técnica.
insert into public.parametros (clave, valor, descripcion) values
  ('gemelos_minimo',
   5,
   'Cuántos clientes del mismo tipo de comercio hacen falta para mostrar su consumo típico.')
on conflict (clave) do nothing;

create function public.consumo_por_tipo()
returns table (
  tipo             text,
  cuentas          integer,
  clientes         integer,
  mediana_mensual  numeric,
  mediana_anual    numeric,
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
      -- El nombre que se muestra es el más usado de las variantes que
      -- `normalizar_texto` considera iguales. Da igual cuál gane; lo que no
      -- puede pasar es que cambie de una consulta a otra, y por eso se decide
      -- con `mode()` y no con `min()` sobre un orden arbitrario.
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
      mode() within group (order by escrito) as nombre,
      count(*)::integer as cuentas,
      count(*) filter (where total_12m > 0)::integer as clientes,
      -- `percentile_cont` devuelve `double precision`, y `round(x, 2)` solo
      -- existe para `numeric`. Se convierte aquí, una vez, y no en cada uso.
      (percentile_cont(0.5) within group (
        order by total_12m
      ) filter (where total_12m > 0))::numeric as mediana_anual,
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
    case when a.clientes >= piso.minimo then round(a.mediana_anual / 12, 2) end,
    case when a.clientes >= piso.minimo then round(a.mediana_anual, 2) end,
    case when a.clientes >= piso.minimo then round(a.cadencia)::integer end,
    a.clientes >= piso.minimo
  from agrupado a, piso
  order by a.clientes desc, a.cuentas desc;
$fn$;

comment on function public.consumo_por_tipo is 'Modelo de gemelos (§7.5): cuánto compra al mes un comercio típico de cada tipo. Mediana, no promedio. Vacío por debajo del piso de `gemelos_minimo`, que es a la vez la garantía de honestidad y la de privacidad.';

grant execute on function public.consumo_por_tipo() to authenticated;
