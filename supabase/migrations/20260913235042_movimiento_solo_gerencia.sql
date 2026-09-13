-- El movimiento por período es un reporte de gerencia, y de nadie más.
--
-- **Decisión del usuario, 13 de septiembre de 2026:** *«el filtro de movimiento en un período y
-- desde–hasta solamente sea para uso del usuario gerencia, no para uso de los vendedores ni del
-- líder»*.
--
-- La pantalla ya esconde el control y limpia las fechas de la dirección, pero **esconder no es
-- restringir**: la función se puede llamar desde cualquier sitio con una sesión válida. Aquí se
-- cierra de verdad, con el mismo patrón que `actividad_por_vendedor` — levanta excepción en vez
-- de devolver vacío, para que un error de programación se vea en vez de parecer «no hubo nada».
--
-- Se pierde, a propósito, que un vendedor pudiera consultarse a sí mismo: nadie lo pidió, la
-- pantalla nunca se lo ofreció, y una puerta abierta que no usa nadie es sólo una puerta abierta.

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
  -- El rango es en hora de Panamá, no del servidor: sin esto, lo registrado a las siete de la
  -- noche del viernes caería en el sábado y la semana en curso perdería el último día de calle.
  desde timestamptz := (p_desde::timestamp at time zone 'America/Panama');
  hasta timestamptz := ((p_hasta + 1)::timestamp at time zone 'America/Panama');
begin
  if p_hasta < p_desde then
    raise exception 'El rango está al revés: % es antes de %', p_hasta, p_desde;
  end if;

  -- ES SECURITY DEFINER PARA PODER LEER LA AUDITORÍA, que es sólo de gerencia. La puerta se
  -- cierra aquí adentro y en un solo sitio.
  if (select p.rol from public.perfiles p where p.id = auth.uid()) is distinct from 'gerente' then
    raise exception 'Este reporte es de gerencia.';
  end if;

  return query
  with movimiento as (
    select
      c.id,
      -- NUEVA, SIN LAS QUE CREA EL ESPEJO DE ZOHO: nacen a nombre del vendedor que factura, pero
      -- él no las levantó, y marcarlas como caza suya le regalaría trabajo que hizo un guion.
      (c.origen::text <> 'facturacion'
        and c.created_at >= desde and c.created_at < hasta) as nueva,

      -- MODIFICADA. `actor_id is not null` deja fuera a la máquina, que no tiene `auth.uid()`.
      -- Borrar no cuenta como modificar.
      exists (
        select 1
          from public.auditoria a
         where a.tabla = 'cuentas'
           and a.registro_id = c.id
           and a.actor_id is not null
           and a.campo <> 'deleted_at'
           and a.created_at >= desde and a.created_at < hasta
      ) as modificada,

      -- VISITADA, por `fecha` y no por `created_at`: aquí la pregunta es a quién fue a ver, no
      -- qué días usó la herramienta. El que sale toda la semana y captura el viernes visitó cinco
      -- días.
      exists (
        select 1
          from public.seguimientos s
         where s.cuenta_id = c.id
           and s.deleted_at is null
           and s.fecha >= desde and s.fecha < hasta
      ) as visitada

      from public.cuentas c
     where c.deleted_at is null
  )
  select m.id, m.nueva, m.modificada, m.visitada
    from movimiento m
   where m.nueva or m.modificada or m.visitada;
end;
$$;

comment on function public.cuentas_con_actividad(date, date) is
  'Qué cuentas tuvieron movimiento entre dos fechas de Panamá, con tres banderas: nueva, modificada y visitada. Una cuenta puede traer las tres. SÓLO GERENCIA: levanta excepción con cualquier otro rol. «Modificada» sólo existe desde el 3 de septiembre de 2026, cuando la auditoría empezó a guardar todos los campos; antes viene en falso y eso significa «no se sabe», no «no pasó nada».';

-- Se repite el cierre a `anon` porque `create or replace` no toca los permisos, pero dejarlo
-- escrito aquí evita que la próxima persona tenga que ir a buscar si ya estaba puesto (D-070).
revoke all on function public.cuentas_con_actividad(date, date) from public;
revoke all on function public.cuentas_con_actividad(date, date) from anon;
grant execute on function public.cuentas_con_actividad(date, date) to authenticated;
