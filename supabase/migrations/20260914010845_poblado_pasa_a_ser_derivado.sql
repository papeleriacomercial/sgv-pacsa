-- `poblado` deja de escribirse y pasa a derivarse, como los otros tres.
--
-- ============================================================================================
-- POR QUÉ SE CONSERVA EN VEZ DE BORRARSE
-- ============================================================================================
--
-- Veintidós archivos lo leen: la cartera, el mapa, la ficha de punto, las cotizaciones, el
-- correo a la oficina, el mercado. **Cambiarlos todos de un golpe es más riesgo que beneficio**,
-- y el riesgo no se reparte parejo: una pantalla que se quede a medias no da error, muestra
-- menos.
--
-- Así que `poblado` sobrevive **como espejo**, llenado por el mismo disparador. Ninguna pantalla
-- se entera, y todas pasan a mostrar la verdad en vez de lo que alguien tecleó. Las tres columnas
-- nuevas quedan para lo que el texto nunca pudo: filtrar y agrupar por nivel.
--
-- Se borrará cuando las pantallas lean `corregimiento` y `distrito` directo. Hasta entonces **no
-- hay dos verdades**, porque las cuatro salen del mismo punto y del mismo cálculo.
--
-- ============================================================================================
-- QUÉ NIVEL MUESTRA, Y POR QUÉ NO SIEMPRE EL MISMO
-- ============================================================================================
--
-- El corregimiento **cuando aporta**, el distrito **cuando el corregimiento es su cabecera**.
--
-- Es la traducción exacta de cómo hablan los dos vendedores. En el interior, el corregimiento
-- cabecera se llama igual que el distrito y sale con un «(Cab.)» pegado: «Aguadulce (Cab.)» es
-- Aguadulce, y nadie dice lo primero. En la ciudad, el distrito es «Panamá» para todo el mundo y
-- lo que ubica es «Betania» o «Pueblo Nuevo».
--
-- Para eso se cargó la marca de cabecera. Un solo campo no podía servir a los dos **mientras lo
-- escribiera una persona**; derivado sí, porque la regla la aplica la base y no la memoria de
-- nadie.

-- Se borra y se rehace: `create or replace` no puede cambiar el tipo de retorno, y aquí gana una
-- columna. Se puede borrar sin `cascade` porque `ubicar_cuenta()` es plpgsql y la resuelve al
-- ejecutarse, no al crearse — no hay dependencia dura que arrastre el disparador.
drop function if exists public.ubicar_punto(numeric, numeric);

create function public.ubicar_punto(p_lat numeric, p_lng numeric)
returns table (provincia text, distrito text, corregimiento text, poblado text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.provincia,
    c.distrito,
    c.corregimiento,
    case when c.cabecera then c.distrito else c.corregimiento end
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
  'Provincia, distrito, corregimiento y el nombre con el que se le llama al sitio, de un punto. Nulo fuera de Panamá.';

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
    -- **El poblado escrito a mano NO se borra cuando no hay punto.** Para las 207 cuentas sin
    -- coordenadas es lo único que hay, y vaciarlo sería perder dato sin ganar nada. Lo que ya no
    -- puede es entrar nuevo: ninguna pantalla lo ofrece.
    return new;
  end if;

  select * into donde from public.ubicar_punto(new.lat, new.lng);

  new.provincia := donde.provincia;
  new.distrito := donde.distrito;
  new.corregimiento := donde.corregimiento;
  -- Fuera de Panamá `donde` viene vacío; ahí se conserva lo que hubiera.
  new.poblado := coalesce(donde.poblado, new.poblado);

  return new;
end;
$$;

-- Y las que ya estaban, al mismo criterio.
update public.cuentas c
   set poblado = case when k.cabecera then k.distrito else k.corregimiento end
  from public.corregimientos k
 where c.deleted_at is null
   and c.lat is not null
   and c.lng is not null
   and extensions.ST_Contains(
         k.geom,
         extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::float8, c.lat::float8), 4326)
       );
