-- Qué hizo cada vendedor en un día — §7.1, el tablero de gerencia.
--
-- Lo pidió el usuario el 3 de septiembre de 2026, y dijo para qué, que es lo que decide cómo se
-- cuenta: *«para entender si los vendedores están inicialmente sacando provecho de la
-- herramienta»*. No es un tablero de resultado comercial — es de **uso**.
--
-- Son seis cifras por vendedor y por día: cuentas creadas, cuentas actualizadas, seguimientos
-- registrados, seguimientos programados, listas creadas y cuentas agregadas a listas.
--
-- ============================================================================================
-- LO QUE HUBO QUE ARREGLAR ANTES DE PODER CONTARLO
-- ============================================================================================
--
-- **«Cuántas cuentas actualizó sus datos» no se podía contestar.** La vía obvia, `updated_at`, no
-- sirve: la mueven seis caminos distintos del código —editar la ficha, clasificar un potencial al
-- cerrar un seguimiento, capturar el RUC de una venta, ubicar en el mapa, adoptar la cadencia,
-- borrar la cuenta— y además **la mueve el espejo de Zoho**, que enlaza cuentas de madrugada sin
-- que ningún vendedor toque nada. Un día de sincronización habría mostrado cuarenta cuentas
-- «actualizadas» por alguien que estaba de vacaciones.
--
-- Y la auditoría tampoco servía: **sólo guardaba dos campos** —`vendedor_id` y `tipo`—, elegidos
-- cuando lo que importaba era la reasignación de cartera y el paso a cliente. Un cambio de teléfono
-- no dejaba rastro en ninguna parte.
--
-- Así que se amplía la auditoría, y de ahí sale la cifra exacta. **Con una consecuencia que hay que
-- decir en voz alta: los días anteriores a hoy no tienen ese dato y no lo van a tener nunca.** La
-- pantalla los muestra con una raya, no con un cero, porque un cero dice «no hizo nada» y lo que
-- pasa es «no se sabe».

-- --------------------------------------------------------------------------------------------
-- 1. La auditoría de cuentas pasa de dos campos a todos
-- --------------------------------------------------------------------------------------------
--
-- **Se descubren, no se listan.** Se recorre lo que cambió comparando la fila entera, así que una
-- columna que nazca mañana queda auditada sola. Enumerar los campos a mano es lo que garantiza que
-- el que se agregue el año que viene no se audite y nadie lo note.
--
-- Dos excepciones, y las dos son máquina y no persona:
--   · `updated_at`, que cambia en todo UPDATE por definición y no es un dato de la cuenta;
--   · `zoho_contacto_id`, que lo escribe el espejo de facturación.
--
-- Las filas que ya escribía —`vendedor_id` y `tipo`— salen igual que antes, con el mismo nombre de
-- campo y el mismo valor en texto: lo de antes sigue sirviendo, y ahora hay más.
create or replace function public.auditar_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campo text;
  antes jsonb := to_jsonb(old);
  ahora jsonb := to_jsonb(new);
begin
  for campo in select jsonb_object_keys(ahora) loop
    continue when campo in ('updated_at', 'zoho_contacto_id');
    continue when antes -> campo is not distinct from ahora -> campo;

    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('cuentas', new.id, campo, antes ->> campo, ahora ->> campo, auth.uid());
  end loop;

  return new;
end;
$$;

comment on function public.auditar_cuenta() is
  'Deja en auditoría cada campo que cambió de una cuenta, salvo updated_at y el enlace de Zoho. Es la única fuente que distingue lo que edita una persona de lo que escribe la máquina: actor_id viene nulo cuando el que escribe es un guion con llave de servicio.';

-- --------------------------------------------------------------------------------------------
-- 2. El reporte
-- --------------------------------------------------------------------------------------------
create or replace function public.actividad_por_vendedor(p_dia date)
returns table (
  vendedor_id                uuid,
  nombre                     text,
  rol                        text,
  cuentas_creadas            integer,
  cuentas_actualizadas       integer,
  seguimientos_registrados   integer,
  seguimientos_programados   integer,
  listas_creadas             integer,
  cuentas_agregadas_a_listas integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- EL DÍA ES EL DE PANAMÁ, NO EL DEL SERVIDOR. Todo se guarda en timestamptz y el servidor piensa
  -- en UTC: sin esto, lo que un vendedor registró a las siete de la noche caería en el día
  -- siguiente y el reporte del lunes tendría trabajo del domingo. Panamá no mueve la hora, así que
  -- la conversión es exacta y no hay que preocuparse por el cambio de horario.
  desde timestamptz := (p_dia::timestamp at time zone 'America/Panama');
  hasta timestamptz := ((p_dia + 1)::timestamp at time zone 'America/Panama');
begin
  -- ES SECURITY DEFINER PARA PODER MIRAR A TODOS, así que la puerta se cierra aquí adentro: sin
  -- esto, cualquiera con sesión leería la actividad de sus compañeros saltándose el RLS.
  if (select p.rol from public.perfiles p where p.id = auth.uid()) is distinct from 'gerente' then
    raise exception 'Este reporte es de gerencia.';
  end if;

  return query
  select
    p.id,
    p.nombre,
    p.rol::text,

    -- CUENTAS CREADAS, sin las que crea el espejo de Zoho. Nacen a nombre del vendedor que factura
    -- —así es como tiene que ser— pero él no las levantó, y contarlas le regalaría una mañana de
    -- trabajo que hizo un guion de madrugada.
    (select count(*)::integer
       from public.cuentas c
      where c.vendedor_id = p.id
        and c.deleted_at is null
        and c.origen::text <> 'facturacion'
        and c.created_at >= desde and c.created_at < hasta),

    -- CUENTAS ACTUALIZADAS. `distinct` porque editar tres campos de una ficha deja tres renglones
    -- de auditoría y es **una** cuenta actualizada.
    --
    -- `actor_id is not null` es lo que deja fuera a la máquina: un guion con llave de servicio no
    -- tiene `auth.uid()`. Y `deleted_at` no cuenta, porque borrar una cuenta no es actualizarla.
    --
    -- **Se acredita al dueño de la cuenta, no al que la tocó** — decisión del usuario. Si gerencia
    -- corrige el teléfono de un cliente, el movimiento aparece en el renglón del vendedor, que es
    -- de quien se quiere saber si su cartera se mantiene viva.
    (select count(distinct a.registro_id)::integer
       from public.auditoria a
       join public.cuentas c on c.id = a.registro_id
      where a.tabla = 'cuentas'
        and a.actor_id is not null
        and a.campo <> 'deleted_at'
        and c.vendedor_id = p.id
        and c.deleted_at is null
        and a.created_at >= desde and a.created_at < hasta),

    -- SEGUIMIENTOS REGISTRADOS. Por `created_at` y no por `fecha`: la pregunta es qué días usa la
    -- herramienta, y `fecha` es cuándo ocurrió la visita. Un vendedor que sale toda la semana y
    -- captura el viernes trabajó cinco días, pero **la herramienta la usó uno**, y eso es
    -- exactamente lo que aquí se quiere ver.
    (select count(*)::integer
       from public.seguimientos s
      where s.vendedor_id = p.id
        and s.deleted_at is null
        and s.created_at >= desde and s.created_at < hasta),

    -- SEGUIMIENTOS PROGRAMADOS. Casi siempre acompaña al de arriba, porque cerrar un seguimiento
    -- obliga a dejar el próximo paso. **El renglón que vale la pena mirar es cuando este número es
    -- mayor**: quiere decir que además planificó desde la ficha, sin haber visitado.
    (select count(*)::integer
       from public.compromisos k
      where k.vendedor_id = p.id
        and k.deleted_at is null
        and k.created_at >= desde and k.created_at < hasta),

    (select count(*)::integer
       from public.listas l
      where l.vendedor_id = p.id
        and l.deleted_at is null
        and l.created_at >= desde and l.created_at < hasta),

    -- CUENTAS AGREGADAS A LISTAS. El usuario dijo «potenciales», que es de donde viene la idea;
    -- se cuentan todas las que entraron, porque **desde el 27 de agosto una lista también admite
    -- clientes** y filtrar por potencial escondería trabajo que sí se hizo.
    (select count(*)::integer
       from public.listas_cuentas lc
      where lc.agregada_por = p.id
        and lc.agregada_en >= desde and lc.agregada_en < hasta)

  from public.perfiles p
  where p.activo
    and p.deleted_at is null
    and p.rol in ('vendedor', 'lider')
  order by p.nombre;
end;
$$;

comment on function public.actividad_por_vendedor(date) is
  'Seis cifras de uso de la herramienta por vendedor en un día de Panamá. Mide si la usan, no cuánto venden. Las cuentas actualizadas sólo existen desde el 3 de septiembre de 2026, que es cuando la auditoría empezó a guardar todos los campos.';

revoke all on function public.actividad_por_vendedor(date) from public;
grant execute on function public.actividad_por_vendedor(date) to authenticated;
