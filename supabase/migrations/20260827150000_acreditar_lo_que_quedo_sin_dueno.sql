-- ===========================================================================
-- Acreditarle al vendedor las facturas que quedaron sin dueño
--
-- EL PROBLEMA, medido el 27 de agosto de 2026: **240 facturas de calle por
-- $58 329 no se le acreditan a nadie**, y 229 de ellas son de Javier. No es un
-- error de cálculo. Son 21 clientes que no están en el espejo porque su ficha
-- de contacto en Zoho no tiene vendedor asignado —aunque la factura sí diga
-- quién vendió—.
--
-- POR QUÉ ARREGLARLO EN ZOHO NO ALCANZA, que es lo que preguntó el usuario y
-- tenía razón: el `perfil_id` de una transacción se copia del cliente **en el
-- momento en que se escribe esa transacción**. La corrida de cada noche solo
-- pide a Zoho lo modificado desde la marca de agua, y asignarle el vendedor a
-- una ficha de contacto no modifica sus facturas de hace ocho meses. Se
-- quedarían en null para siempre.
--
-- La alternativa era borrar la marca de agua y volver a abrir los 2 208
-- documentos: dos mil consultas de la cuota diaria de Zoho para arreglar algo
-- que ya está en la base.
--
-- ---------------------------------------------------------------------------
-- SOLO SE RELLENA LO VACÍO. Nunca se reasigna.
-- ---------------------------------------------------------------------------
--
-- Esta es la decisión que importa. Sería fácil escribir «pon en cada factura el
-- vendedor que hoy tiene su cliente», y estaría mal: **el día que un cliente
-- cambia de vendedor, las ventas viejas siguen siendo de quien las hizo.** La
-- comisión ya se pagó, y reescribir la historia haría que los números de un mes
-- cerrado cambiaran solos.
--
-- Por eso la condición es `perfil_id is null`: se completa lo que nunca se supo,
-- y no se toca nada de lo que ya tiene dueño.
-- ===========================================================================

create function public.acreditar_transacciones_sin_dueno()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n integer;
begin
  update public.transacciones_zoho t
     set perfil_id  = c.perfil_id,
         cuenta_id  = coalesce(t.cuenta_id, c.cuenta_id),
         updated_at = now()
    from public.clientes_zoho c
   where t.contacto_id = c.contacto_id
     and c.deleted_at is null
     and c.perfil_id is not null
     -- Solo lo que nunca tuvo dueño. Ver la nota de arriba.
     and t.perfil_id is null
     and t.deleted_at is null;

  get diagnostics n = row_count;

  -- Los renglones cuelgan de su transacción y llevan copia del perfil para que
  -- el desglose por producto no tenga que unir dos tablas grandes en cada
  -- consulta. Se arrastran con la misma regla.
  update public.renglones_zoho r
     set perfil_id = t.perfil_id
    from public.transacciones_zoho t
   where r.transaccion_id = t.id
     and r.perfil_id is null
     and t.perfil_id is not null;

  return n;
end;
$fn$;

comment on function public.acreditar_transacciones_sin_dueno is
  'Completa el vendedor de las facturas que se escribieron antes de que su cliente tuviera uno asignado. Solo rellena lo vacío: reasignar borraría de quién fue una venta ya comisionada.';
