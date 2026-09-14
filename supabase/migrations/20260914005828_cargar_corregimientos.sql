-- La puerta por la que entran los límites. Una sola, estrecha y con nombre.
--
-- **Se escribió esto en vez de una función que ejecute SQL**, que era el camino corto: el guion
-- de carga necesita convertir GeoJSON a geometría, y PostgREST no sabe hacerlo. Una función que
-- reciba SQL y lo corra resuelve eso y **deja abierto para siempre un agujero** que nadie va a
-- recordar que existe — aunque hoy sólo la llame la llave de servicio.
--
-- Esta recibe seis datos con su tipo, arma la fila ella misma, y no puede hacer nada más.
--
-- La simplificación va aquí adentro y no en el guion, por una razón que se ve sólo cuando falla:
-- **simplificar cada polígono por su cuenta abre huecos y solapes entre vecinos**, y un punto en
-- la frontera caería en dos corregimientos o en ninguno. `ST_SimplifyPreserveTopology` respeta el
-- borde compartido. La tolerancia —0.0002 grados, unos 20 metros— mueve el contorno menos de lo
-- que se mueve el GPS de un teléfono.

create or replace function public.cargar_corregimiento(
  p_codigo text,
  p_provincia text,
  p_distrito text,
  p_corregimiento text,
  p_cabecera boolean,
  p_geojson text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.corregimientos (codigo, provincia, distrito, corregimiento, cabecera, geom)
  values (
    p_codigo,
    p_provincia,
    p_distrito,
    p_corregimiento,
    coalesce(p_cabecera, false),
    extensions.ST_Multi(
      extensions.ST_SimplifyPreserveTopology(
        extensions.ST_GeomFromGeoJSON(p_geojson),
        0.0002
      )
    )
  )
  on conflict (codigo) do update set
    provincia     = excluded.provincia,
    distrito      = excluded.distrito,
    corregimiento = excluded.corregimiento,
    cabecera      = excluded.cabecera,
    geom          = excluded.geom;
end;
$$;

comment on function public.cargar_corregimiento(text, text, text, text, boolean, text) is
  'Mete o actualiza un corregimiento con su contorno, simplificado respetando los bordes vecinos. Sólo la llave de servicio: los límites no los mueve un vendedor.';

-- **Nadie con sesión normal puede llamarla.** Los límites de Panamá no los cambia el equipo de
-- ventas: los carga `scripts/corregimientos-cargar.mjs` con la llave de servicio. Y `anon` fuera,
-- por la trampa de D-070: revocarle a `public` no le quita el permiso que Supabase le concede
-- solo a cada función nueva.
revoke all on function public.cargar_corregimiento(text, text, text, text, boolean, text) from public;
revoke all on function public.cargar_corregimiento(text, text, text, text, boolean, text) from anon;
revoke all on function public.cargar_corregimiento(text, text, text, text, boolean, text) from authenticated;
grant execute on function public.cargar_corregimiento(text, text, text, text, boolean, text) to service_role;
