-- ===========================================================================
-- Las dos vistas que le faltaban al tablero (§7.6)
--
-- `venta_por_mes` contesta el canal y el vendedor. Faltan las otras dos
-- preguntas de la visión: **la concentración** —cuánto pesan los diez primeros
-- clientes— y **la venta por línea de producto**.
--
-- Las dos son agregados sobre lo que ya está cargado. No hacen falta datos
-- nuevos, hacía falta el grano.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Cuánto compra cada cliente
--
-- **Agrupa solo por cliente, no por cliente y canal.** Un cliente que en enero
-- atendió Javier y en marzo la oficina saldría partido en dos filas, y las dos
-- pesarían la mitad en la concentración — que es justo lo que la concentración
-- no puede hacer: si Inmobiliaria Don Antonio es el 15 % de la venta, es el
-- 15 %, lo atienda quien lo atienda.
--
-- El canal que se muestra es el de la mayoría de sus documentos, y se dice que
-- es eso.
-- ---------------------------------------------------------------------------

create view public.venta_por_cliente
with (security_invoker = true)
as
select
  t.contacto_id,
  max(t.contacto_nombre) as nombre,
  max(t.cuenta_id::text)::uuid as cuenta_id,
  mode() within group (order by t.canal) as canal_habitual,
  count(*)::integer as documentos,
  count(distinct t.vendedor_zoho)::integer as vendedores,
  sum(t.total) as total,
  sum(t.saldo) as por_cobrar,
  min(t.fecha) as primera_compra,
  max(t.fecha) as ultima_compra
from public.transacciones_zoho t
where t.deleted_at is null
group by t.contacto_id;

comment on view public.venta_por_cliente is 'Cuánto compró cada cliente en los doce meses del espejo. Base de la concentración de §7.6. El canal es el de la mayoría de sus documentos.';

-- ---------------------------------------------------------------------------
-- Venta por línea de producto
--
-- **Solo cubre la venta de calle**, y hay que decirlo en la pantalla. Los
-- renglones se traen abriendo documento por documento, y eso se hace solo para
-- los clientes de la cartera: de la venta de la casa se guarda la cabecera.
--
-- Traer los renglones de los 2 650 documentos de la casa costaría media hora de
-- pasada cada noche para contestar una pregunta que hoy nadie hace. Cuando se
-- haga, es cambiar un filtro.
-- ---------------------------------------------------------------------------

create view public.venta_por_linea
with (security_invoker = true)
as
select
  date_trunc('month', r.fecha)::date as mes,
  public.linea_de_producto(r.nombre) as linea,
  count(distinct r.cuenta_id)::integer as clientes,
  count(*)::integer as renglones,
  sum(r.cantidad) as cantidad,
  sum(r.total) as total
from public.renglones_zoho r
group by date_trunc('month', r.fecha), public.linea_de_producto(r.nombre);

comment on view public.venta_por_linea is 'Qué se vendió, por mes y línea. Solo la venta de calle: de la casa se guarda la cabecera, no los renglones.';
