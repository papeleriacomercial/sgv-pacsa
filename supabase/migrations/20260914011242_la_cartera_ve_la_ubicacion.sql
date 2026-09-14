-- La cartera tiene que poder leer las tres columnas nuevas.
--
-- **Este es el defecto que el compilador no atrapa**, y este proyecto ya lo sufrió dos veces: el
-- mapa que se volvió invisible y la pantalla de Contrato que pasó doce días diciendo «todavía no
-- hay cierres». `tsc` y `next build` ven una cadena de texto; PostgREST ve una columna que no
-- existe y devuelve un error que la pantalla convierte en vacío.
--
-- `cuentas_resumen` enumera sus columnas, así que agregar campos a `cuentas` no la alcanza. Se
-- encontró preguntándole a la base si las tenía —no leyendo el código— **después** de que todo
-- compilaba en verde.
--
-- Se agregan **al final** de la lista: `create or replace view` permite añadir columnas si las que
-- ya estaban conservan su nombre, su tipo y su orden. Así no hay que borrar la vista ni volver a
-- otorgar permisos, y `security_invoker` se repite igual para que no haya duda — sin él la vista
-- correría con los permisos del dueño y cada vendedor vería la cartera de todos.

create or replace view public.cuentas_resumen with (security_invoker = true) as
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
    c.poblado,
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
    -- Lo nuevo, al final y en este orden. D-067.
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
