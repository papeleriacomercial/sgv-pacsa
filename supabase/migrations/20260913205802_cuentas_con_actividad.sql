-- Qué cuentas tuvieron movimiento en un rango de fechas — §7.1, la cartera y su mapa.
--
-- Lo pidió el usuario el 13 de septiembre de 2026, y dijo cómo lo iba a usar, que es lo que
-- decide el diseño: *«filtrar por el señor Albert Batista, y que en el mapa se me presenten las
-- cuentas, prospectos o potenciales que él tocó en el rango de período que uno escoja, usualmente
-- lo voy a hacer por la semana en curso»*.
--
-- **Devuelve identificadores y tres banderas, no cuentas.** La cartera ya está cargada y filtrada
-- por RLS en la pantalla; esto sólo dice cuáles de esas tuvieron movimiento y de qué clase, y el
-- filtro del navegador cruza. Así el mapa, la lista y el contador siguen saliendo de una sola
-- fuente y no hay dos maneras de decidir qué se ve.
--
-- Las tres clases son las que pidió, y son tres comportamientos distintos:
--
--   · **nueva**      — la levantó en ese rango. Es caza.
--   · **modificada** — le cambió algo a la ficha. Es mantenimiento del dato.
--   · **visitada**   — hubo una interacción. Es cuidado de la cuenta.
--
-- Una cuenta puede traer las tres a la vez, y por eso son banderas y no una categoría: crearla,
-- llenarle el teléfono y visitarla el mismo miércoles es un solo punto en el mapa.
--
-- ============================================================================================
-- EL LÍMITE QUE HAY QUE DECIR EN VOZ ALTA
-- ============================================================================================
--
-- **«modificada» sólo existe desde el 3 de septiembre de 2026.** Antes de esa fecha la auditoría
-- guardaba dos campos —`vendedor_id` y `tipo`— y un cambio de teléfono no dejaba rastro en
-- ninguna parte (ver la migración `actividad_por_vendedor`). Para un rango anterior la bandera
-- viene en falso, y eso **no** quiere decir que nadie tocó nada: quiere decir que no se sabe.
-- La pantalla lo advierte cuando el rango empieza antes de esa fecha.

create or replace function public.cuentas_con_actividad(p_desde date, p_hasta date)
returns table (
  cuenta_id   uuid,
  nueva       boolean,
  modificada  boolean,
  visitada    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- EL RANGO ES EN HORA DE PANAMÁ, NO DEL SERVIDOR. Todo se guarda en timestamptz y el servidor
  -- piensa en UTC: sin esto, lo que se registró a las siete de la noche del viernes caería en el
  -- sábado y la semana en curso perdería el último día de calle. Panamá no mueve la hora, así que
  -- la conversión es exacta.
  --
  -- `hasta` es el día siguiente al pedido: el rango incluye el día final completo, que es lo que
  -- cualquiera espera al escoger «del lunes al viernes».
  desde timestamptz := (p_desde::timestamp at time zone 'America/Panama');
  hasta timestamptz := ((p_hasta + 1)::timestamp at time zone 'America/Panama');
begin
  if p_hasta < p_desde then
    raise exception 'El rango está al revés: % es antes de %', p_hasta, p_desde;
  end if;

  -- ES SECURITY DEFINER PARA PODER LEER LA AUDITORÍA, que es sólo de gerencia. Así que la puerta
  -- se cierra aquí adentro, y con el mismo modelo del RLS: gerencia ve todo, el líder a su equipo,
  -- el vendedor lo suyo. Sin esto, cualquiera con sesión sabría qué cuentas tocó un compañero.
  return query
  with movimiento as (
    select
      c.id,
      -- NUEVA, SIN LAS QUE CREA EL ESPEJO DE ZOHO. Nacen a nombre del vendedor que factura —así
      -- tiene que ser— pero él no las levantó, y marcarlas como caza suya le regalaría una mañana
      -- de trabajo que hizo un guion de madrugada.
      (c.origen::text <> 'facturacion'
        and c.created_at >= desde and c.created_at < hasta) as nueva,

      -- MODIFICADA. `actor_id is not null` es lo que deja fuera a la máquina: un guion con llave de
      -- servicio no tiene `auth.uid()`. Y `deleted_at` no cuenta, porque borrar no es modificar.
      exists (
        select 1
          from public.auditoria a
         where a.tabla = 'cuentas'
           and a.registro_id = c.id
           and a.actor_id is not null
           and a.campo <> 'deleted_at'
           and a.created_at >= desde and a.created_at < hasta
      ) as modificada,

      -- VISITADA, **por `fecha` y no por `created_at`**, y aquí se separa a propósito del reporte
      -- de actividad del día. Aquél mide si usan la herramienta, y para eso importa cuándo
      -- capturaron. Éste contesta «a quién fue a ver esta semana», y para eso importa cuándo
      -- ocurrió la visita: el que sale toda la semana y captura el viernes visitó cinco días.
      exists (
        select 1
          from public.seguimientos s
         where s.cuenta_id = c.id
           and s.deleted_at is null
           and s.fecha >= desde and s.fecha < hasta
      ) as visitada

      from public.cuentas c
     where c.deleted_at is null
       and (
         public.es_gerente()
         or c.vendedor_id = auth.uid()
         or exists (
           select 1 from public.perfiles p
            where p.id = c.vendedor_id and p.lider_id = auth.uid()
         )
       )
  )
  select m.id, m.nueva, m.modificada, m.visitada
    from movimiento m
   -- Sólo las que tuvieron algo. Devolver las 759 con tres falsos sería mandar la cartera entera
   -- por la red para que el navegador la descarte.
   where m.nueva or m.modificada or m.visitada;
end;
$$;

comment on function public.cuentas_con_actividad(date, date) is
  'Qué cuentas tuvieron movimiento entre dos fechas de Panamá, con tres banderas: nueva, modificada y visitada. Una cuenta puede traer las tres. «Modificada» sólo existe desde el 3 de septiembre de 2026, cuando la auditoría empezó a guardar todos los campos; antes viene en falso y eso significa «no se sabe», no «no pasó nada».';

revoke all on function public.cuentas_con_actividad(date, date) from public;
grant execute on function public.cuentas_con_actividad(date, date) to authenticated;
