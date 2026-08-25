-- ===========================================================================
-- El catálogo no se enteró de las importaciones
--
-- Hay **38 tipos de comercio distintos** escritos en las cuentas y solo **3**
-- en el catálogo. Los otros 35 entraron con las cargas de Zoho y de Badger,
-- que escriben directo en `cuentas` sin pasar por `asegurar_categoria()`.
--
-- El efecto es el que reportó el líder: el filtro de la cartera ofrece decenas
-- de tipos —los saca de los datos— pero la pantalla de depuración solo enseña
-- tres, así que **lo que hay que corregir es justo lo que no se puede tocar**.
--
-- Aquí se ponen al día. Y para que no vuelva a pasar, un disparador: cualquier
-- cuenta que se guarde con un tipo que el catálogo no tenga, lo agrega. Da
-- igual si viene de la pantalla, de una carga o de una consulta a mano.
-- ===========================================================================

-- Las cuentas que trajeron las cargas no tienen autor —no las creó una
-- persona— así que la categoría que sale de ellas tampoco puede tenerlo.
alter table public.categorias_comercio alter column created_by drop not null;

comment on column public.categorias_comercio.created_by is 'Quién la escribió. Nulo cuando la trajo una carga: no la creó una persona.';

insert into public.categorias_comercio (id, nombre, created_by)
select
  gen_random_uuid(),
  u.nombre,
  u.autor
from (
  select distinct on (public.normalizar_texto(trim(c.tipo_comercio)))
    trim(c.tipo_comercio) as nombre,
    c.created_by as autor
  from public.cuentas c
  where c.deleted_at is null
    and trim(coalesce(c.tipo_comercio, '')) <> ''
  order by
    public.normalizar_texto(trim(c.tipo_comercio)),
    -- La grafía con acentos gana: en español casi siempre es la correcta.
    (trim(c.tipo_comercio) <> public.normalizar_texto(c.tipo_comercio)) desc,
    c.created_at asc
) u
where not exists (
  select 1 from public.categorias_comercio k
  where k.deleted_at is null
    and public.normalizar_texto(k.nombre) = public.normalizar_texto(u.nombre)
);

-- ---------------------------------------------------------------------------
-- Que no se vuelva a desincronizar
--
-- `asegurar_categoria()` sigue siendo el camino bueno desde la aplicación
-- —devuelve la grafía canónica y evita el duplicado antes de guardarlo—, pero
-- **no puede ser el único**: las cargas masivas no pasan por ahí, y no tiene
-- sentido que una carga de 239 cuentas deje el catálogo mudo.
-- ---------------------------------------------------------------------------

create function public.cuenta_registra_su_categoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.tipo_comercio is null or length(trim(new.tipo_comercio)) < 3 then
    return new;
  end if;

  insert into public.categorias_comercio (id, nombre, created_by)
  select gen_random_uuid(), trim(new.tipo_comercio), new.created_by
  where not exists (
    select 1 from public.categorias_comercio k
    where k.deleted_at is null
      and public.normalizar_texto(k.nombre) = public.normalizar_texto(new.tipo_comercio)
  );

  return new;

-- Dos cuentas guardándose a la vez con la misma categoría nueva. Que gane una
-- es exactamente lo que debe pasar.
exception when unique_violation then
  return new;
end;
$fn$;

comment on function public.cuenta_registra_su_categoria is 'Toda categoría escrita en una cuenta llega al catálogo, venga de la pantalla o de una carga masiva.';

create trigger cuentas_registran_categoria
  after insert or update of tipo_comercio on public.cuentas
  for each row
  execute function public.cuenta_registra_su_categoria();
