-- El cierre semanal: el contrato entre el vendedor y quien lo acompaña.
--
--   Él declara qué va a hacer. Quien lo acompaña responde con contexto y
--   objetivos, sin reescribirle el plan. La semana siguiente el sistema pone
--   lado a lado lo prometido y lo ocurrido. Y él comenta qué pasó.
--
-- Ese ciclo es lo que hoy no existe, y es lo que convierte todo lo demás en una
-- herramienta de gestión en vez de un archivo.
--
-- Ver docs/10-concepto.html y docs/12-flujo-vendedor.html.

create table public.cierres (
  id uuid primary key,
  vendedor_id uuid not null references public.perfiles (id),

  -- El lunes de la semana que se cierra. Una por semana y por persona.
  semana date not null,

  -- ---------------------------------------------------------------------
  -- Los números, congelados.
  --
  -- Se guardan en vez de recalcularse a propósito: **la semana 34 tiene que
  -- seguir diciendo en diciembre lo que dijo en agosto**. Si se recalculan,
  -- una cuenta que se descartó después cambiaría el pasado, y un histórico
  -- que se mueve solo no sirve para comparar nada.
  -- ---------------------------------------------------------------------
  numeros jsonb not null default '{}'::jsonb,

  -- ---------------------------------------------------------------------
  -- Las tres preguntas.
  --
  -- Fijas y concretas, no una caja abierta: "cuéntame la semana" produce
  -- prosa, y en un mes se vuelve la misma frase irrefutable e inútil. Estas
  -- tres producen información, y la tercera es la que devuelve algo.
  -- ---------------------------------------------------------------------
  sorprendio text,
  freno text,
  necesito text,

  -- El plan de la semana entrante: rutas por día y la apuesta.
  -- En jsonb porque es justo lo que va a cambiar de forma durante el piloto.
  plan jsonb not null default '{}'::jsonb,
  apuesta_leads smallint,
  apuesta_clientes smallint,

  enviado_en timestamptz,

  -- La respuesta de quien lo acompaña. Una por vendedor, no una por día.
  respuesta text,
  respondido_por uuid references public.perfiles (id),
  respondido_en timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  deleted_at timestamptz,

  constraint cierres_uno_por_semana unique (vendedor_id, semana),
  constraint cierres_apuesta_razonable check (
    (apuesta_leads is null or apuesta_leads between 0 and 500) and
    (apuesta_clientes is null or apuesta_clientes between 0 and 500)
  ),
  constraint cierres_respuesta_con_sello
    check ((respuesta is null) = (respondido_en is null))
);

comment on table public.cierres is 'El contrato semanal: lo que declaró, lo que le respondieron, y los números congelados de esa semana.';
comment on column public.cierres.numeros is 'Congelados al cerrar. La semana 34 tiene que decir en diciembre lo que dijo en agosto.';

create index cierres_vendedor_idx
  on public.cierres (vendedor_id, semana desc)
  where deleted_at is null;

-- ===========================================================================
-- RLS en la misma migración (§16)
-- ===========================================================================

alter table public.cierres enable row level security;

create policy "cierres_vendedor"
  on public.cierres
  for all
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "cierres_equipo_lider"
  on public.cierres
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

-- El líder responde. Qué puede tocar lo limita el trigger de abajo, no esta
-- política: el RLS decide filas, no columnas.
create policy "cierres_lider_responde"
  on public.cierres
  for update
  to authenticated
  using (public.es_mi_equipo(vendedor_id))
  with check (public.es_mi_equipo(vendedor_id));

create policy "cierres_gerencia"
  on public.cierres
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger cierres_tocar_updated_at
  before update on public.cierres
  for each row execute function public.tocar_updated_at();

-- ===========================================================================
-- El líder cuestiona, no reescribe
--
-- Es la regla que sostiene todo el esquema de abajo hacia arriba: **si el plan
-- se puede editar desde arriba, deja de ser su plan**, y el vendedor aprende a
-- proponer lo que va a ser aprobado. Ahí se acabó la información.
--
-- Un plan flojo con su nombre encima es más útil que uno bueno impuesto: el
-- flojo revela cómo piensa, que es lo que hay que saber del que trabaja solo.
--
-- Por eso la restricción vive en la base y no en la pantalla. Una regla que
-- solo existe en la interfaz se salta desde cualquier otro lado.
-- ===========================================================================

create function public.cierre_solo_el_dueno_edita_su_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El dueño y gerencia pueden con todo.
  if new.vendedor_id = auth.uid() or public.es_gerente() then
    return new;
  end if;

  -- Cualquier otro —el líder— solo puede dejar su respuesta.
  if new.numeros is distinct from old.numeros
     or new.sorprendio is distinct from old.sorprendio
     or new.freno is distinct from old.freno
     or new.necesito is distinct from old.necesito
     or new.plan is distinct from old.plan
     or new.apuesta_leads is distinct from old.apuesta_leads
     or new.apuesta_clientes is distinct from old.apuesta_clientes
     or new.semana is distinct from old.semana
     or new.vendedor_id is distinct from old.vendedor_id then
    raise exception
      'El plan es del vendedor. Puedes responder y agregar objetivos, no reescribirlo.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger cierres_protege_el_plan
  before update on public.cierres
  for each row execute function public.cierre_solo_el_dueno_edita_su_plan();

comment on function public.cierre_solo_el_dueno_edita_su_plan is 'El líder cuestiona, no reescribe. La autoría del plan se queda con quien lo propuso.';
