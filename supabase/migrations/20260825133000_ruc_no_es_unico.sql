-- ===========================================================================
-- Dos cuentas sí pueden compartir RUC
--
-- `cuentas_ruc_unico` venía de `prospectos_ruc_unico`, de la primera migración
-- del núcleo de campo, y descansaba en una suposición que resultó falsa:
-- **que un RUC identifica un local**.
--
-- No es así. Una cadena factura sus sucursales bajo el mismo RUC — en el
-- maestro de Books hay 70 RUC repartidos entre 196 contactos — y cada sucursal
-- es un local distinto, con su propia cadencia, su propio contacto y su propia
-- visita. El SGV ya lo tenía claro en su modelo (`cuenta_madre_id`,
-- `tipo_punto`); el índice decía lo contrario.
--
-- Lo descubrió la primera sincronización con Books, que se negó a entrar:
--
--     duplicate key value violates unique constraint "cuentas_ruc_unico"
--
-- **La protección contra duplicados no se pierde: cambia de lugar y de tono.**
-- Ya existe `buscar_duplicados()`, que al crear una cuenta avisa si otra tiene
-- el mismo RUC y deja decidir. Eso es lo correcto: preguntar «¿es una sucursal
-- de esta?» en vez de prohibirlo. La base no puede distinguir un dedazo de una
-- cadena; el vendedor sí.
-- ===========================================================================

drop index if exists public.cuentas_ruc_unico;

create index cuentas_ruc_idx
  on public.cuentas (ruc)
  where deleted_at is null and ruc is not null;

comment on column public.cuentas.ruc is 'RUC del contribuyente. NO es único: una cadena factura sus sucursales bajo el mismo. El aviso de posible duplicado lo da buscar_duplicados().';

-- ---------------------------------------------------------------------------
-- Y de paso, que el aviso compare como compara una persona
--
-- `buscar_duplicados` comparaba `c.ruc = p_ruc`, letra por letra. Con lo que se
-- vio en Books —«8-123-456 DV 12» y «8123456» son el mismo contribuyente— ese
-- aviso no habría saltado nunca donde más falta hace.
--
-- Se conserva la firma exacta: la pantalla de alta espera estas seis columnas
-- con estos nombres. Lo único que cambia son las dos comparaciones de RUC.
-- ---------------------------------------------------------------------------

create or replace function public.buscar_duplicados(
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
as $fn$
  with candidatos as (
    select
      c.id,
      c.nombre,
      v.nombre as vendedor,
      c.vendedor_id = auth.uid() as es_mio,
      c.place_id,
      c.ruc,
      case
        when p_lat is null or p_lng is null or c.lat is null or c.lng is null then null
        -- Haversine. Sin PostGIS: a escala de 50 metros la diferencia es nula
        -- y evita depender de una extensión que habría que mantener.
        else round((6371000 * 2 * asin(sqrt(
          power(sin(radians(c.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(c.lat)) *
          power(sin(radians(c.lng - p_lng) / 2), 2)
        )))::numeric, 0)
      end as distancia_m
    from public.cuentas c
    join public.perfiles v on v.id = c.vendedor_id
    where c.deleted_at is null
  )
  select
    c.id,
    c.nombre,
    c.vendedor,
    c.es_mio,
    c.distancia_m,
    case
      when p_place_id is not null and c.place_id = p_place_id then 'place_id'
      when p_ruc is not null
        and public.normalizar_ruc(c.ruc) = public.normalizar_ruc(p_ruc) then 'ruc'
      when c.distancia_m is not null and c.distancia_m < 50 then 'cercania'
      else 'nombre'
    end as coincide_por
  from candidatos c
  where (p_place_id is not null and c.place_id = p_place_id)
     or (p_ruc is not null
         and public.normalizar_ruc(c.ruc) = public.normalizar_ruc(p_ruc))
     or (c.distancia_m is not null and c.distancia_m < 50)
     or (p_nombre is not null and length(p_nombre) >= 4 and c.nombre ilike '%' || p_nombre || '%')
  order by c.distancia_m nulls last
  limit 10;
$fn$;

comment on function public.buscar_duplicados is 'Divulgación controlada para el aviso de duplicado de §6. Compara el RUC sin guiones ni sufijo DV. Avisa, no prohíbe: una sucursal comparte RUC con su cadena legítimamente.';
