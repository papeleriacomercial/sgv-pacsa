-- ===========================================================================
-- Lo que se acredita empieza en septiembre
--
-- La regla de pertenencia cambió el 27 de agosto de 2026 —ver el comentario de
-- `zoho-sincronizar.mjs`— y con ella **21 clientes que estaban huérfanos pasan a
-- tener vendedor**. La mayoría son de Javier: clientes de su ruta que quedaban
-- afuera porque alguna vez llamaron a la oficina y les facturaron desde allá.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ NO SE APLICA HACIA ATRÁS
-- ---------------------------------------------------------------------------
--
-- Decisión del usuario, y es la conservadora: acreditarle esos clientes a Javier
-- **le sube la facturación de los últimos doce meses**, y la comisión se calcula
-- sobre eso. Mover un número de un mes ya liquidado obligaría a explicar por qué
-- cambió, o a pagar dos veces.
--
-- Así que la regla nueva vale **para lo que se venda de septiembre en adelante**.
-- Las 237 facturas anteriores —$57 174— se quedan sin acreditar, a la vista y sin
-- disimulo: prefieren quedar como un hueco explicable antes que como un ajuste
-- silencioso.
--
-- **Este corte se puede quitar el día que se decida**, cambiando la fecha por
-- una anterior y corriendo la función a mano. No hay nada que rehacer.
-- ===========================================================================

create or replace function public.acreditar_transacciones_sin_dueno()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n integer;
  -- El corte. Ver la cabecera de esta migración antes de moverlo.
  desde constant date := date '2026-09-01';
begin
  update public.transacciones_zoho t
     set perfil_id  = c.perfil_id,
         cuenta_id  = coalesce(t.cuenta_id, c.cuenta_id),
         updated_at = now()
    from public.clientes_zoho c
   where t.contacto_id = c.contacto_id
     and c.deleted_at is null
     and c.perfil_id is not null
     -- Solo lo que nunca tuvo dueño: reasignar borraría de quién fue una venta
     -- ya comisionada.
     and t.perfil_id is null
     and t.deleted_at is null
     -- Y sólo de septiembre en adelante.
     and t.fecha >= desde;

  get diagnostics n = row_count;

  update public.renglones_zoho r
     set perfil_id = t.perfil_id
    from public.transacciones_zoho t
   where r.transaccion_id = t.id
     and r.perfil_id is null
     and t.perfil_id is not null
     and r.fecha >= desde;

  return n;
end;
$fn$;

comment on function public.acreditar_transacciones_sin_dueno is
  'Completa el vendedor de las facturas que se escribieron antes de que su cliente tuviera uno asignado, de 2026-09-01 en adelante. Solo rellena lo vacío y no toca lo ya comisionado.';
