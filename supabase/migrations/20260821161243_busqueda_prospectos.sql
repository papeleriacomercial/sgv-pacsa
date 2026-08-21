-- Búsqueda de prospectos: semáforo de estado y descartes con motivo.
-- Especificado en docs/05-modulos/7.4-busqueda-prospectos.md.

-- ===========================================================================
-- Motivos de descarte
--
-- Propuestos, pendientes de confirmar con los vendedores. Como todo catálogo
-- cerrado, va como enum: cambiarlo exige migración (D-004).
-- ===========================================================================

create type public.motivo_descarte as enum (
  'no_existe',
  'muy_pequeno',
  'no_usa_productos',
  'ya_atendido',
  'otro'
);

-- ===========================================================================
-- descartes
--
-- Un punto que el vendedor decidió no trabajar, con su razón. Convierte el
-- conocimiento local en dato del sistema: elimina la pregunta "¿por qué no
-- visitaste este punto?" y permite auditar después si el criterio fue correcto
-- (§7.5).
--
-- Solo guarda el `place_id`. Nada de nombres ni teléfonos de Google.
-- ===========================================================================

create table public.descartes (
  id          uuid primary key,
  place_id    text not null,
  motivo      public.motivo_descarte not null,
  nota        text,
  vendedor_id uuid not null references public.perfiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid not null default auth.uid() references public.perfiles (id),
  deleted_at  timestamptz
);

comment on table public.descartes is 'Puntos descartados sin visitar, con su motivo. Visibles para todo el equipo.';
comment on column public.descartes.place_id is 'Lo único de Google que se guarda. El nombre del local nunca se almacena.';

create unique index descartes_place_id_unico
  on public.descartes (place_id)
  where deleted_at is null;

alter table public.descartes enable row level security;

-- Excepción deliberada al modelo de "cada quien ve lo suyo": los descartes se
-- leen entre todo el equipo. Si un vendedor marca que un local cerró, no tiene
-- sentido que el siguiente lo vuelva a recorrer. Lo que se comparte es un
-- hecho del mundo, no información comercial.
create policy "descartes_lectura_equipo"
  on public.descartes
  for select
  to authenticated
  using (true);

create policy "descartes_escribe_su_dueno"
  on public.descartes
  for insert
  to authenticated
  with check (vendedor_id = auth.uid());

-- Corregir el propio descarte es normal; borrar el de otro, no.
create policy "descartes_edita_su_dueno"
  on public.descartes
  for update
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "descartes_gerencia"
  on public.descartes
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger descartes_tocar_updated_at
  before update on public.descartes
  for each row
  execute function public.tocar_updated_at();

-- ===========================================================================
-- estado_de_puntos
--
-- El semáforo de §7.4. Recibe los `place_id` que devolvió Google y dice cuáles
-- ya están en el sistema.
--
-- Es security definer porque el RLS impide que un vendedor lea los prospectos
-- de otro, y sin eso el aviso "esto es de un compañero" nunca aparecería.
--
-- La salida es deliberadamente pobre: estado, nombre del vendedor, y fecha y
-- resultado de la última visita. Nada de contacto, notas ni montos. Alcanza
-- para decidir a dónde ir y no abre el expediente ajeno.
-- ===========================================================================

create function public.estado_de_puntos(p_place_ids text[])
returns table (
  place_id          text,
  prospecto_id      uuid,
  es_mio            boolean,
  vendedor          text,
  etapa             public.etapa_prospecto,
  ultima_visita     timestamptz,
  ultimo_resultado  public.resultado_visita,
  descartado_por    text,
  motivo_descarte   public.motivo_descarte
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ids.place_id,
    p.id as prospecto_id,
    p.vendedor_id = auth.uid() as es_mio,
    v.nombre as vendedor,
    p.etapa,
    ult.fecha as ultima_visita,
    ult.resultado as ultimo_resultado,
    dv.nombre as descartado_por,
    d.motivo as motivo_descarte
  from unnest(p_place_ids) as ids(place_id)
  left join public.prospectos p
    on p.place_id = ids.place_id and p.deleted_at is null
  left join public.perfiles v on v.id = p.vendedor_id
  left join lateral (
    select x.fecha, x.resultado
    from public.visitas x
    where x.prospecto_id = p.id and x.deleted_at is null
    order by x.fecha desc
    limit 1
  ) ult on true
  left join public.descartes d
    on d.place_id = ids.place_id and d.deleted_at is null
  left join public.perfiles dv on dv.id = d.vendedor_id
  where p.id is not null or d.id is not null;
$$;

comment on function public.estado_de_puntos is 'Semáforo de §7.4. Divulgación controlada: devuelve lo mínimo para decidir a dónde ir.';
