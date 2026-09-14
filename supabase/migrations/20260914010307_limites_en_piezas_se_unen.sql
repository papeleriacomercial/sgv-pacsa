-- Un corregimiento que viene partido en dos no debe perder la mitad.
--
-- **Se encontró contando**, y por un renglón: el archivo trae 699 rasgos y la tabla quedó con 698.
-- El repetido es `041008` — **Santa Clara, Renacimiento, Chiriquí, dos veces**. No son dos
-- corregimientos distintos con el mismo código: es el mismo, partido en dos piezas en el origen.
--
-- La versión anterior de `cargar_corregimiento` hacía `do update set geom = excluded.geom`, o sea
-- **se quedaba con la última pieza y tiraba la primera**. Un punto en la mitad perdida habría
-- resuelto a nulo, o peor, al corregimiento vecino — sin que nada avisara.
--
-- Ahora las piezas se unen. `ST_Union` de una geometría consigo misma devuelve la misma, así que
-- volver a correr la carga completa es inofensivo.
--
-- La lección, que vale para el archivo oficial del IGN cuando llegue: **contar lo que entró contra
-- lo que se mandó.** El guion decía «699 corregimientos en la base» porque contó sus propias
-- llamadas, no las filas. Un total que se calcula solo no comprueba nada.

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
    -- Si alguna de las piezas es cabecera, el corregimiento lo es.
    cabecera      = public.corregimientos.cabecera or excluded.cabecera,
    -- **SE UNEN, NO SE PISAN.** Ver el encabezado: Santa Clara viene en dos pedazos.
    geom          = extensions.ST_Multi(
                      extensions.ST_Union(public.corregimientos.geom, excluded.geom)
                    );
end;
$$;

comment on function public.cargar_corregimiento(text, text, text, text, boolean, text) is
  'Mete o actualiza un corregimiento con su contorno, simplificado respetando los bordes vecinos. Si el código ya existe, UNE la geometría en vez de reemplazarla: el origen trae corregimientos partidos en varias piezas. Sólo la llave de servicio.';
