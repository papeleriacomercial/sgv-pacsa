-- ===========================================================================
-- La comisión, que es lo que de verdad mueve al vendedor
--
-- 1,5 % de lo vendido en el mes, contando **facturas y entregas** — las
-- entregas son las órdenes de venta anuladas, que en esta casa significan
-- mercancía despachada y cobrada.
--
-- Los dos números salen del código por la misma razón que el tope: son del
-- negocio, y el negocio los mueve. Un cambio de porcentaje no puede ser un
-- despliegue, y cada cambio queda en `auditoria` porque afecta lo que la gente
-- cobra.
--
-- **La base excluye el ITBMS.** Ese impuesto no es venta: se cobra para el
-- Estado y se entrega. Comisionar sobre él pagaría por recaudar. La diferencia
-- no es simbólica —en agosto, $274 contra $256 en el mejor mes— así que se
-- deja explícito y se puede cambiar sin tocar código.
-- ===========================================================================

insert into public.parametros (clave, valor, descripcion) values
  ('comision_porcentaje',
   1.5,
   'Porcentaje de comisión sobre lo vendido en el mes: facturas más entregas.'),
  ('comision_sobre_neto',
   1,
   'Si la comisión se calcula sin ITBMS (1) o sobre el total con impuesto (0).')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Lo vendido y lo comisionado, por vendedor y por mes
--
-- El neto sale de los renglones, no de restarle un porcentaje al total: hay
-- documentos sin impuesto y otros con líneas exentas, y restar a ojo daría un
-- número que no cuadra con ninguna factura.
--
-- Cuando un documento no trae renglones —no debería, pero puede pasar si la
-- pasada de historial se cortó— se usa su total. Es mejor contar de más que
-- esconderle una venta al vendedor.
-- ---------------------------------------------------------------------------

create view public.ventas_del_mes
with (security_invoker = true)
as
select
  t.perfil_id,
  date_trunc('month', t.fecha)::date as mes,
  count(*) as documentos,
  count(*) filter (where t.tipo = 'factura') as facturas,
  count(*) filter (where t.tipo = 'entrega') as entregas,
  sum(t.total) as total,
  sum(coalesce(r.neto, t.total)) as neto,
  sum(t.saldo) as por_cobrar
from public.transacciones_zoho t
left join lateral (
  select sum(x.total) as neto
  from public.renglones_zoho x
  where x.transaccion_id = t.id
) r on true
where t.deleted_at is null
group by t.perfil_id, date_trunc('month', t.fecha);

comment on view public.ventas_del_mes is 'Lo vendido por vendedor y mes, con y sin ITBMS. Hereda el RLS de transacciones_zoho.';

-- ---------------------------------------------------------------------------
-- La comisión ya ganada
--
-- Se calcula, no se guarda. Guardarla obligaría a recalcular cada vez que
-- entra una factura, y a decidir qué hacer con las que ya estaban guardadas
-- cuando cambie el porcentaje. Calcularla al leer siempre dice la verdad de
-- hoy con la regla de hoy.
-- ---------------------------------------------------------------------------

create function public.comision_del_mes(p_perfil uuid, p_mes date default null)
returns table (
  vendido        numeric,
  base           numeric,
  comision       numeric,
  porcentaje     numeric,
  sobre_neto     boolean,
  documentos     integer,
  por_cobrar     numeric
)
language sql
stable
set search_path = public
as $fn$
  with regla as (
    select
      coalesce(public.parametro('comision_porcentaje'), 0) as pct,
      coalesce(public.parametro('comision_sobre_neto'), 1) = 1 as neto
  ),
  mes as (
    select coalesce(p_mes, date_trunc('month', public.hoy_panama())::date) as m
  )
  select
    coalesce(v.total, 0),
    coalesce(case when regla.neto then v.neto else v.total end, 0),
    round(
      coalesce(case when regla.neto then v.neto else v.total end, 0) * regla.pct / 100,
      2
    ),
    regla.pct,
    regla.neto,
    coalesce(v.documentos, 0)::integer,
    coalesce(v.por_cobrar, 0)
  from regla, mes
  left join public.ventas_del_mes v
    on v.perfil_id = p_perfil and v.mes = mes.m;
$fn$;

comment on function public.comision_del_mes is 'Lo vendido y la comisión ganada de un vendedor en un mes. Se calcula al leer: siempre con la regla vigente.';
