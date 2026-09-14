-- La ubicación de una cuenta deja de escribirse y pasa a salir del punto — D-067.
--
-- **Tres columnas que nadie teclea:** provincia, distrito y corregimiento. Salen de dónde cayó el
-- punto que el vendedor marcó en el mapa, calculado contra los límites oficiales que viven en
-- esta misma base. El vendedor no gana trabajo: marca el punto, que es lo que ya hacía.
--
-- ============================================================================================
-- POR QUÉ TRES Y NO UNO
-- ============================================================================================
--
-- Porque los dos vendedores necesitan niveles distintos, y ése fue el error original:
--
--   · **El del interior agrupa por distrito** — Aguadulce, Chitré — y ahí el distrito *es* el
--     pueblo. De hecho es lo que venían escribiendo: de las 376 cuentas etiquetadas a mano, 277
--     tenían escrito el distrito.
--   · **El de la ciudad necesita el corregimiento** — Betania, Pueblo Nuevo — porque toda la
--     ciudad de Panamá es un solo distrito y decir «distrito de Panamá» no ubica nada. Las otras
--     51 tenían escrito el corregimiento.
--
-- Un solo campo no puede servir a los dos. Estaban los dos niveles mezclados en una columna.
--
-- ============================================================================================
-- DE DÓNDE SALEN LOS LÍMITES
-- ============================================================================================
--
-- De una tabla propia, cargada una vez. **No es un servicio:** no se consulta por internet, no
-- cuesta por punto, no se cae, y funciona con mala señal en el interior. El cálculo corre dentro
-- de Postgres al guardar, en milisegundos.
--
-- Es mejor que preguntarle a Google también por precisión: su geocodificación inversa devuelve
-- **barrios** —«Obarrio», «El Cangrejo»— y no corregimientos oficiales, así que no agrupan con
-- nada. Y guardar nombres derivados de Google chocaría con la restricción de Places, que sólo
-- permite conservar indefinidamente el `place_id`.
--
-- Los polígonos son los del **Smithsonian Tropical Research Institute, división de 2020, 699
-- corregimientos, licencia CC-BY-SA-4.0**. La capa trae provincia, distrito, corregimiento y el
-- código del censo en la misma fila, así que un solo cálculo llena los tres campos.
--
-- **Falta pedirle al IGN Tommy Guardia la oficial de 2025** (730 corregimientos): su servidor
-- público entrega los nombres pero no la geometría. Cambiarla después es recargar esta tabla; el
-- diseño no depende de cuál archivo sea.

create extension if not exists postgis with schema extensions;

-- --------------------------------------------------------------------------------------------
-- 1. Los límites
-- --------------------------------------------------------------------------------------------

create table public.corregimientos (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null,
  provincia   text not null,
  distrito    text not null,
  corregimiento text not null,
  -- Si es la cabecera de su distrito. Sirve para saber que «Aguadulce (Cab.)» y el distrito de
  -- Aguadulce son el mismo sitio para un humano.
  cabecera    boolean not null default false,
  geom        extensions.geometry(MultiPolygon, 4326) not null,
  created_at  timestamptz not null default now()
);

comment on table public.corregimientos is
  'Límites político-administrativos de Panamá: un renglón por corregimiento, con su distrito y provincia. Fuente: Smithsonian Tropical Research Institute, división de 2020, CC-BY-SA-4.0. Se carga con scripts/corregimientos-cargar.mjs y no se edita a mano.';

create index corregimientos_geom_idx on public.corregimientos using gist (geom);
create unique index corregimientos_codigo_unico on public.corregimientos (codigo);

alter table public.corregimientos enable row level security;

-- **Los límites de Panamá no son secreto de nadie**, y toda pantalla que muestre una cuenta
-- puede necesitar traducir un punto. Lectura para cualquiera con sesión; escritura para nadie
-- —se cargan con la llave de servicio, que se salta el RLS— porque un vendedor no tiene por qué
-- poder mover la frontera de un corregimiento.
create policy "corregimientos_lectura"
  on public.corregimientos
  for select
  to authenticated
  using (true);

-- --------------------------------------------------------------------------------------------
-- 2. Las tres columnas de la cuenta
-- --------------------------------------------------------------------------------------------

alter table public.cuentas
  add column provincia text,
  add column distrito text,
  add column corregimiento text;

comment on column public.cuentas.provincia is 'Derivada del punto. NADIE la escribe: la pone ubicar_cuenta() al guardar.';
comment on column public.cuentas.distrito is 'Derivada del punto. Es el nivel con el que agrupa el vendedor del interior.';
comment on column public.cuentas.corregimiento is 'Derivada del punto. Es el nivel con el que se ubica dentro de la ciudad de Panamá.';

create index cuentas_distrito_idx on public.cuentas (distrito) where deleted_at is null;
create index cuentas_corregimiento_idx on public.cuentas (corregimiento) where deleted_at is null;

-- --------------------------------------------------------------------------------------------
-- 3. Quién las llena
-- --------------------------------------------------------------------------------------------

/**
 * Dónde cae un punto.
 *
 * Devuelve nulo fuera de Panamá o sin coordenadas, y eso es correcto: **un campo vacío es honesto
 * y uno inventado no**.
 */
create or replace function public.ubicar_punto(p_lat numeric, p_lng numeric)
returns table (provincia text, distrito text, corregimiento text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.provincia, c.distrito, c.corregimiento
    from public.corregimientos c
   where p_lat is not null
     and p_lng is not null
     and extensions.st_contains(
           c.geom,
           extensions.st_setsrid(extensions.st_makepoint(p_lng::float8, p_lat::float8), 4326)
         )
   limit 1;
$$;

comment on function public.ubicar_punto(numeric, numeric) is
  'Provincia, distrito y corregimiento de un punto, contra los límites oficiales. Nulo fuera de Panamá.';

/**
 * El disparador que mantiene las tres columnas al día.
 *
 * **Se recalcula cuando cambia el punto, y sólo entonces.** Recalcular en todo UPDATE haría una
 * consulta espacial por cada edición de teléfono.
 *
 * Va como disparador y no como llamada desde la pantalla **porque las cargas masivas no pasan por
 * la pantalla**: el espejo de Zoho y las cargas de Badger escriben directo, y sin esto nacerían
 * sin ubicación. Es la misma lección del catálogo de categorías (D-022).
 */
create or replace function public.ubicar_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  donde record;
begin
  if tg_op = 'UPDATE'
     and new.lat is not distinct from old.lat
     and new.lng is not distinct from old.lng then
    return new;
  end if;

  if new.lat is null or new.lng is null then
    new.provincia := null;
    new.distrito := null;
    new.corregimiento := null;
    return new;
  end if;

  select * into donde from public.ubicar_punto(new.lat, new.lng);

  new.provincia := donde.provincia;
  new.distrito := donde.distrito;
  new.corregimiento := donde.corregimiento;

  return new;
end;
$$;

create trigger cuentas_ubicar
  before insert or update of lat, lng on public.cuentas
  for each row execute function public.ubicar_cuenta();

comment on function public.ubicar_cuenta() is
  'Llena provincia, distrito y corregimiento desde el punto, al crear la cuenta y cada vez que se mueve. Nadie las escribe a mano.';
