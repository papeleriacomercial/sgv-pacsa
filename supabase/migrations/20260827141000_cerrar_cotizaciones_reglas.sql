-- ===========================================================================
-- Una cotización se cierra, y el motivo se guarda — parte 2: las reglas
--
-- Ver la migración anterior para el porqué de los estados. Acá van las columnas
-- del cierre, la regla de que perder exige motivo, y la vista que decide qué
-- sigue viva.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. El cierre
-- ---------------------------------------------------------------------------

alter table public.cotizaciones
  add column cerrada_en    timestamptz,
  add column cerrada_por   uuid references public.perfiles (id),
  add column motivo_perdida public.motivo_perdida;

comment on column public.cotizaciones.cerrada_en is
  'Cuándo se dio por ganada o perdida. Distinto de anulada_en: anular es corregir un papel, cerrar es contar qué pasó con el cliente.';
comment on column public.cotizaciones.cerrada_por is
  'Quién la cerró. Casi siempre el vendedor; queda registrado porque es un dato que después se mide.';
comment on column public.cotizaciones.motivo_perdida is
  'Del catálogo cerrado, el mismo de las oportunidades. **Es la razón de ser de todo esto**: sin él, «perdimos» no se puede repartir entre precio, plazo y especificación.';

-- Ganada y perdida llevan sello; perder además exige el motivo. Un catálogo
-- cerrado y no texto libre: es lo que permite sumar «cuánto se perdió por
-- precio» sin que nadie tenga que leer trescientas notas.
alter table public.cotizaciones
  add constraint cotizaciones_cerrada_con_sello
    check (
      (estado in ('ganada', 'perdida')) = (cerrada_en is not null)
      and (estado <> 'perdida' or motivo_perdida is not null)
      and (estado = 'perdida' or motivo_perdida is null)
    );

-- ---------------------------------------------------------------------------
-- 2. Qué está viva, y desde cuándo dejó de estarlo
-- ---------------------------------------------------------------------------
--
-- **Vencida se deduce, no se guarda.** Dos ventanas, acordadas con el usuario
-- el 27 de agosto de 2026:
--
--   · Hasta los días de validez (15 por omisión): vigente.
--   · De ahí a 30 días: **vencida pero a la vista.** Es justo la que hay que
--     volver a llamar, y esconderla sería perder la venta por silencio.
--   · Pasados los 30: sale de la lista como «sin respuesta».
--
-- `hoy_panama()` y no `current_date`: la base corre en UTC y a partir de las
-- 7 p.m. de Panamá `current_date` ya es mañana (D-021).
-- ---------------------------------------------------------------------------

create view public.cotizaciones_vivas as
  select
    c.*,
    (c.emitida_en at time zone 'America/Panama')::date + c.validez_dias as vence_el,
    hoy_panama() - ((c.emitida_en at time zone 'America/Panama')::date + c.validez_dias)
      as dias_vencida,
    hoy_panama() > (c.emitida_en at time zone 'America/Panama')::date + c.validez_dias
      as esta_vencida
  from public.cotizaciones c
  where c.estado = 'emitida'
    and c.deleted_at is null
    -- Treinta días después de vencer deja de aparecer. No se cierra ni se
    -- borra: sigue en la tabla, con su estado 'emitida', para que el histórico
    -- diga la verdad. Lo que se acaba es la persecución.
    and hoy_panama() <= (c.emitida_en at time zone 'America/Panama')::date
                        + c.validez_dias + 30;

comment on view public.cotizaciones_vivas is
  'Las cotizaciones que todavía hay que perseguir. Vencida no es un estado guardado: se deduce, así que no hay trabajo nocturno que pueda fallar y dejar la lista mintiendo.';

alter view public.cotizaciones_vivas set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- 3. Cerrar varias de una
-- ---------------------------------------------------------------------------
--
-- El vendedor cierra desde la lista de la cuenta y puede marcar más de una: un
-- mismo cliente pide dos o tres cotizaciones para comparar cantidades. Lo que
-- **no** se hace es cerrarlas todas porque sí — puede haber una viva de bolsas
-- y una muerta de rollos, y decidir por él sería inventar un hecho.
-- ---------------------------------------------------------------------------

create function public.cerrar_cotizaciones(
  p_ids     uuid[],
  p_estado  public.estado_cotizacion,
  p_motivo  public.motivo_perdida default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  n integer;
begin
  if p_estado not in ('ganada', 'perdida') then
    raise exception 'Solo se puede cerrar como ganada o perdida (llegó %). Anular es otra cosa y tiene su propio camino.', p_estado;
  end if;

  if p_estado = 'perdida' and p_motivo is null then
    raise exception 'Una cotización perdida necesita motivo: es lo único que después permite saber por qué se pierden.';
  end if;

  update public.cotizaciones
     set estado         = p_estado,
         cerrada_en     = now(),
         cerrada_por    = auth.uid(),
         motivo_perdida = case when p_estado = 'perdida' then p_motivo end,
         updated_at     = now()
   where id = any (p_ids)
     -- Solo lo que está vivo. Reabrir una cerrada, o cerrar una anulada, sería
     -- reescribir historia; si hace falta corregir, se hace a mano y se ve.
     and estado = 'emitida'
     and deleted_at is null;

  get diagnostics n = row_count;
  return n;
end;
$fn$;

comment on function public.cerrar_cotizaciones is
  'Cierra en bloque las que el vendedor seleccionó. Solo toca las que siguen emitidas: cerrar una ya cerrada sería reescribir historia.';

-- ---------------------------------------------------------------------------
-- Lo que NO se automatiza, y por qué
-- ---------------------------------------------------------------------------
--
-- Se consideró un disparador que cerrara todas las cotizaciones de una cuenta
-- cuando su oportunidad se marca perdida con motivo «no contactar». El
-- argumento era que no hay lectura en la que el cliente diga que no lo llamen
-- más y una cotización siga en pie.
--
-- **Se descartó a propósito**, y la razón la puso el usuario el 27 de agosto de
-- 2026 al elegir el diseño: *«es lo más limpio que estar tú asumiendo»*. Un
-- cierre que ocurre solo es un cierre que el vendedor no vio, y el día que
-- cierre de más —una cotización de bolsas que seguía viva— nadie va a saber
-- por qué desapareció.
--
-- El vendedor cierra lo que él selecciona. Si más adelante se ve que «no
-- contactar» siempre termina cerrando todas a mano, se automatiza entonces,
-- con la evidencia delante.
-- ---------------------------------------------------------------------------
