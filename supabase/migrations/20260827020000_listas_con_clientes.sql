-- ===========================================================================
-- Las listas también llevan clientes
--
-- Hasta hoy una lista era de potenciales: puntos que nadie ha tocado, cazados
-- en el mapa. Ahora entra un segundo habitante — el **cliente al que se va a
-- ofrecer una línea que no compra** (venta cruzada). El vendedor camina una
-- sola ruta por Aguadulce, no dos.
--
-- `listas_cuentas` ya lo permitía: apunta a `cuentas` sin mirar el tipo. Lo que
-- no aguantaba eran los conteos.
--
-- --------------------------------------------------------------------------
-- 1. «Trabajada» pasa a significar «trabajada desde que entró a la lista»
-- --------------------------------------------------------------------------
--
-- Antes bastaba con que la cuenta tuviera un seguimiento, cualquiera, de
-- cuando fuera. Con potenciales daba igual —un potencial no tiene pasado— pero
-- **un cliente sí**: entraría a la lista ya marcado como hecho, con el trabajo
-- por delante y el contador diciendo que no hay nada que hacer.
--
-- El compromiso semanal se arma con estos números. Un contador que miente ahí
-- no es un detalle de pantalla: es un vendedor prometiendo doce visitas que el
-- sistema ya da por hechas.
--
-- La comparación va contra la fecha de Panamá, no contra el instante en UTC:
-- una cuenta agregada a las 8 de la noche y visitada al día siguiente tiene
-- que contar (D-021).
--
-- --------------------------------------------------------------------------
-- 2. Los conteos se parten en dos
-- --------------------------------------------------------------------------
--
-- Cazar y cuidar son dos oficios distintos y el cierre de la semana ya los
-- separa: `cierres` tiene `apuesta_potenciales` y `apuesta_clientes`. Si la
-- lista los sumara en un solo número, el plan del lunes no podría alimentar
-- las dos apuestas por separado.
-- ===========================================================================

drop view if exists public.listas_resumen;

create view public.listas_resumen
with (security_invoker = true)
as
select
  l.*,
  coalesce(c.total, 0) as total,
  coalesce(c.sin_tocar, 0) as sin_tocar,
  coalesce(c.trabajadas, 0) as trabajadas,
  coalesce(c.viejos, 0) as sin_tocar_hace_mucho,
  coalesce(c.potenciales, 0) as sin_tocar_potenciales,
  coalesce(c.clientes, 0) as sin_tocar_clientes
from public.listas l
left join lateral (
  select
    count(*) as total,
    count(*) filter (where s.fecha is null) as sin_tocar,
    count(*) filter (where s.fecha is not null) as trabajadas,
    -- Un paquete permanente acumula muertos. La defensa no es vencerlo por la
    -- fuerza, es mostrar la antigüedad: "12 potenciales llevan más de dos meses
    -- en tu lista sin que los toques".
    count(*) filter (
      where s.fecha is null and lc.agregada_en < now() - interval '60 days'
    ) as viejos,
    -- Cazar y cuidar, por separado. El cliente que entra por venta cruzada no
    -- es un punto nuevo: es una cuenta que ya existe y a la que se le va a
    -- ofrecer algo más.
    count(*) filter (where s.fecha is null and cu.tipo <> 'cliente') as potenciales,
    count(*) filter (where s.fecha is null and cu.tipo = 'cliente') as clientes
  from public.listas_cuentas lc
  join public.cuentas cu on cu.id = lc.cuenta_id and cu.deleted_at is null
  left join lateral (
    select sg.fecha from public.seguimientos sg
    where sg.cuenta_id = cu.id
      and sg.deleted_at is null
      -- **Desde que entró a la lista**, no desde siempre.
      and sg.fecha >= (lc.agregada_en at time zone 'America/Panama')::date
    order by sg.fecha desc limit 1
  ) s on true
  where lc.lista_id = l.id
) c on true
where l.deleted_at is null;

comment on view public.listas_resumen is 'Las listas con su avance. «Trabajada» significa trabajada DESPUÉS de entrar a la lista: sin eso, un cliente agregado para venta cruzada entraría ya marcado como hecho. Los conteos se parten en potenciales y clientes porque el cierre de la semana apuesta por separado.';
