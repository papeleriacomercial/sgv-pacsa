-- ===========================================================================
-- CUANDO NO SE TRABAJA — docs/18-plan-diario.md §6
--
-- Lo vio el usuario el día del arranque: *«cuando el vendedor esté indispuesto,
-- o sea que no va a trabajar ese día, o esté de vacaciones… para efecto de que
-- ya la aplicación sepa de antemano los días que una persona no va a ingresar
-- planes»*.
--
-- **Sin esto, el esquema arranca injusto.** Un día de vacaciones se cuenta como
-- «no armó el plan», y el primer reporte del viernes le reclamaría a alguien por
-- no planificar un día que no trabajó. La métrica de disciplina —que es todo lo
-- que sostiene el rediseño— quedaría desacreditada en la primera semana.
--
-- ---------------------------------------------------------------------------
-- UN RANGO, NO UN DÍA
-- ---------------------------------------------------------------------------
--
-- Las vacaciones se saben con anticipación y son varios días seguidos; un día
-- indispuesto es un rango de uno. Con una sola forma se cubren los dos, y el
-- sistema **sabe de antemano** qué días no va a haber plan — que es justo lo que
-- el usuario pidió.
--
-- ---------------------------------------------------------------------------
-- QUIÉN LA REGISTRA, Y ÉSTA ES LA DECISIÓN DE FONDO
-- ---------------------------------------------------------------------------
--
-- El vendedor registra la suya **de hoy en adelante**. Hacia atrás, sólo
-- gerencia o el líder.
--
-- La razón: quien se siente mal lo sabe esa mañana y lo marca en diez segundos.
-- **Declarar una ausencia de la semana pasada es exactamente cómo se borra una
-- falta** — después de que el reporte salió y de que alguien la vio. Si hubo un
-- caso de verdad —un accidente, un hospital— lo arregla gerencia, y entonces
-- queda constancia de que alguien lo decidió.
--
-- **Y no bloquea nada.** Marcarse indispuesto no es un permiso que se pide: es
-- un dato que se declara, y se ve. Es el mismo criterio del resto del plan
-- diario — se traba el dato, no la conducta — porque un permiso que hay que
-- esperar se resuelve no avisando.
-- ===========================================================================

create type public.motivo_ausencia as enum (
  'vacaciones',
  'incapacidad',
  'permiso',
  'otro'
);

comment on type public.motivo_ausencia is
  'Por qué no se trabajó. Cerrado para poder contarlo: «cuántos días de incapacidad llevamos» no se puede responder sobre texto libre. El feriado no está acá porque no es de una persona — ver la nota al final de la migración.';

create table public.ausencias (
  id          uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.perfiles (id),

  -- Inclusivos los dos. Un día suelto es `desde = hasta`.
  desde       date not null,
  hasta       date not null,

  motivo      public.motivo_ausencia not null,
  nota        text,

  /**
   * Quién la registró.
   *
   * **Se guarda porque importa quién lo dijo.** Una ausencia que puso el propio
   * vendedor y una que puso gerencia no son lo mismo a la hora de leer el
   * histórico, sobre todo si son muchas.
   */
  registrado_por uuid default auth.uid() references public.perfiles (id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint ausencias_rango_valido check (hasta >= desde),

  -- Un rango de más de un mes casi siempre es un dedazo en el año. Las
  -- vacaciones de esta casa son de días o semanas; si alguna vez hace falta
  -- más, se sube el tope a propósito.
  constraint ausencias_rango_razonable check (hasta - desde <= 45),

  constraint ausencias_otro_se_explica
    check (motivo <> 'otro' or coalesce(trim(nota), '') <> '')
);

comment on table public.ausencias is
  'Los días que una persona no trabaja. Un día indispuesto es un rango de uno. Sin esto, un día de vacaciones se cuenta como «no armó el plan».';
comment on column public.ausencias.hasta is 'Inclusivo. Un día suelto tiene desde = hasta.';

create index ausencias_vendedor_idx
  on public.ausencias (vendedor_id, desde desc) where deleted_at is null;
create index ausencias_rango_idx
  on public.ausencias (desde, hasta) where deleted_at is null;

create trigger ausencias_tocar_updated_at
  before update on public.ausencias
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Que no se pisen entre ellas
--
-- **Dos ausencias solapadas no son un error inofensivo:** al contar los días
-- que alguien no trabajó, los solapados se contarían dos veces y el reporte
-- diría que tuvo más días libres que los del mes.
--
-- Se hace con un disparador y no con una restricción de exclusión para no
-- depender de `btree_gist`, que habría que habilitar en el proyecto.
-- ---------------------------------------------------------------------------

create function public.ausencias_no_se_pisan()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  choca record;
begin
  select a.desde, a.hasta, a.motivo into choca
    from public.ausencias a
   where a.vendedor_id = new.vendedor_id
     and a.deleted_at is null
     and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     -- Dos rangos se pisan cuando cada uno empieza antes de que el otro acabe.
     and a.desde <= new.hasta
     and a.hasta >= new.desde
   limit 1;

  if choca is not null then
    raise exception
      'Ya hay una ausencia registrada del % al % (%). Los días no se pueden contar dos veces.',
      to_char(choca.desde, 'DD/MM'), to_char(choca.hasta, 'DD/MM'), choca.motivo
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$fn$;

create trigger ausencias_no_se_pisan
  before insert or update on public.ausencias
  for each row execute function public.ausencias_no_se_pisan();

-- ---------------------------------------------------------------------------
-- Hacia atrás sólo gerencia
-- ---------------------------------------------------------------------------

create function public.ausencia_no_se_declara_el_pasado()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if public.es_gerente() or public.es_mi_equipo(new.vendedor_id) then
    return new;
  end if;

  if new.desde < public.hoy_panama() then
    raise exception
      'Una ausencia se marca el mismo día o hacia adelante. Si fue un día que ya pasó, pídele a gerencia que lo registre.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger ausencias_no_se_declara_el_pasado
  before insert on public.ausencias
  for each row execute function public.ausencia_no_se_declara_el_pasado();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ausencias enable row level security;

create policy "ausencias_lectura"
  on public.ausencias for select to authenticated
  using (
    vendedor_id = auth.uid()
    or public.es_gerente()
    or public.es_mi_equipo(vendedor_id)
  );

create policy "ausencias_declara_la_suya"
  on public.ausencias for insert to authenticated
  with check (vendedor_id = auth.uid());

-- Borrar la suya sí: alguien marca vacaciones y le cambian los planes. **Pero
-- sólo si todavía no empezó** — borrar una ausencia ya transcurrida es volver a
-- convertir en falta un día que ya se reportó como libre.
create policy "ausencias_cancela_la_que_no_empezo"
  on public.ausencias for delete to authenticated
  using (vendedor_id = auth.uid() and desde > public.hoy_panama());

create policy "ausencias_equipo"
  on public.ausencias for all to authenticated
  using (public.es_gerente() or public.es_mi_equipo(vendedor_id))
  with check (public.es_gerente() or public.es_mi_equipo(vendedor_id));

-- ---------------------------------------------------------------------------
-- La línea del día, ahora con la ausencia
--
-- **Se rehace la función entera porque cambia lo que devuelve.** Y sigue siendo
-- `security definer` por lo mismo de antes: la tabla de planes está cerrada y
-- los pares sólo pueden ver el resumen. La ausencia entra en ese resumen —si
-- alguien no está, el equipo tiene que poder verlo— pero **la nota no**: por qué
-- faltó es asunto suyo y de gerencia.
-- ---------------------------------------------------------------------------

drop function if exists public.plan_del_dia_resumen(date);

create function public.plan_del_dia_resumen(p_fecha date default null)
returns table (
  vendedor_id   uuid,
  nombre        text,
  abierto_en    timestamptz,
  a_tiempo      boolean,
  cerrado       boolean,
  acciones      integer,
  acciones_cumplidas integer,
  ausente       public.motivo_ausencia
)
language sql
security definer
stable
set search_path = public
as $fn$
  select
    pf.id,
    pf.nombre,
    p.abierto_en,
    p.a_tiempo,
    (p.cerrado_en is not null),
    coalesce(a.cuantas, 0)::integer,
    coalesce(a.cumplidas, 0)::integer,
    au.motivo
  from public.perfiles pf
  left join public.planes_diarios p
    on p.vendedor_id = pf.id
   and p.fecha = coalesce(p_fecha, public.hoy_panama())
   and p.deleted_at is null
  left join lateral (
    select
      count(*) as cuantas,
      count(*) filter (where x.logrado is not null and x.logrado >= x.meta) as cumplidas
    from public.plan_acciones x
    where x.plan_id = p.id
  ) a on true
  left join lateral (
    select v.motivo
    from public.ausencias v
    where v.vendedor_id = pf.id
      and v.deleted_at is null
      and coalesce(p_fecha, public.hoy_panama()) between v.desde and v.hasta
    limit 1
  ) au on true
  where pf.deleted_at is null
    and pf.activo
    and pf.rol <> 'gerente'
  order by pf.nombre;
$fn$;

comment on function public.plan_del_dia_resumen is
  'La línea por persona del día: si abrió, a qué hora, si cerró, cuántas metas cumplió y si está ausente. SECURITY DEFINER a propósito, y por eso no devuelve ni la nota del plan ni la de la ausencia. Un vendedor sin plan y sin ausencia sale con todo nulo — que es justamente lo que hay que ver.';

grant execute on function public.plan_del_dia_resumen(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Los días que de verdad se debían
--
-- **Es la pieza que hace justa la medición.** «3 de 5 días con plan» es un
-- reclamo si dos de esos cinco fueron vacaciones; «3 de 3» es un cumplimiento
-- perfecto. Sin esta función, el reporte no puede distinguirlos.
--
-- Cuenta los días hábiles de lunes a viernes del rango, menos los que caen
-- dentro de una ausencia.
--
-- **Los feriados no se descuentan todavía y hay que decirlo:** el SGV no tiene
-- calendario de feriados —el proyecto hermano sí— así que un lunes feriado se
-- sigue contando como día debido. Se nota poco (son nueve al año) y se arregla
-- el día que exista ese calendario, en un solo sitio: acá.
-- ---------------------------------------------------------------------------

create function public.dias_que_se_debian(
  p_vendedor uuid,
  p_desde date,
  p_hasta date
)
returns integer
language sql
stable
set search_path = public
as $fn$
  select count(*)::integer
    from generate_series(p_desde, p_hasta, interval '1 day') as d(dia)
   where extract(isodow from d.dia) between 1 and 5
     and not exists (
       select 1 from public.ausencias a
        where a.vendedor_id = p_vendedor
          and a.deleted_at is null
          and d.dia::date between a.desde and a.hasta
     );
$fn$;

comment on function public.dias_que_se_debian is
  'Días hábiles del rango que esa persona sí debía planificar, descontando sus ausencias. NO descuenta feriados: el SGV no tiene ese calendario todavía.';

grant execute on function public.dias_que_se_debian(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Y las faltas dejan de contar los días libres
-- ---------------------------------------------------------------------------

drop view if exists public.faltas_del_mes;

create view public.faltas_del_mes
with (security_invoker = true)
as
select
  p.vendedor_id,
  date_trunc('month', p.fecha)::date as mes,
  count(*)::integer as dias_con_plan,
  count(*) filter (where not p.a_tiempo)::integer as abiertos_tarde,
  count(*) filter (where p.cerrado_en is null and p.fecha < public.hoy_panama())::integer as sin_cerrar
from public.planes_diarios p
where p.deleted_at is null
  -- **Un día de ausencia no cuenta ni a favor ni en contra.** Si alguien armó
  -- el plan y después le salió una incapacidad, ese día no entra en la
  -- disciplina del mes: no se le premia ni se le reclama.
  and not exists (
    select 1 from public.ausencias a
     where a.vendedor_id = p.vendedor_id
       and a.deleted_at is null
       and p.fecha between a.desde and a.hasta
  )
group by p.vendedor_id, date_trunc('month', p.fecha);

comment on view public.faltas_del_mes is
  'Disciplina por vendedor y mes, sin contar los días de ausencia. No calcula descuentos: el monto es decisión de quien paga.';
