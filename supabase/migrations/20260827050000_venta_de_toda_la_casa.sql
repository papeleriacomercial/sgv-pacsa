-- ===========================================================================
-- El espejo pasa a cubrir toda la venta de la empresa (§7.6)
--
-- Hasta hoy `transacciones_zoho` guardaba **solo los clientes de calle**: 1 533
-- documentos por $545 881. La empresa facturó $1 929 369 en doce meses. El
-- espejo veía el 28 %.
--
-- Para la cartera eso estaba bien —lo que no es de un vendedor no va en su
-- cartera— pero la primera pregunta de §7.6 es *«¿cuánto vende la casa y cuánto
-- genera cada vendedor?»*, y con el 28 % no se contesta.
--
-- --------------------------------------------------------------------------
-- El canal se decide por documento, no por cliente
-- --------------------------------------------------------------------------
--
-- La regla de pertenencia que usa `clientes_zoho` es de **cliente**: si tiene
-- más de un vendedor, no es de nadie. Esa regla es correcta para decidir de
-- quién es la cartera, y es equivocada para medir venta — porque si en la
-- factura dice Javier, la vendió Javier.
--
-- Medido: 23 clientes tienen a un vendedor de calle mezclado con alguien de la
-- oficina —doce de ellos Javier con Verónica— y por eso quedaban fuera. En
-- agosto de 2026 eso son $1 358 de Javier y $39 de Albert.
--
-- **`perfil_id` no se toca.** Sigue significando lo que significaba —de quién
-- es el cliente— y la comisión se sigue calculando con él. Lo nuevo es
-- `vendedor_zoho`, que es quien firma **este** documento. Que las dos cosas
-- puedan diferir es un hecho del negocio, no un error: esconderlo detrás de una
-- sola columna es lo que hace que después nadie sepa cuál número creer.
-- ===========================================================================

create type public.canal_venta as enum ('calle', 'casa');

alter table public.transacciones_zoho
  add column canal public.canal_venta not null default 'casa',
  -- Tal como viene en el documento, con celular y todo. Se traduce por
  -- `vendedores_zoho`, igual que en `clientes_zoho`.
  add column vendedor_zoho text,
  -- El nombre del cliente en Books. Los de la casa no tienen `cuenta`, así que
  -- sin esto el tablero no puede decir quién es el primero de la lista.
  add column contacto_nombre text;

comment on column public.transacciones_zoho.canal is 'Calle si el documento lo firma un vendedor de ruta; casa si lo firma la oficina o nadie. Se decide por documento: si en la factura dice Javier, la vendió Javier.';
comment on column public.transacciones_zoho.vendedor_zoho is 'Quien firma ESTE documento. Distinto de `perfil_id`, que dice de quién es el cliente. Pueden diferir, y esa diferencia es un hecho del negocio.';

create index transacciones_zoho_canal_idx
  on public.transacciones_zoho (canal, fecha desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- La venta, en el grano que necesita el tablero
--
-- `security_invoker` y sin trucos: el RLS de `transacciones_zoho` ya dice que
-- solo gerencia ve lo que no tiene dueño. Un vendedor que abriera esta vista
-- vería lo suyo y nada más, que es la respuesta correcta.
-- ---------------------------------------------------------------------------

create view public.venta_por_mes
with (security_invoker = true)
as
select
  date_trunc('month', t.fecha)::date as mes,
  t.canal,
  t.vendedor_zoho,
  v.perfil_id as vendedor_id,
  count(*)::integer as documentos,
  count(*) filter (where t.tipo = 'factura')::integer as facturas,
  count(*) filter (where t.tipo = 'entrega')::integer as entregas,
  count(distinct t.contacto_id)::integer as clientes,
  sum(t.total) as total,
  sum(t.saldo) as por_cobrar
from public.transacciones_zoho t
left join public.vendedores_zoho v
  on v.nombre_zoho = t.vendedor_zoho and v.deleted_at is null
where t.deleted_at is null
group by
  date_trunc('month', t.fecha),
  t.canal,
  t.vendedor_zoho,
  v.perfil_id;

comment on view public.venta_por_mes is 'La venta de la empresa por mes, canal y quien firma el documento. Base del tablero de §7.6. Hereda el RLS de transacciones_zoho.';

-- ---------------------------------------------------------------------------
-- Cuándo compró cada cliente por primera vez
--
-- Es lo que permite separar **clientes nuevos de recurrentes** mes a mes, que
-- es la pregunta de §7.6 que más dice sobre si el negocio crece o solo se
-- sostiene.
--
-- «Primera compra» aquí significa la primera dentro de los doce meses que trae
-- el espejo. Un cliente de hace cinco años que volvió en marzo va a salir como
-- nuevo, y eso hay que decirlo en la pantalla en vez de esconderlo.
-- ---------------------------------------------------------------------------

create view public.clientes_por_mes
with (security_invoker = true)
as
with primera as (
  select
    t.contacto_id,
    min(t.fecha) as primera_compra
  from public.transacciones_zoho t
  where t.deleted_at is null
  group by t.contacto_id
)
select
  date_trunc('month', t.fecha)::date as mes,
  t.canal,
  count(distinct t.contacto_id)::integer as clientes,
  count(distinct t.contacto_id) filter (
    where date_trunc('month', p.primera_compra) = date_trunc('month', t.fecha)
  )::integer as nuevos,
  sum(t.total) filter (
    where date_trunc('month', p.primera_compra) = date_trunc('month', t.fecha)
  ) as total_nuevos,
  sum(t.total) as total
from public.transacciones_zoho t
join primera p on p.contacto_id = t.contacto_id
where t.deleted_at is null
group by date_trunc('month', t.fecha), t.canal;

comment on view public.clientes_por_mes is 'Clientes que compraron cada mes y cuántos lo hacían por primera vez. «Primera» es dentro de los doce meses del espejo: quien volvió después de años sale como nuevo.';
