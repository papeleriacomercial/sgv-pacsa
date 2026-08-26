-- ===========================================================================
-- La misma cuenta, para varios a la vez
--
-- `comision_del_mes` contesta por una persona. El líder necesita la misma
-- pregunta para su equipo entero y no puede resolverla llamándola una vez por
-- vendedor: hoy son tres, pero la lista crece y el patrón no.
--
-- **Devuelve una fila por cada perfil que se le pida, aunque no haya vendido
-- nada.** Un vendedor en cero tiene que aparecer en cero — si desapareciera de
-- la tabla, el líder leería «no lo estamos midiendo» donde dice «no vendió», y
-- esas dos cosas piden reacciones opuestas.
-- ===========================================================================

create function public.comision_del_equipo(p_perfiles uuid[], p_mes date default null)
returns table (
  perfil_id      uuid,
  vendido        numeric,
  base           numeric,
  comision       numeric,
  porcentaje     numeric,
  sobre_neto     boolean,
  documentos     integer,
  por_cobrar     numeric
)
language sql
stable
set search_path = public
as $fn$
  with regla as (
    select
      coalesce(public.parametro('comision_porcentaje'), 0) as pct,
      coalesce(public.parametro('comision_sobre_neto'), 1) = 1 as neto
  ),
  mes as (
    select coalesce(p_mes, date_trunc('month', public.hoy_panama())::date) as m
  ),
  pedidos as (
    select unnest(p_perfiles) as id
  )
  select
    p.id,
    coalesce(v.total, 0),
    coalesce(case when regla.neto then v.neto else v.total end, 0),
    round(
      coalesce(case when regla.neto then v.neto else v.total end, 0) * regla.pct / 100,
      2
    ),
    regla.pct,
    regla.neto,
    coalesce(v.documentos, 0)::integer,
    coalesce(v.por_cobrar, 0)
  from pedidos p
  cross join regla
  cross join mes
  -- La vista es `security_invoker`: si el que pregunta no puede ver a ese
  -- vendedor, la fila sale en cero. No hace falta filtrar aquí, y filtrar
  -- aquí sería una segunda regla de visibilidad que se puede desincronizar
  -- de la de `transacciones_zoho`.
  left join public.ventas_del_mes v
    on v.perfil_id = p.id and v.mes = mes.m;
$fn$;

comment on function public.comision_del_equipo is 'Lo vendido y la comisión de varios vendedores en un mes. Una fila por perfil pedido, en cero si no vendió.';
