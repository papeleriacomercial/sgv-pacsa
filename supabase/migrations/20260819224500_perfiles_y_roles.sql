-- Perfiles y roles del SGV
-- Define el enum de roles, la tabla de perfiles, las funciones auxiliares
-- usadas por RLS (security definer para evitar recursión en las políticas),
-- las políticas de acceso y el trigger de updated_at.

-- ---------------------------------------------------------------------------
-- Enum de roles
-- ---------------------------------------------------------------------------
create type public.rol_usuario as enum (
  'gerente',
  'lider',
  'vendedor',
  'administracion'
);

-- ---------------------------------------------------------------------------
-- Tabla de perfiles
-- ---------------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  rol        public.rol_usuario not null default 'vendedor',
  lider_id   uuid references public.perfiles (id),
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.perfiles is 'Perfil de cada usuario del SGV, ligado 1 a 1 con auth.users.';
comment on column public.perfiles.lider_id is 'Líder al que reporta el usuario; null si no reporta a nadie.';
comment on column public.perfiles.deleted_at is 'Marca de baja lógica; null si el perfil sigue vigente.';

create index perfiles_lider_id_idx on public.perfiles (lider_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para RLS
--
-- Son security definer para que la lectura de public.perfiles que hacen
-- adentro no vuelva a disparar las políticas de la propia tabla (recursión
-- infinita). El search_path fijo evita que un search_path del cliente
-- resuelva "perfiles" a otro esquema.
-- ---------------------------------------------------------------------------
create function public.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select p.rol
  from public.perfiles p
  where p.id = auth.uid();
$$;

comment on function public.rol_actual() is 'Rol del usuario autenticado, o null si no tiene perfil.';

create function public.lider_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.lider_id
  from public.perfiles p
  where p.id = auth.uid();
$$;

comment on function public.lider_actual() is 'Líder asignado al usuario autenticado, o null si no reporta a nadie.';

create function public.es_gerente()
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
      and p.rol = 'gerente'
  );
$$;

comment on function public.es_gerente() is 'True si el usuario autenticado tiene rol gerente.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.perfiles enable row level security;

-- Cada quien ve su propio perfil.
create policy "perfiles_select_propio"
  on public.perfiles
  for select
  to authenticated
  using (id = auth.uid());

-- Cada quien edita su propio perfil, pero no puede reasignarse el rol ni el
-- líder: rol_actual() y lider_actual() son stable, así que ven la fila como
-- estaba al inicio del UPDATE y el with check las compara contra los valores
-- entrantes.
create policy "perfiles_update_propio"
  on public.perfiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = public.rol_actual()
    and lider_id is not distinct from public.lider_actual()
  );

-- Gerencia ve y administra todos los perfiles.
create policy "perfiles_todo_gerencia"
  on public.perfiles
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

-- El líder ve a los perfiles que le reportan.
create policy "perfiles_select_equipo_lider"
  on public.perfiles
  for select
  to authenticated
  using (lider_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.tocar_updated_at() is 'Trigger genérico: refresca updated_at en cada UPDATE.';

create trigger perfiles_tocar_updated_at
  before update on public.perfiles
  for each row
  execute function public.tocar_updated_at();
