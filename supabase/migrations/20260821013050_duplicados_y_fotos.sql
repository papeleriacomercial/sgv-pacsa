-- Validación de duplicados y almacenamiento de fotos.
-- Especificado en docs/05-modulos/7.1-app-movil-vendedor.md.

-- ===========================================================================
-- buscar_duplicados
--
-- §6 exige avisar "este punto ya está registrado y asignado a X" antes de
-- crear un prospecto. Pero el RLS impide que un vendedor lea los prospectos
-- de otro, así que la consulta directa devolvería cero y el aviso nunca
-- aparecería.
--
-- La salida es deliberadamente pobre: nombre del punto, nombre del vendedor y
-- distancia. Nada de contacto, notas, etapa ni montos. Alcanza para decidir si
-- es el mismo local y no convierte la función en una puerta trasera al
-- expediente ajeno.
-- ===========================================================================

create function public.buscar_duplicados(
  p_nombre   text,
  p_lat      numeric default null,
  p_lng      numeric default null,
  p_ruc      text default null,
  p_place_id text default null
)
returns table (
  id           uuid,
  nombre       text,
  vendedor     text,
  es_mio       boolean,
  distancia_m  numeric,
  coincide_por text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidatos as (
    select
      p.id,
      p.nombre,
      v.nombre as vendedor,
      p.vendedor_id = auth.uid() as es_mio,
      p.place_id,
      p.ruc,
      case
        when p_lat is null or p_lng is null or p.lat is null or p.lng is null then null
        -- Haversine. Sin PostGIS: a escala de 50 metros la diferencia es nula
        -- y evita depender de una extensión que habría que mantener.
        else round((6371000 * 2 * asin(sqrt(
          power(sin(radians(p.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(p.lat)) *
          power(sin(radians(p.lng - p_lng) / 2), 2)
        )))::numeric, 0)
      end as distancia_m
    from public.prospectos p
    join public.perfiles v on v.id = p.vendedor_id
    where p.deleted_at is null
  )
  select
    c.id,
    c.nombre,
    c.vendedor,
    c.es_mio,
    c.distancia_m,
    case
      when p_place_id is not null and c.place_id = p_place_id then 'place_id'
      when p_ruc is not null and c.ruc = p_ruc then 'ruc'
      when c.distancia_m is not null and c.distancia_m < 50 then 'cercania'
      else 'nombre'
    end as coincide_por
  from candidatos c
  where (p_place_id is not null and c.place_id = p_place_id)
     or (p_ruc is not null and c.ruc = p_ruc)
     or (c.distancia_m is not null and c.distancia_m < 50)
     or (p_nombre is not null and length(p_nombre) >= 4 and c.nombre ilike '%' || p_nombre || '%')
  order by c.distancia_m nulls last
  limit 10;
$$;

comment on function public.buscar_duplicados is 'Divulgación controlada para el aviso de duplicado de §6. Devuelve lo mínimo para decidir, nunca el expediente ajeno.';

-- ===========================================================================
-- Fotos de visitas
--
-- Bucket privado. La ruta es {vendedor_id}/{archivo}, y la política compara
-- ese primer segmento contra auth.uid(). Sin esto el RLS de la tabla visitas
-- sería decorativo: bastaría adivinar la URL para ver la evidencia de otro.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visitas',
  'visitas',
  false,
  5242880, -- 5 MB. Las fotos se comprimen en el cliente antes de subir.
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "visitas_foto_sube_su_dueno"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'visitas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- La lectura sigue el mismo modelo de roles que la tabla: el dueño, su líder y
-- gerencia. La comparación del líder se hace contra texto, sin castear a uuid,
-- para que un archivo con una ruta inesperada no rompa la política entera.
create policy "visitas_foto_lectura"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'visitas'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.es_gerente()
      or exists (
        select 1
        from public.perfiles p
        where p.lider_id = auth.uid()
          and p.id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Las fotos son evidencia: no se reemplazan ni se borran, igual que las
-- visitas. No hay política de update ni de delete para nadie.
