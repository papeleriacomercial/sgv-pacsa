-- ===========================================================================
-- «Hoy» no era hoy después de las 7 de la tarde
--
-- La base de Supabase corre en **UTC**. `current_date` devuelve la fecha UTC,
-- y a las 7:00 p.m. de Panamá en UTC ya es el día siguiente.
--
-- Las vistas mezclaban los dos relojes en la misma resta:
--
--     current_date - (ult.fecha at time zone 'America/Panama')::date
--     ^^^^^^^^^^^^ UTC        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Panamá
--
-- Resultado: una visita registrada esta tarde aparecía como **«Hace 1 día»**
-- desde las 7:00 p.m., y `fuera_de_cadencia` se encendía un día antes de
-- tiempo. Todas las noches, y **justo a la hora en que el vendedor cierra su
-- día** — que es cuando más mira la pantalla.
--
-- Lo mismo en la oportunidad vencida: entre las 7:00 p.m. y la medianoche, una
-- oportunidad que cierra hoy ya se consideraba vencida y quedaba congelada.
--
-- El arreglo es tener **un solo reloj** y que sea el de Panamá. `hoy_panama()`
-- pasa a ser la única forma de preguntar qué día es; `current_date` no vuelve
-- a aparecer en el esquema.
-- ===========================================================================

create function public.hoy_panama()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Panama')::date;
$$;

comment on function public.hoy_panama is 'Qué día es en Panamá. La base corre en UTC: current_date adelanta un día desde las 7 p.m. y nunca debe usarse.';

-- ===========================================================================
-- 1. La vista de cuentas
--
-- Recordatorio de `20260823235831`: el `select c.*` congela la lista de
-- columnas, así que esta vista se rehace entera cada vez que se toca.
-- `security_invoker` no es opcional — sin esa marca la vista salta el RLS.
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

comment on view public.cuentas_resumen is 'Cuentas con sus días calculados en hora de Panamá. REHACER cada vez que se agregue una columna a cuentas: el select * congela la lista.';

-- ===========================================================================
-- 2. La oportunidad vencida
-- ===========================================================================

create or replace function public.oportunidad_vencida_congelada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  hoy date := public.hoy_panama();
begin
  if old.fecha_cierre_estimada is null
     or old.fecha_cierre_estimada >= hoy then
    return new;
  end if;

  -- Cerrarla siempre se puede: registrar el desenlace es un hecho, no una
  -- edición que haya que justificar con una fecha nueva.
  if new.etapa in ('ganado', 'perdido') and old.etapa not in ('ganado', 'perdido') then
    return new;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    return new;
  end if;

  if new.fecha_cierre_estimada is null
     or new.fecha_cierre_estimada <= hoy then
    raise exception
      'La fecha estimada de cierre está vencida. Muévela a una fecha futura antes de modificar la oportunidad.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
