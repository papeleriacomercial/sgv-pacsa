-- ===========================================================================
-- El catálogo de productos, para consultar en la calle
--
-- 1 834 productos en Zoho Books. El vendedor parado frente al mostrador
-- necesita contestar dos preguntas en segundos: **¿lo tienen?** y **¿a cómo?**
-- Hoy las contesta llamando a la oficina.
--
-- Espejo, como el resto de lo que viene de Books: se rehace en cada pasada y
-- no se edita desde la aplicación.
--
-- **Dos cosas que el catálogo real enseña y hay que respetar:**
--
--   * **Muchos productos tienen precio cero.** No es un error: el precio se
--     negocia por cliente. Mostrar «$0» sería mentir, así que se guarda nulo y
--     la pantalla dice «a consultar».
--   * **Los nombres traen prefijos de cliente** —«# AB», «# Nata»—. Son
--     productos hechos para un comercio concreto. Se guardan tal cual: el
--     vendedor los reconoce y limpiarlos perdería justo lo que los distingue.
-- ===========================================================================

create table public.productos_zoho (
  id            uuid primary key,
  item_id       text not null,

  nombre        text not null,
  descripcion   text,
  sku           text,
  unidad        text,

  -- Nulo cuando en Books viene en cero: ahí el precio se acuerda con el
  -- cliente y enseñar un cero sería peor que no enseñar nada.
  precio        numeric(12, 2),
  existencia    numeric(12, 2) not null default 0,

  activo        boolean not null default true,
  se_vende      boolean not null default true,

  sincronizado_en timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint productos_zoho_item_unico unique (item_id)
);

create index productos_zoho_nombre_idx
  on public.productos_zoho (public.normalizar_texto(nombre))
  where deleted_at is null;

comment on table public.productos_zoho is 'Catálogo de Books para consultar precio y existencia en la calle. Espejo: se rehace en cada pasada.';
comment on column public.productos_zoho.precio is 'Nulo si en Books viene en cero: ese precio se negocia por cliente y mostrar un cero sería mentir.';

alter table public.productos_zoho enable row level security;

-- El catálogo lo lee todo el equipo: no hay nada privado en un precio de lista,
-- y filtrarlo por vendedor solo serviría para que llamen a preguntar.
create policy "productos_zoho_lectura"
  on public.productos_zoho for select to authenticated using (true);

create policy "productos_zoho_gerencia"
  on public.productos_zoho for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

create trigger productos_zoho_tocar_updated_at
  before update on public.productos_zoho
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Buscar como busca una persona
--
-- «rollo termico 80» tiene que encontrar «Rollos Térmicos TE080070 #75 E50»:
-- sin acentos, sin importar el orden y aunque falten palabras. Un `ilike` con
-- comodines no sirve —exige el orden exacto— y para 1 834 filas no hace falta
-- montar búsqueda de texto completo.
-- ---------------------------------------------------------------------------

create function public.buscar_productos(p_texto text, p_limite integer default 40)
returns setof public.productos_zoho
language sql
stable
set search_path = public
as $fn$
  select p.*
  from public.productos_zoho p
  where p.deleted_at is null
    and p.activo
    and p.se_vende
    and (
      coalesce(trim(p_texto), '') = ''
      or (
        select bool_and(public.normalizar_texto(p.nombre) like '%' || palabra || '%')
        from unnest(string_to_array(public.normalizar_texto(p_texto), ' ')) as palabra
        where palabra <> ''
      )
    )
  -- Lo que hay en existencia primero: es lo que se puede prometer hoy.
  order by (p.existencia > 0) desc, p.nombre
  limit greatest(1, least(p_limite, 100));
$fn$;

comment on function public.buscar_productos is 'Busca por palabras sueltas, sin acentos ni orden. Lo que hay en existencia sale primero.';
