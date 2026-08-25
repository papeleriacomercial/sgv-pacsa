-- ===========================================================================
-- La vista, otra vez, porque `cuentas` ganó `pide_sin_itbms`
--
-- Tercera vez que pasa, y por eso la regla está escrita en el comentario de la
-- propia vista: **un `select c.*` congela la lista de columnas al crearla.**
-- La columna nueva existe en la tabla y la vista sigue sin verla, así que la
-- pantalla que la pida recibe un error y la lee como «no existe» — que fue
-- exactamente el 404 de todas las cuentas del 23 de agosto.
--
-- Se detectó a tiempo esta vez: la comprobación es una consulta a
-- `information_schema` después de cada migración que toca `cuentas`.
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
    else (public.hoy_panama() - (ult.fecha at time zone 'America/Panama')::date)
  end as dias_sin_contacto,
  prox.fecha_compromiso as proximo_compromiso,
  case
    when prox.fecha_compromiso is null then null
    else (prox.fecha_compromiso - public.hoy_panama())
  end as dias_hasta_compromiso,
  case
    when c.dias_cadencia is null then null
    when ult.fecha is null then true
    else (public.hoy_panama() - (ult.fecha at time zone 'America/Panama')::date) > c.dias_cadencia
  end as fuera_de_cadencia,
  (c.lat is null or c.lng is null) as sin_ubicacion,
  (select count(*) from public.oportunidades o
    where o.cuenta_id = c.id and o.deleted_at is null
      and o.etapa not in ('ganado', 'perdido')) as oportunidades_abiertas,

  z.ultima_compra,
  case
    when z.ultima_compra is null then null
    else (public.hoy_panama() - z.ultima_compra)
  end as dias_sin_comprar,
  z.compras_12m,
  z.total_12m,
  z.cadencia_observada,

  -- Lleva más tiempo del que suele tardar en volver a comprar. Distinto de
  -- `fuera_de_cadencia`, que mide si el vendedor lo visitó: esto mide si el
  -- cliente compró. Se puede estar al día en visitas y perdiendo al cliente.
  case
    when z.cadencia_observada is null or z.ultima_compra is null then null
    else (public.hoy_panama() - z.ultima_compra) > z.cadencia_observada
  end as dejo_de_comprar
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
left join public.clientes_zoho z
  on z.cuenta_id = c.id and z.deleted_at is null
where c.deleted_at is null;

comment on view public.cuentas_resumen is 'Cuentas con sus días calculados en hora de Panamá y lo que Books sabe de ellas. REHACER cada vez que se agregue una columna a cuentas: el select * congela la lista.';
