-- Dos cosas: una vista que se quedó vieja y un motivo de descarte que faltaba.

-- ===========================================================================
-- 1. `cuentas_resumen` no tenía las columnas de las cadenas
--
-- **Un `select c.*` en una vista congela la lista de columnas al crearla.**
-- `cuenta_madre_id` y `tipo_punto` se agregaron a `cuentas` en
-- `20260823213716_ajustes_del_replanteamiento`, después de la última vez que
-- se rehizo la vista — así que la vista siguió sin ellas.
--
-- El efecto fue feo y silencioso: el expediente pide esas columnas, PostgREST
-- devolvía error, la pantalla lo leía como "no existe" y **todas las cuentas
-- daban 404**. Nada en el tipado ni en el build lo delataba.
--
-- La regla que queda: **toda migración que agregue una columna a `cuentas`
-- tiene que rehacer esta vista.** Y al rehacerla, `security_invoker` no es
-- opcional — sin esa marca la vista salta el RLS y cada vendedor vería la
-- cartera entera.
-- ===========================================================================

drop view if exists public.cuentas_resumen;

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

comment on view public.cuentas_resumen is 'Cuentas con sus días calculados. Hereda el RLS por security_invoker. REHACER cada vez que se agregue una columna a cuentas: el select * congela la lista.';

-- ===========================================================================
-- 2. Falta un motivo de descarte muy del interior
--
-- El local existe y vende, pero **no decide nada**: la compra se negocia en la
-- casa matriz, en Panamá. Para el vendedor de ruta no hay nada que hacer ahí,
-- y descartarlo como "no le interesó" sería falso — sí interesa, pero no es su
-- conversación.
--
-- Y es más que un descarte: es un **hallazgo**. Un punto marcado así es una
-- cuenta del líder, no del vendedor de ruta. Con el tiempo, agrupar los
-- descartes por este motivo dibuja el mapa de qué cadenas hay que atacar por
-- arriba en vez de local por local.
-- ===========================================================================

alter type public.motivo_descarte add value 'negocia_en_panama' after 'ya_atendido';
