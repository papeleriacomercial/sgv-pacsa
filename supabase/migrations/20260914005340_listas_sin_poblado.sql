-- La lista deja de tener poblado. El recorrido es su nombre.
--
-- **Decisión del usuario, 13 de septiembre de 2026:** *«el campo opcional de poblado y zona
-- eliminar ya que confunde y no tiene utilidad»*. Es la primera pieza de D-067.
--
-- ============================================================================================
-- LO QUE ESTE CAMPO CAUSÓ
-- ============================================================================================
--
-- Nació con una intención razonable —«permite que la ruta ordene por cercanía y que la cartera se
-- agrupe después por poblado»— pero los vendedores no nombran sus listas por pueblos: las nombran
-- por recorridos. `CHILIBRE-LA CABIMA`, `ALCALDEDIAZ - CALZADA LARGA`, `CALIDONIA Y CENTRAL`.
--
-- Y ese texto **se heredaba a cada cuenta que entraba desde la lista**. Así es como dieciséis
-- cuentas quedaron diciendo que vivían en un pueblo llamado `CALIDONIA Y CENTARL` —con el error de
-- dedo incluido— cuando en la realidad están repartidas en **diez corregimientos y cuatro
-- provincias**, de Calidonia a Penonomé y hasta Los Santos.
--
-- El campo no estaba sucio: **no significaba nada**. Y lo peor no era el dato, era que tres
-- pantallas lo creían.
--
-- ============================================================================================
-- QUÉ SE DESMONTÓ ANTES DE BORRARLO
-- ============================================================================================
--
--   · `potenciales.ts` — la herencia. Era el mecanismo.
--   · `cruzada/page.tsx` — filtraba la cartera con igualdad exacta contra este texto. **Borrar el
--     campo sin tocar eso habría dejado la pantalla vacía sin dar error.**
--   · `buscador-prospectos.tsx` y `mapa/page.tsx` — prellenaban la búsqueda con él, mandando al
--     vendedor a buscar un pueblo que no existe.
--
-- `cuentas.poblado` NO se toca todavía: sigue siendo la única ubicación que hay hasta que se
-- construyan las tres columnas derivadas del punto.

-- ============================================================================================
-- LA VISTA VA PRIMERO
--
-- `listas_resumen` selecciona `l.poblado`, así que el `drop column` falla mientras la vista
-- exista. Se rehace sin esa columna —el resto queda idéntico, copiado de la definición viva— y
-- después se borra el campo. **Con `cascade` habría salido en una línea y habría borrado la
-- vista**, que es de donde salen los contadores de todas las pantallas de listas.
--
-- **Y va con `drop` y no con `create or replace`**, porque reemplazar no puede quitar columnas.
--
-- ⚠️ **`security_invoker = true` NO ES OPCIONAL Y HAY QUE VOLVER A PONERLO.** Una vista sin eso
-- corre con los permisos de su dueño y **se salta el RLS de `listas`**: cada vendedor vería las
-- listas de todo el equipo. Al recrear una vista se pierde la opción si no se repite, y el
-- error no da ningún síntoma — la pantalla simplemente muestra de más. Se comprobó contra la
-- base que la vista viva la tenía antes de tocarla.
-- ============================================================================================

drop view if exists public.listas_resumen;

create view public.listas_resumen with (security_invoker = true) as
 SELECT l.id,
    l.vendedor_id,
    l.nombre,
    l.tipo,
    l.clase,
    l.archivada,
    l.created_at,
    l.updated_at,
    l.created_by,
    l.deleted_at,
    COALESCE(c.total, 0::bigint) AS total,
    COALESCE(c.sin_tocar, 0::bigint) AS sin_tocar,
    COALESCE(c.trabajadas, 0::bigint) AS trabajadas,
    COALESCE(c.viejos, 0::bigint) AS sin_tocar_hace_mucho,
    COALESCE(c.potenciales, 0::bigint) AS sin_tocar_potenciales,
    COALESCE(c.clientes, 0::bigint) AS sin_tocar_clientes
   FROM listas l
     LEFT JOIN LATERAL ( SELECT count(*) AS total,
            count(*) FILTER (WHERE s.fecha IS NULL) AS sin_tocar,
            count(*) FILTER (WHERE s.fecha IS NOT NULL) AS trabajadas,
            count(*) FILTER (WHERE s.fecha IS NULL AND lc.agregada_en < (now() - '60 days'::interval)) AS viejos,
            count(*) FILTER (WHERE s.fecha IS NULL AND cu.tipo <> 'cliente'::tipo_cuenta) AS potenciales,
            count(*) FILTER (WHERE s.fecha IS NULL AND cu.tipo = 'cliente'::tipo_cuenta) AS clientes
           FROM listas_cuentas lc
             JOIN cuentas cu ON cu.id = lc.cuenta_id AND cu.deleted_at IS NULL
             LEFT JOIN LATERAL ( SELECT sg.fecha
                   FROM seguimientos sg
                  WHERE sg.cuenta_id = cu.id AND sg.deleted_at IS NULL AND sg.fecha >= (lc.agregada_en AT TIME ZONE 'America/Panama'::text)::date
                  ORDER BY sg.fecha DESC
                 LIMIT 1) s ON true
          WHERE lc.lista_id = l.id) c ON true
  WHERE l.deleted_at IS NULL;

alter table public.listas drop column poblado;

-- Los permisos no sobreviven al `drop`. Se repiten tal como estaban, y `anon` queda fuera por la
-- misma razón de D-070: una lista de trabajo no tiene nada que hacer del lado anónimo.
grant select on public.listas_resumen to authenticated;
grant select on public.listas_resumen to service_role;
