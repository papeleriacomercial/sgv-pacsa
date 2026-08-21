-- Núcleo de campo: prospectos, visitas, compromisos y auditoría.
-- Especificado en docs/02-modelo-datos.md y docs/03-seguridad-rls.md.
-- Toda tabla nace con RLS y sus políticas en esta misma migración.

-- ===========================================================================
-- Catálogos
--
-- Son enum y no tablas: catálogos cerrados, donde agregar una opción exige una
-- migración versionada. Ver D-004 en docs/06-decisiones.md.
-- ===========================================================================

create type public.etapa_prospecto as enum (
  'nuevo',
  'contactado',
  'cotizado',
  'negociacion',
  'ganado',
  'perdido'
);

create type public.resultado_visita as enum (
  'no_estaba_encargado',
  'pide_cotizacion',
  'pide_muestra',
  'stock_suficiente',
  'quiere_precio',
  'no_usa_productos',
  'sin_interes',
  'local_cerrado',
  'dejo_informacion'
);

create type public.motivo_perdida as enum (
  'precio',
  'espera_licitacion',
  'no_cumple_especificaciones',
  'sin_interes_real',
  'no_contactar'
);

create type public.tipo_interaccion as enum (
  'visita',
  'llamada',
  'whatsapp',
  'correo',
  'entrega_muestra'
);

create type public.origen_prospecto as enum (
  'calle',
  'busqueda',
  'referido',
  'llamada_entrante',
  'otro'
);

create type public.linea_producto as enum (
  'rollos_fiscales',
  'bolsas_papel',
  'papel_antigrasa',
  'tubos_carton',
  'otros'
);

-- ===========================================================================
-- Funciones auxiliares para RLS
--
-- security definer para que la lectura de perfiles no vuelva a disparar las
-- políticas de perfiles y se caiga en recursión.
-- ===========================================================================

create function public.es_administracion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.rol = 'administracion'
  );
$$;

comment on function public.es_administracion() is 'True si el usuario autenticado es de administración.';

create function public.es_mi_equipo(vendedor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = vendedor
      and (p.id = auth.uid() or p.lider_id = auth.uid())
  );
$$;

comment on function public.es_mi_equipo(uuid) is 'True si ese vendedor reporta al usuario autenticado, o es él mismo.';

-- ===========================================================================
-- prospectos
-- ===========================================================================

create table public.prospectos (
  id                 uuid primary key,
  nombre             text not null,
  ruc                text,
  tipo_comercio      text,
  contacto_nombre    text,
  contacto_telefono  text,
  contacto_whatsapp  text,
  contacto_correo    text,
  lat                numeric,
  lng                numeric,
  place_id           text,
  productos_interes  public.linea_producto[] not null default '{}',
  vendedor_id        uuid not null references public.perfiles (id),
  etapa              public.etapa_prospecto not null default 'nuevo',
  etapa_desde        timestamptz not null default now(),
  origen             public.origen_prospecto not null default 'calle',
  motivo_perdida     public.motivo_perdida,
  fecha_recontacto   date,
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid not null default auth.uid() references public.perfiles (id),
  deleted_at         timestamptz,

  -- El motivo de pérdida existe si y solo si el prospecto está perdido.
  constraint prospectos_motivo_solo_si_perdido
    check ((etapa = 'perdido') = (motivo_perdida is not null)),

  -- Los motivos que significan "reintentar" no se guardan sin fecha. Un campo
  -- opcional se olvida; una restricción, no.
  constraint prospectos_recontacto_obligatorio
    check (
      motivo_perdida is null
      or motivo_perdida not in ('precio', 'espera_licitacion')
      or fecha_recontacto is not null
    )
);

comment on table public.prospectos is 'Prospectos de la fuerza de ventas. El dato es propio, no espejo de Zoho.';
comment on column public.prospectos.place_id is 'Llave silenciosa de Google Places. Es lo único de Places que puede guardarse indefinidamente.';
comment on column public.prospectos.lat is 'GPS capturado por el vendedor, dato propio. No confundir con las coordenadas de Places.';
comment on column public.prospectos.etapa_desde is 'Cuándo entró a la etapa actual. Permite medir cuánto lleva detenido.';

-- Un mismo local no se registra dos veces. Parciales: el borrado es lógico, y
-- un registro borrado no debe bloquear el alta de uno nuevo.
create unique index prospectos_place_id_unico
  on public.prospectos (place_id)
  where deleted_at is null and place_id is not null;

create unique index prospectos_ruc_unico
  on public.prospectos (ruc)
  where deleted_at is null and ruc is not null;

create index prospectos_vendedor_idx on public.prospectos (vendedor_id) where deleted_at is null;
create index prospectos_etapa_idx on public.prospectos (etapa) where deleted_at is null;

alter table public.prospectos enable row level security;

create policy "prospectos_vendedor"
  on public.prospectos
  for all
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

-- El líder ve a su equipo pero no edita: reasignar cartera exige aprobación
-- del gerente y queda en auditoría (§3 de la visión).
create policy "prospectos_equipo_lider"
  on public.prospectos
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

create policy "prospectos_gerencia"
  on public.prospectos
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

-- Administración solo ve su bandeja: los ganados pendientes de alta.
create policy "prospectos_admin_ganados"
  on public.prospectos
  for select
  to authenticated
  using (public.es_administracion() and etapa = 'ganado');

create trigger prospectos_tocar_updated_at
  before update on public.prospectos
  for each row
  execute function public.tocar_updated_at();

-- ===========================================================================
-- visitas
-- ===========================================================================

create table public.visitas (
  id                  uuid primary key,
  prospecto_id        uuid not null references public.prospectos (id),
  vendedor_id         uuid not null references public.perfiles (id),
  tipo                public.tipo_interaccion not null default 'visita',
  fecha               timestamptz not null default now(),
  checkin_lat         numeric,
  checkin_lng         numeric,
  checkin_precision_m numeric,
  sin_gps             boolean not null default false,
  resultado           public.resultado_visita not null,
  notas               text,
  proveedor_actual    text,
  precio_referencia   numeric(12,2),
  foto_path           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid not null default auth.uid() references public.perfiles (id),
  deleted_at          timestamptz,

  -- Una visita lleva coordenadas, o queda marcada como sin GPS. Nunca las dos
  -- cosas nulas en silencio: una visita sin ubicación tiene que verse como tal.
  constraint visitas_gps_o_marca
    check (
      tipo <> 'visita'
      or sin_gps
      or (checkin_lat is not null and checkin_lng is not null)
    )
);

comment on table public.visitas is 'Bitácora de interacciones. Es el hecho registrado del que se deriva todo el avance.';
comment on column public.visitas.sin_gps is 'El GPS no enganchó. Se permite guardar, marcado, para que una falla de señal no sea trabajo perdido.';
comment on column public.visitas.proveedor_actual is 'Inteligencia de competencia (§7.7). Su valor es acumulativo.';

create index visitas_prospecto_idx on public.visitas (prospecto_id, fecha desc) where deleted_at is null;
create index visitas_vendedor_idx on public.visitas (vendedor_id, fecha desc) where deleted_at is null;

alter table public.visitas enable row level security;

-- Las visitas son bitácora: se escriben y se leen, no se editan ni se borran.
-- Si se pudieran reescribir, el check-in y el resultado dejarían de ser
-- evidencia. Una corrección se hace agregando una interacción nueva.
create policy "visitas_vendedor_insert"
  on public.visitas
  for insert
  to authenticated
  with check (vendedor_id = auth.uid());

create policy "visitas_vendedor_select"
  on public.visitas
  for select
  to authenticated
  using (vendedor_id = auth.uid());

create policy "visitas_equipo_lider"
  on public.visitas
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

create policy "visitas_gerencia"
  on public.visitas
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger visitas_tocar_updated_at
  before update on public.visitas
  for each row
  execute function public.tocar_updated_at();

-- ===========================================================================
-- compromisos
-- ===========================================================================

create table public.compromisos (
  id               uuid primary key,
  prospecto_id     uuid not null references public.prospectos (id),
  visita_id        uuid references public.visitas (id),
  vendedor_id      uuid not null references public.perfiles (id),
  descripcion      text not null,
  fecha_compromiso date not null,
  cumplido_en      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid not null default auth.uid() references public.perfiles (id),
  deleted_at       timestamptz
);

comment on table public.compromisos is 'Próximo paso con fecha. Es el motor del seguimiento diario.';

-- La agenda del día: pendientes del vendedor por fecha. Parcial porque los
-- cumplidos no se consultan a diario.
create index compromisos_pendientes_idx
  on public.compromisos (vendedor_id, fecha_compromiso)
  where cumplido_en is null and deleted_at is null;

create index compromisos_prospecto_idx on public.compromisos (prospecto_id) where deleted_at is null;

alter table public.compromisos enable row level security;

-- Aquí sí hay UPDATE del vendedor: reprogramar un compromiso es trabajo
-- normal. Lo que no puede es reasignárselo a otro.
create policy "compromisos_vendedor"
  on public.compromisos
  for all
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "compromisos_equipo_lider"
  on public.compromisos
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

create policy "compromisos_gerencia"
  on public.compromisos
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger compromisos_tocar_updated_at
  before update on public.compromisos
  for each row
  execute function public.tocar_updated_at();

-- ===========================================================================
-- auditoria
--
-- Inmutable a propósito: no lleva updated_at ni deleted_at, y ningún usuario
-- tiene política de insert, update o delete. Las filas las escriben triggers
-- security definer. Una bitácora editable no sirve como bitácora.
-- ===========================================================================

create table public.auditoria (
  id             uuid primary key default gen_random_uuid(),
  tabla          text not null,
  registro_id    uuid not null,
  campo          text not null,
  valor_anterior text,
  valor_nuevo    text,
  actor_id       uuid references public.perfiles (id),
  created_at     timestamptz not null default now()
);

comment on table public.auditoria is 'Bitácora de cambios sensibles. Inmutable: la escriben triggers, no los usuarios.';

create index auditoria_registro_idx on public.auditoria (tabla, registro_id, created_at desc);
create index auditoria_actor_idx on public.auditoria (actor_id, created_at desc);

alter table public.auditoria enable row level security;

create policy "auditoria_gerencia"
  on public.auditoria
  for select
  to authenticated
  using (public.es_gerente());

create policy "auditoria_propia"
  on public.auditoria
  for select
  to authenticated
  using (actor_id = auth.uid());

-- ===========================================================================
-- Triggers de prospectos
-- ===========================================================================

-- Mantiene etapa_desde al día. De aquí sale "cuántos días lleva detenido en
-- negociación", que es lo que la etapa ancha por sí sola no responde (D-005).
create function public.tocar_etapa_desde()
returns trigger
language plpgsql
as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_desde = now();
  end if;
  return new;
end;
$$;

create trigger prospectos_tocar_etapa_desde
  before update on public.prospectos
  for each row
  execute function public.tocar_etapa_desde();

-- Registra en auditoría los dos cambios sensibles de un prospecto: el avance
-- de etapa, del que sale el tiempo de ciclo de §7.3, y la reasignación de
-- cartera, que según §3 requiere aprobación del gerente.
--
-- security definer porque auditoria no tiene política de insert para nadie.
create function public.auditar_prospecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('prospectos', new.id, 'etapa', old.etapa::text, new.etapa::text, auth.uid());
  end if;

  if new.vendedor_id is distinct from old.vendedor_id then
    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('prospectos', new.id, 'vendedor_id', old.vendedor_id::text, new.vendedor_id::text, auth.uid());
  end if;

  return new;
end;
$$;

create trigger prospectos_auditar
  after update on public.prospectos
  for each row
  execute function public.auditar_prospecto();
