-- ===========================================================================
-- Las categorías escritas en las cuentas entran al catálogo aunque no haya
-- gerente
--
-- El paso 2.a de `20260824013500` exigía un perfil con rol `gerente` para
-- poner en `created_by`, y si no lo había se saltaba el alta entera. En
-- `sgv-pacsa-dev` solo existe un vendedor de prueba, así que «mimisuper» se
-- quedó fuera del catálogo mientras seguía escrito en una cuenta.
--
-- Es el mismo error de fondo dos veces en una semana: **una condición de
-- guardia que, al no cumplirse, no avisa — simplemente no hace nada.**
--
-- Aquí `created_by` sale de quien creó la cuenta que usa la categoría, que
-- además es más honesto: la categoría es suya, no de gerencia.
-- ===========================================================================

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

-- Y las cuentas se alinean con la grafía que quedó en el catálogo.
update public.cuentas u
set tipo_comercio = c.nombre
from public.categorias_comercio c
where c.deleted_at is null
  and u.deleted_at is null
  and public.normalizar_texto(u.tipo_comercio) = public.normalizar_texto(c.nombre)
  and u.tipo_comercio <> c.nombre;
