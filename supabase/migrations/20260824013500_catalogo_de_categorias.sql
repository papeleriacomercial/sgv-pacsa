-- ===========================================================================
-- El catálogo de tipos de comercio se defiende de sí mismo
--
-- D-012 lo dejó abierto a propósito —nadie enumera por adelantado los tipos de
-- comercio de un país— y prometió que gerencia podría fusionar duplicados y
-- desactivar las que sobren. La parte de fusionar nunca se construyó, y el
-- catálogo hizo lo que hace un catálogo abierto sin defensas: «Panadería» y
-- «Panaderia» conviviendo, y un «mimisuper» que es un dedazo.
--
-- Tres capas, en este orden:
--
--   1. Que no se pueda crear el duplicado. El índice único ignoraba los
--      acentos, así que «Panadería» y «Panaderia» eran filas distintas.
--   2. Que escribir mal no cree nada. Al guardar la cuenta ya no se inserta a
--      ciegas: se pregunta al catálogo cómo se escribe, y la cuenta se queda
--      con la grafía buena.
--   3. Que se pueda limpiar lo que ya entró, que es lo que faltaba.
--
-- La primera capa sola no bastaba: el catálogo tenía «Panadería» y las cuentas
-- decían «Panaderia», porque tipo_comercio es texto libre y nunca se comparó
-- contra el catálogo al guardar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Comparar como compara una persona
--
-- unaccent() sería lo natural, pero no es inmutable —depende del diccionario
-- cargado— y no puede indexarse sin envolverla en una mentira. translate() sí
-- es inmutable, y el español que se escribe aquí cabe de sobra.
-- ---------------------------------------------------------------------------

create function public.normalizar_texto(t text)
returns text
language sql
immutable
strict
as $fn$
  select translate(
    lower(trim(t)),
    'áéíóúüñàèìòùâêîôûäëïöÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖ',
    'aeiouunaeiouaeiouaeioaeiouunaeiouaeiouaeio'
  );
$fn$;

comment on function public.normalizar_texto is 'Texto comparable: sin mayúsculas, sin acentos y sin espacios sobrantes. Panadería y Panaderia son la misma palabra.';

-- ---------------------------------------------------------------------------
-- 2. Las cuentas se quedan con la grafía del catálogo
--
-- Antes de apretar el índice hay que dejar los datos coherentes, o la primera
-- fusión chocaría contra cuentas que dicen otra cosa.
-- ---------------------------------------------------------------------------

-- 2.a Lo que los vendedores escribieron en las cuentas y nunca llegó al
--     catálogo entra ahora. Gana la grafía más usada; a igualdad, la que trae
--     acentos, que en español casi siempre es la correcta.
insert into public.categorias_comercio (id, nombre, created_by)
select
  gen_random_uuid(),
  (array_agg(u.tipo_comercio order by u.veces desc, (u.tipo_comercio <> public.normalizar_texto(u.tipo_comercio)) desc))[1],
  (select p.id from public.perfiles p where p.rol = 'gerente' limit 1)
from (
  select trim(tipo_comercio) as tipo_comercio, count(*) as veces
  from public.cuentas
  where deleted_at is null and trim(coalesce(tipo_comercio, '')) <> ''
  group by 1
) u
where not exists (
  select 1 from public.categorias_comercio c
  where c.deleted_at is null
    and public.normalizar_texto(c.nombre) = public.normalizar_texto(u.tipo_comercio)
)
  and (select p.id from public.perfiles p where p.rol = 'gerente' limit 1) is not null
group by public.normalizar_texto(u.tipo_comercio);

-- 2.b Los duplicados que ya estaban en el catálogo se funden en uno. Gana la
--     grafía más usada en las cuentas; a igualdad, la acentuada; y si todo
--     empata, la más antigua.
with ranking as (
  select
    c.id,
    row_number() over (
      partition by public.normalizar_texto(c.nombre)
      order by
        (select count(*) from public.cuentas u
          where u.deleted_at is null
            and trim(u.tipo_comercio) = trim(c.nombre)) desc,
        (c.nombre <> public.normalizar_texto(c.nombre)) desc,
        c.created_at asc
    ) as puesto
  from public.categorias_comercio c
  where c.deleted_at is null
)
update public.categorias_comercio c
set deleted_at = now()
from ranking r
where c.id = r.id and r.puesto > 1;

-- 2.c Toda cuenta pasa a decir exactamente lo que dice el catálogo.
update public.cuentas u
set tipo_comercio = c.nombre
from public.categorias_comercio c
where c.deleted_at is null
  and u.deleted_at is null
  and public.normalizar_texto(u.tipo_comercio) = public.normalizar_texto(c.nombre)
  and u.tipo_comercio <> c.nombre;

-- ---------------------------------------------------------------------------
-- 3. El índice que impide el próximo duplicado
-- ---------------------------------------------------------------------------

drop index if exists public.categorias_nombre_unico;

create unique index categorias_nombre_unico
  on public.categorias_comercio (public.normalizar_texto(nombre))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Escribir una categoría ya no inserta a ciegas
--
-- Devuelve cómo se escribe la categoría: la del catálogo si ya existe con otra
-- grafía, o la recién creada. Quien llama guarda ese texto en la cuenta, y así
-- el dato nace alineado con el catálogo en vez de divergir.
-- ---------------------------------------------------------------------------

create function public.asegurar_categoria(p_nombre text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  limpio text := trim(p_nombre);
  canonico text;
begin
  if length(limpio) < 3 then
    return null;
  end if;

  select c.nombre into canonico
  from public.categorias_comercio c
  where c.deleted_at is null
    and public.normalizar_texto(c.nombre) = public.normalizar_texto(limpio)
  limit 1;

  if canonico is not null then
    return canonico;
  end if;

  insert into public.categorias_comercio (id, nombre, created_by)
  values (gen_random_uuid(), limpio, auth.uid());

  return limpio;

-- Otro vendedor la creó en el mismo instante. Es lo que debe pasar en un
-- catálogo compartido: se adopta la suya.
exception when unique_violation then
  select c.nombre into canonico
  from public.categorias_comercio c
  where c.deleted_at is null
    and public.normalizar_texto(c.nombre) = public.normalizar_texto(limpio)
  limit 1;
  return coalesce(canonico, limpio);
end;
$fn$;

comment on function public.asegurar_categoria is 'Devuelve cómo se escribe esta categoría, creándola si no existe. Evita que Panadería y Panaderia sean dos.';

-- ---------------------------------------------------------------------------
-- 5. Limpiar lo que ya entró
--
-- Quién puede: gerencia y el líder. D-012 decía solo gerencia; se amplía
-- porque el líder revisa el trabajo del equipo semana a semana y ve los
-- dedazos el viernes, no dentro de un mes.
-- ---------------------------------------------------------------------------

create function public.puede_depurar_catalogo()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol in ('gerente', 'lider')
  );
$fn$;

comment on function public.puede_depurar_catalogo is 'True si el usuario puede fusionar, renombrar o desactivar categorías de comercio.';

drop policy if exists "categorias_gerencia" on public.categorias_comercio;

create policy "categorias_depuracion"
  on public.categorias_comercio
  for all
  to authenticated
  using (public.puede_depurar_catalogo())
  with check (public.puede_depurar_catalogo());

-- Fusionar: las cuentas de la que sobra pasan a la que queda, y la que sobra
-- se borra lógicamente. Devuelve cuántas cuentas se movieron.
create function public.fusionar_categoria(p_origen uuid, p_destino uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  nombre_origen text;
  nombre_destino text;
  movidas integer;
begin
  if not public.puede_depurar_catalogo() then
    raise exception 'Depurar el catálogo es del líder o de gerencia.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_origen = p_destino then
    raise exception 'No se puede fusionar una categoría consigo misma.'
      using errcode = 'check_violation';
  end if;

  select nombre into nombre_origen from public.categorias_comercio
    where id = p_origen and deleted_at is null;
  select nombre into nombre_destino from public.categorias_comercio
    where id = p_destino and deleted_at is null;

  if nombre_origen is null or nombre_destino is null then
    raise exception 'Una de las dos categorías ya no existe.'
      using errcode = 'no_data_found';
  end if;

  update public.cuentas
  set tipo_comercio = nombre_destino
  where deleted_at is null
    and public.normalizar_texto(tipo_comercio) = public.normalizar_texto(nombre_origen);

  get diagnostics movidas = row_count;

  update public.categorias_comercio
  set deleted_at = now()
  where id = p_origen;

  return movidas;
end;
$fn$;

comment on function public.fusionar_categoria is 'Mueve las cuentas de una categoría a otra y borra la que sobra. Devuelve cuántas cuentas cambiaron.';

-- Renombrar arrastra las cuentas: si no, corregir «mimisuper» dejaría el
-- catálogo bien y los datos mal, que es peor que no corregir.
create function public.renombrar_categoria(p_id uuid, p_nombre text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  limpio text := trim(p_nombre);
  anterior text;
  movidas integer;
begin
  if not public.puede_depurar_catalogo() then
    raise exception 'Depurar el catálogo es del líder o de gerencia.'
      using errcode = 'insufficient_privilege';
  end if;

  if length(limpio) < 3 then
    raise exception 'El nombre de la categoría necesita al menos tres letras.'
      using errcode = 'check_violation';
  end if;

  select nombre into anterior from public.categorias_comercio
    where id = p_id and deleted_at is null;

  if anterior is null then
    raise exception 'Esa categoría ya no existe.' using errcode = 'no_data_found';
  end if;

  update public.categorias_comercio set nombre = limpio where id = p_id;

  update public.cuentas
  set tipo_comercio = limpio
  where deleted_at is null
    and public.normalizar_texto(tipo_comercio) = public.normalizar_texto(anterior);

  get diagnostics movidas = row_count;

  return movidas;
end;
$fn$;

comment on function public.renombrar_categoria is 'Corrige el nombre de una categoría y arrastra las cuentas que la usaban.';

-- ---------------------------------------------------------------------------
-- 6. La vista que alimenta la pantalla de depuración
--
-- El uso es lo que decide cuál sobrevive a una fusión; sin él la pantalla
-- pediría decidir a ciegas.
-- ---------------------------------------------------------------------------

create view public.categorias_uso
with (security_invoker = true)
as
select
  c.id,
  c.nombre,
  c.activa,
  c.created_at,
  coalesce(u.cuentas, 0) as cuentas
from public.categorias_comercio c
left join lateral (
  select count(*) as cuentas
  from public.cuentas x
  where x.deleted_at is null
    and public.normalizar_texto(x.tipo_comercio) = public.normalizar_texto(c.nombre)
) u on true
where c.deleted_at is null;

comment on view public.categorias_uso is 'Catálogo de categorías con cuántas cuentas usa cada una. Alimenta la pantalla de depuración.';
