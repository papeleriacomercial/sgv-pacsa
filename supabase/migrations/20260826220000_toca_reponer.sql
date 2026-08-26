-- ===========================================================================
-- Avisar antes, no después (§7.7)
--
-- Hoy la vista sabe decir `dejo_de_comprar`: el cliente lleva más tiempo del
-- que suele tardar en volver. **Eso es un diagnóstico tardío.** Cuando el aviso
-- llega, el cliente ya se quedó sin producto — y quien se quedó sin producto ya
-- le compró a otro. La visión pide lo contrario: avisar unos días *antes* del
-- ciclo estimado, que es cuando todavía se puede hacer algo.
--
-- Todo lo necesario ya estaba calculado. Faltaba una resta.
--
-- `dias_para_reponer` = cadencia observada − días desde la última compra.
--
--   > 0   le quedan tantos días de producto
--   = 0   hoy es el día en que suele volver a comprar
--   < 0   ya se le acabó; es el mismo caso que `dejo_de_comprar`
--
-- **Se calcula, no se guarda.** Cambia solo con el paso del tiempo, y una
-- columna guardada estaría mal desde el minuto siguiente a escribirla.
--
-- Tercera regla de esta vista, escrita por cuarta vez: **un `select c.*`
-- congela la lista de columnas al crearla.** Hay que rehacerla entera.
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
  end as dejo_de_comprar,

  -- **Cuántos días de producto le quedan**, según su propio ritmo. Negativo
  -- quiere decir que ya se le acabó. Es el mismo dato que `dejo_de_comprar`
  -- pero con signo y magnitud, que es lo que permite ordenar una ruta: primero
  -- el que se queda sin nada el martes, después el que aguanta hasta el
  -- viernes.
  case
    when z.cadencia_observada is null or z.ultima_compra is null then null
    else z.cadencia_observada - (public.hoy_panama() - z.ultima_compra)
  end as dias_para_reponer
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

comment on view public.cuentas_resumen is 'La cartera con lo derivado: contacto, compromiso, cadencia de visita y ritmo de compra. OJO: se crea con `select c.*`, así que toda columna nueva de `cuentas` obliga a rehacerla entera.';
