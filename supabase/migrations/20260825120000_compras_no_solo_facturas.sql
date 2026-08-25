-- ===========================================================================
-- Una compra no es lo mismo que una factura
--
-- El espejo contaba `facturas_12m` y eso medía mal a los vendedores de ruta.
-- Lo confirmó la oficina el 2026-08-25:
--
--   Para sacar mercancía se levanta una **orden de venta**, que en Zoho
--   **retiene el inventario** como pendiente de entrega. Cuando el mensajero
--   —o el propio vendedor— sale con la mercancía, se recibe el dinero y se
--   deposita, **la orden se anula**. Anularla es lo que libera la retención y
--   deja la mercancía como despachada.
--
-- O sea: **una orden anulada es una venta entregada y cobrada**, no una venta
-- perdida. Y son muchas — 563 en el año, $172 000 —, casi todas de los dos
-- vendedores de ruta: Albert anula el 46 % de sus órdenes y Javier el 29 %,
-- mientras los de oficina no llegan al 3 %.
--
-- Medir por facturas dejaba a Albert en $43 000 cuando vendió cerca de
-- $85 000. **La mitad de su trabajo era invisible**, y habría sido invisible
-- justo en la pantalla donde se le evalúa.
--
-- Se comprobó que no hay doble conteo: ninguna de las 563 anuladas tenía
-- factura asociada.
--
--     compras = facturas + órdenes anuladas
--
-- Las órdenes **abiertas** no cuentan: son mercancía reservada que todavía no
-- salió. Eso es cartera pendiente, no venta.
-- ===========================================================================

alter table public.clientes_zoho rename column facturas_12m to compras_12m;

comment on column public.clientes_zoho.compras_12m is 'Facturas más órdenes de venta anuladas: la anulación libera el inventario y marca la entrega. Las órdenes abiertas no cuentan.';
comment on column public.clientes_zoho.total_12m is 'Monto de esas compras. No cuadra con la facturación contable, y es correcto: incluye lo entregado sin factura.';

-- La vista nombra la columna, así que se rehace. Recordatorio de siempre: el
-- `select c.*` congela la lista de columnas y `security_invoker` no es opcional.
drop view if exists public.cuentas_resumen;

create view public.cuentas_resumen
with (security_invoker = true)
as
select
  c.*,
  ult.fecha as ultimo_contacto,
  case
    when ult.fecha is null then null
    else (public.hoy_panama() - (ult.fecha at time zone 'America/Panama')::date)
  end as dias_sin_contacto,
  prox.fecha_compromiso as proximo_compromiso,
  case
    when prox.fecha_compromiso is null then null
    else (prox.fecha_compromiso - public.hoy_panama())
  end as dias_hasta_compromiso,
  case
    when c.dias_cadencia is null then null
    when ult.fecha is null then true
    else (public.hoy_panama() - (ult.fecha at time zone 'America/Panama')::date) > c.dias_cadencia
  end as fuera_de_cadencia,
  (c.lat is null or c.lng is null) as sin_ubicacion,
  (select count(*) from public.oportunidades o
    where o.cuenta_id = c.id and o.deleted_at is null
      and o.etapa not in ('ganado', 'perdido')) as oportunidades_abiertas,

  z.ultima_compra,
  case
    when z.ultima_compra is null then null
    else (public.hoy_panama() - z.ultima_compra)
  end as dias_sin_comprar,
  z.compras_12m,
  z.total_12m,
  z.cadencia_observada,

  -- Lleva más tiempo del que suele tardar en volver a comprar. Distinto de
  -- `fuera_de_cadencia`, que mide si el vendedor lo visitó: esto mide si el
  -- cliente compró. Se puede estar al día en visitas y perdiendo al cliente.
  case
    when z.cadencia_observada is null or z.ultima_compra is null then null
    else (public.hoy_panama() - z.ultima_compra) > z.cadencia_observada
  end as dejo_de_comprar
from public.cuentas c
left join lateral (
  select s.fecha
  from public.seguimientos s
  where s.cuenta_id = c.id and s.deleted_at is null
  order by s.fecha desc
  limit 1
) ult on true
left join lateral (
  select cp.fecha_compromiso
  from public.compromisos cp
  where cp.cuenta_id = c.id and cp.deleted_at is null and cp.cumplido_en is null
  order by cp.fecha_compromiso asc
  limit 1
) prox on true
left join public.clientes_zoho z
  on z.cuenta_id = c.id and z.deleted_at is null
where c.deleted_at is null;

comment on view public.cuentas_resumen is 'Cuentas con sus días calculados en hora de Panamá y lo que Books sabe de ellas. REHACER cada vez que se agregue una columna a cuentas: el select * congela la lista.';
