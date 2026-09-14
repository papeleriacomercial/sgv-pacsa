-- Fuera `cuentas.poblado`. El sitio se llama corregimiento.
--
-- Sobrevivía como espejo para no tocar veintidós archivos de un golpe (D-073). Ya se tocaron: hoy
-- cada pantalla lee `corregimiento` directo.
--
-- ============================================================================================
-- SE COMPROBÓ QUE NO SE PIERDE NADA, ANTES DE BORRAR
-- ============================================================================================
--
--   · `poblado` era igual a `corregimiento` en **756 de 759** cuentas.
--   · Las 3 que diferían son del distrito de Los Santos, cuya cabecera se llama «La Villa de Los
--     Santos». **Pasan a mostrar ese nombre**, que es el mismo criterio que el usuario ya escogió
--     en D-075 para La Arena y Barrio Colón: el nombre real, y el distrito aparte para agrupar.
--   · **Ninguna cuenta tenía `poblado` sin `corregimiento` detrás**, y las 207 sin coordenadas no
--     tenían poblado escrito. Comprobado con una consulta, no supuesto.
--   · Y los 359 valores que se sobreescribieron anoche siguen en `auditoria`.
--
-- Con eso muere también la regla de la cabecera: ya no hace falta un campo que elija entre
-- distrito y corregimiento, porque las dos columnas están y cada pantalla escoge la que le toca.

-- --------------------------------------------------------------------------------------------
-- 1. La vista deja de exponerlo
--
-- Va con `drop` y no con `replace`, porque reemplazar no puede quitar columnas. Y **hay que
-- repetir `security_invoker`**: sin él la vista corre con los permisos del dueño y se salta el
-- RLS de `cuentas` — cada vendedor vería la cartera de todos, sin ningún síntoma.
-- --------------------------------------------------------------------------------------------

drop view if exists public.cuentas_resumen;

create view public.cuentas_resumen with (security_invoker = true) as
 SELECT c.id,
    c.nombre,
    c.ruc,
    c.tipo_comercio,
    c.contacto_nombre,
    c.contacto_telefono,
    c.contacto_whatsapp,
    c.contacto_correo,
    c.lat,
    c.lng,
    c.place_id,
    c.productos_interes,
    c.vendedor_id,
    c.origen,
    c.notas,
    c.created_at,
    c.updated_at,
    c.created_by,
    c.deleted_at,
    c.tipo,
    c.volumen,
    c.direccion,
    c.dias_cadencia,
    c.motivo_descarte,
    c.cuenta_madre_id,
    c.tipo_punto,
    c.zoho_contacto_id,
    c.pide_sin_itbms,
    ult.fecha AS ultimo_contacto,
        CASE
            WHEN ult.fecha IS NULL THEN NULL::integer
            ELSE hoy_panama() - (ult.fecha AT TIME ZONE 'America/Panama'::text)::date
        END AS dias_sin_contacto,
    prox.fecha_compromiso AS proximo_compromiso,
        CASE
            WHEN prox.fecha_compromiso IS NULL THEN NULL::integer
            ELSE prox.fecha_compromiso - hoy_panama()
        END AS dias_hasta_compromiso,
        CASE
            WHEN c.dias_cadencia IS NULL THEN NULL::boolean
            WHEN ult.fecha IS NULL THEN true
            ELSE (hoy_panama() - (ult.fecha AT TIME ZONE 'America/Panama'::text)::date) > c.dias_cadencia
        END AS fuera_de_cadencia,
    c.lat IS NULL OR c.lng IS NULL AS sin_ubicacion,
    ( SELECT count(*) AS count
           FROM oportunidades o
          WHERE o.cuenta_id = c.id AND o.deleted_at IS NULL AND (o.etapa <> ALL (ARRAY['ganado'::etapa_oportunidad, 'perdido'::etapa_oportunidad]))) AS oportunidades_abiertas,
    z.ultima_compra,
        CASE
            WHEN z.ultima_compra IS NULL THEN NULL::integer
            ELSE hoy_panama() - z.ultima_compra
        END AS dias_sin_comprar,
    z.compras_12m,
    z.total_12m,
    z.cadencia_observada,
        CASE
            WHEN z.cadencia_observada IS NULL OR z.ultima_compra IS NULL THEN NULL::boolean
            ELSE (hoy_panama() - z.ultima_compra) > z.cadencia_observada
        END AS dejo_de_comprar,
        CASE
            WHEN z.cadencia_observada IS NULL OR z.ultima_compra IS NULL THEN NULL::integer
            ELSE z.cadencia_observada - (hoy_panama() - z.ultima_compra)
        END AS dias_para_reponer,
    c.provincia,
    c.distrito,
    c.corregimiento
   FROM cuentas c
     LEFT JOIN LATERAL ( SELECT s.fecha
           FROM seguimientos s
          WHERE s.cuenta_id = c.id AND s.deleted_at IS NULL
          ORDER BY s.fecha DESC
         LIMIT 1) ult ON true
     LEFT JOIN LATERAL ( SELECT cp.fecha_compromiso
           FROM compromisos cp
          WHERE cp.cuenta_id = c.id AND cp.deleted_at IS NULL AND cp.cumplido_en IS NULL
          ORDER BY cp.fecha_compromiso
         LIMIT 1) prox ON true
     LEFT JOIN clientes_zoho z ON z.cuenta_id = c.id AND z.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

-- Los permisos no sobreviven al `drop`. Se repiten tal como estaban.
grant select on public.cuentas_resumen to authenticated;
grant select on public.cuentas_resumen to service_role;

-- --------------------------------------------------------------------------------------------
-- 2. El disparador deja de llenarlo
-- --------------------------------------------------------------------------------------------

drop function if exists public.ubicar_punto(numeric, numeric);

create function public.ubicar_punto(p_lat numeric, p_lng numeric)
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

-- --------------------------------------------------------------------------------------------
-- 3. Y fuera la columna
-- --------------------------------------------------------------------------------------------

alter table public.cuentas drop column poblado;
