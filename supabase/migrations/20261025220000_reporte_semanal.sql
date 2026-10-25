-- ===========================================================================
-- EL REPORTE SEMANAL — docs/18-plan-diario.md §4.5
--
-- La semana cambia de papel. **Deja de ser donde se planifica y pasa a ser
-- donde se rinde cuentas**: el plan es diario, y el viernes se genera solo un
-- reporte de una página con lo que de verdad pasó.
--
-- Lo pidió el usuario así: *«el reporte de la semana pasa a ser la confección de
-- un reporte ejecutivo en PDF… enviado a la gerencia… en una sola página
-- 8.5x11»*, y después amplió a quién llega: *«debes enviárselo también al correo
-- [del vendedor] para que lo vean forzosamente en su bandeja de entrada de
-- correo y hagan su propio análisis»*.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ UNA TABLA Y NO SÓLO UN CORREO
-- ---------------------------------------------------------------------------
--
-- Por la observación de gerencia. El usuario fue explícito: *«no haría ningún
-- tipo de intervención diaria sobre el reporte, pero sí en base a un reporte
-- semanal poder hacer mis observaciones generales… y que eso vaya quedando
-- dentro de la herramienta como histórico»*.
--
-- Un correo enviado no se puede comentar ni buscar seis meses después. La fila
-- es lo que convierte el reporte en un expediente.
--
-- ---------------------------------------------------------------------------
-- LOS NÚMEROS SE CONGELAN, Y ES LA DECISIÓN IMPORTANTE
-- ---------------------------------------------------------------------------
--
-- `datos` guarda lo que el reporte dijo **el día que se envió**, no una consulta
-- que se vuelve a correr al abrirlo.
--
-- La razón es concreta: el espejo de Zoho se rehace cada noche y **una factura
-- se puede corregir, anular o entrar tarde**. Si el reporte se recalculara al
-- leerlo, el PDF que el vendedor tiene en su correo y la pantalla que gerencia
-- abre dirían cosas distintas sobre la misma semana — y la conversación se iría
-- en discutir cuál de los dos miente.
--
-- Es la misma lección que `planes_diarios.a_tiempo`: lo que se midió en un
-- momento se guarda, porque la regla de medir va a cambiar.
--
-- **Va en `jsonb` y no en veinte columnas** a propósito: el contenido del
-- reporte va a crecer —los clientes nuevos se agregaron antes de escribir la
-- primera línea— y cada columna nueva obligaría a una migración y a rehacer el
-- histórico. La forma la fija quien lo genera, en `scripts/reporte-semanal.mjs`.
-- ===========================================================================

create table public.reportes_semanales (
  id          uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.perfiles (id),

  -- El lunes de la semana que cierra. Es la llave natural y la que ordena.
  semana      date not null,

  /**
   * Todo lo que el reporte dijo, tal como se envió.
   *
   * Lo arma `scripts/reporte-semanal.mjs`. Hoy lleva disciplina, lo prometido
   * contra lo hecho, lo facturado, los clientes nuevos con sus nombres, el mes
   * con su comisión y el acumulado del año.
   */
  datos       jsonb not null,

  enviado_en  timestamptz,
  /** A qué direcciones salió. Para poder contestar «¿le llegó?» sin adivinar. */
  enviado_a   text[],

  -- ---------------------------------------------------------------------------
  -- La observación de gerencia.
  --
  -- **Se guarda quién la escribió** porque hoy la escribe el usuario y el día
  -- que el líder vuelva de vacaciones la va a escribir él: *«el líder le voy a
  -- relegar eso… a su regreso yo voy a retomar el tema»*. Sin esta columna, el
  -- cambio de manos perdería la historia.
  -- ---------------------------------------------------------------------------
  observacion    text,
  observado_por  uuid references public.perfiles (id),
  observado_en   timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint reportes_semanales_uno_por_semana unique (vendedor_id, semana),

  -- La semana es un lunes. Un reporte fechado un miércoles sería imposible de
  -- comparar con los demás, y el error no se vería hasta ordenar la lista.
  constraint reportes_semanales_semana_es_lunes
    check (extract(isodow from semana) = 1),

  -- Una observación sin firma no sirve de histórico, y una firma sin
  -- observación es una fila a medio escribir.
  constraint reportes_semanales_observacion_firmada
    check (
      (coalesce(trim(observacion), '') <> '') = (observado_en is not null)
      and (observado_en is null or observado_por is not null)
    )
);

comment on table public.reportes_semanales is
  'Un reporte por vendedor y semana, con sus números congelados tal como se enviaron y la observación de gerencia. Reemplaza la captura de `cierres`, que se conserva por su histórico.';
comment on column public.reportes_semanales.datos is
  'Los números tal como se enviaron. NO se recalculan al leer: una factura corregida haría que el PDF del vendedor y la pantalla de gerencia dijeran cosas distintas de la misma semana.';
comment on column public.reportes_semanales.semana is
  'El lunes de la semana que cierra. La semana se cuenta entera de lunes a viernes aunque el mes la parta por el medio.';

create index reportes_semanales_vendedor_idx
  on public.reportes_semanales (vendedor_id, semana desc) where deleted_at is null;
create index reportes_semanales_semana_idx
  on public.reportes_semanales (semana desc) where deleted_at is null;
create index reportes_semanales_sin_observacion_idx
  on public.reportes_semanales (semana desc)
  where deleted_at is null and observacion is null;

create trigger reportes_semanales_tocar_updated_at
  before update on public.reportes_semanales
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: el vendedor lee el suyo, y no lo escribe
--
-- **El reporte no es suyo para editarlo**, y ahí está la diferencia con el
-- cierre semanal que se jubila: aquél lo redactaba el vendedor —y terminó lleno
-- de frases puestas por salir del paso—. Éste lo genera la tarea del viernes a
-- partir de hechos, y el vendedor lo recibe.
--
-- Lo escribe la tarea programada, que entra por el rol de servicio y se salta el
-- RLS por diseño. Desde la aplicación **nadie** inserta reportes.
-- ---------------------------------------------------------------------------

alter table public.reportes_semanales enable row level security;

create policy "reportes_semanales_lectura"
  on public.reportes_semanales for select to authenticated
  using (
    vendedor_id = auth.uid()
    or public.es_gerente()
    or public.es_mi_equipo(vendedor_id)
  );

-- Gerencia y el líder escriben la observación. El vendedor, no: es su reporte,
-- no su descargo — y si pudiera escribir ahí, la observación dejaría de ser de
-- quien supervisa.
create policy "reportes_semanales_observa_quien_supervisa"
  on public.reportes_semanales for update to authenticated
  using (public.es_gerente() or public.es_mi_equipo(vendedor_id))
  with check (public.es_gerente() or public.es_mi_equipo(vendedor_id));

-- ---------------------------------------------------------------------------
-- Que sólo se pueda tocar la observación
--
-- La política de arriba deja actualizar la fila entera, y eso incluiría los
-- números congelados. **Un reporte cuyos números se pueden reescribir no es un
-- expediente**: es una pizarra, y la primera vez que alguien corrija un dato
-- «porque estaba mal» se perderá lo que de verdad se envió.
-- ---------------------------------------------------------------------------

create function public.reporte_semanal_solo_la_observacion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if new.vendedor_id is distinct from old.vendedor_id
     or new.semana is distinct from old.semana
     or new.datos is distinct from old.datos
     or new.enviado_en is distinct from old.enviado_en
     or new.enviado_a is distinct from old.enviado_a then
    raise exception
      'De un reporte enviado sólo se puede escribir la observación. Los números son los que se enviaron ese viernes.'
      using errcode = 'check_violation';
  end if;

  -- La firma la pone la base, no quien llama: así no hay forma de escribir una
  -- observación a nombre de otro.
  if coalesce(trim(new.observacion), '') <> ''
     and new.observacion is distinct from old.observacion then
    new.observado_por := auth.uid();
    new.observado_en := now();
  end if;

  return new;
end;
$fn$;

create trigger reportes_semanales_solo_la_observacion
  before update on public.reportes_semanales
  for each row execute function public.reporte_semanal_solo_la_observacion();

-- ---------------------------------------------------------------------------
-- Lo que falta por observar
--
-- **Es la pantalla de gerencia del lunes.** El usuario no va a intervenir en el
-- día; su intervención es semanal y escrita, así que lo único que necesita ver
-- es qué reportes están esperando su comentario.
-- ---------------------------------------------------------------------------

create view public.reportes_por_observar
with (security_invoker = true)
as
select
  r.id,
  r.vendedor_id,
  r.semana,
  r.enviado_en,
  (public.hoy_panama() - r.semana) as dias_desde_el_lunes
from public.reportes_semanales r
where r.deleted_at is null
  and r.observacion is null
  and r.enviado_en is not null
order by r.semana desc;

comment on view public.reportes_por_observar is
  'Los reportes que esperan la observación de gerencia. Hereda el RLS de la tabla por security_invoker.';
