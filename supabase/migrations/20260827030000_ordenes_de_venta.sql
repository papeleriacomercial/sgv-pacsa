-- ===========================================================================
-- Órdenes de venta, y el tope que enruta en vez de bloquear (§7.2)
--
-- **Cotización y orden de venta son el mismo documento.** Mismos renglones,
-- mismo total, mismo ITBMS opcional, mismo PDF. Cambian el título, el prefijo
-- del código y a dónde va. Por eso viven en la misma tabla con un
-- discriminador, y no en dos tablas gemelas que se desincronizan a la tercera
-- migración.
--
-- La orden de venta reemplaza —cuando el vendedor quiere— la nota de entrega
-- de la libreta para la mercancía en consignación. **La libreta no se
-- jubila**: esto es una comodidad para el cliente que pide más formalidad, no
-- un procedimiento nuevo.
--
-- --------------------------------------------------------------------------
-- Las dos reglas de a dónde puede ir cada documento
-- --------------------------------------------------------------------------
--
-- **1. El tope deja de bloquear y pasa a enrutar.** Antes, por encima de $500
-- el vendedor simplemente no podía cotizar. Ahora siempre puede: lo que el
-- tope decide es si se la entrega él o la manda a la oficina. Un vendedor
-- trabado delante del cliente vuelve a la libreta y no regresa.
--
-- **2. Una orden de venta con ITBMS solo puede ir a la oficina.** El vendedor
-- no factura. Si el documento lleva el 7 %, entregarlo al cliente sería
-- prometer un impuesto que la empresa no declaró. No es preferencia: es regla,
-- y la impone la base — dejarla a la memoria es dejar que un día pase.
--
-- Las dos se comprueban solo al **emitir**. Un borrador puede ser cualquier
-- cosa: es donde el vendedor tantea.
-- ===========================================================================

create type public.tipo_documento as enum ('cotizacion', 'orden_venta');
create type public.destino_documento as enum ('cliente', 'oficina');

alter table public.cotizaciones
  add column tipo public.tipo_documento not null default 'cotizacion',
  add column destino public.destino_documento not null default 'cliente';

comment on column public.cotizaciones.tipo is 'Cotización u orden de venta. El mismo documento con otro título y otro destino.';
comment on column public.cotizaciones.destino is 'Cliente: se la entrega el vendedor. Oficina: entra a la bandeja de Verónica para que la levante en Zoho.';

comment on table public.cotizaciones is 'Cotizaciones y órdenes de venta que arma el vendedor en el acto. El PDF queda guardado como constancia. La tabla conserva el nombre viejo a propósito: renombrarla obligaría a tocar el bucket de Storage, sus políticas y siete pantallas, y no diría nada que la columna `tipo` no diga.';

-- ---------------------------------------------------------------------------
-- El tope, reescrito
-- ---------------------------------------------------------------------------

create or replace function public.cotizacion_respeta_el_tope()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  tope numeric := coalesce(public.parametro('cotizacion_tope'), 0);
  rol public.rol_usuario;
begin
  -- El borrador es donde se tantea. Las reglas son de la emisión.
  if new.estado <> 'emitida' then
    return new;
  end if;

  -- Lo que va a la oficina no tiene tope de ninguna clase: el punto de
  -- mandarlo es justamente que lo atienda quien sí puede.
  if new.destino = 'oficina' then
    return new;
  end if;

  -- **Sin excepción de rol.** El vendedor no factura, y eso no depende de
  -- quién sea: gerencia tampoco emite documentos fiscales desde el teléfono.
  if new.tipo = 'orden_venta' and new.con_itbms then
    raise exception
      'Una orden de venta con ITBMS la levanta la oficina. Mándasela desde aquí y Verónica la procesa en Zoho.'
      using errcode = 'check_violation';
  end if;

  select p.rol into rol from public.perfiles p where p.id = auth.uid();

  -- Gerencia no tiene tope de monto: es quien decide los precios.
  if rol = 'gerente' then
    return new;
  end if;

  if new.tipo = 'cotizacion' and new.total > tope then
    raise exception
      'Esta cotización suma % y el tope para entregarla tú mismo es %. Mándasela a la oficina desde el mismo botón.',
      to_char(new.total, 'FM999,999.00'), to_char(tope, 'FM999,999.00')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- El documento y su solicitud, atados
--
-- Cuando el documento se manda a la oficina nace una solicitud: es la que
-- lleva el reloj de respuesta. Atarlas permite que la bandeja abra el PDF sin
-- que Verónica lo busque, y que el vendedor vea desde el documento si ya se lo
-- atendieron.
-- ---------------------------------------------------------------------------

alter table public.solicitudes
  add column documento_id uuid references public.cotizaciones (id);

comment on column public.solicitudes.documento_id is 'La cotización u orden de venta que originó el encargo. Nulo en muestras y precios, que no nacen de un documento.';

create index solicitudes_documento_idx
  on public.solicitudes (documento_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- La bandeja de la oficina, con lo que hace falta para atenderla
--
-- Sustituye a `solicitudes_resumen` en la pantalla de Verónica: además del
-- reloj, trae el documento y el nombre de quien lo pidió, para no hacer tres
-- consultas por renglón.
-- ---------------------------------------------------------------------------

create view public.bandeja_oficina
with (security_invoker = true)
as
select
  s.id,
  s.cuenta_id,
  s.vendedor_id,
  s.tipo,
  s.detalle,
  s.monto_estimado,
  s.para_cuando,
  s.estado,
  s.respuesta,
  s.resuelta_en,
  s.resuelta_por,
  s.created_at,
  c.nombre as cuenta,
  v.nombre as vendedor,
  d.id as documento_id,
  d.codigo as documento_codigo,
  d.tipo as documento_tipo,
  d.total as documento_total,
  d.con_itbms as documento_con_itbms,
  d.pdf_path as documento_pdf,
  -- El reloj. Es la mitad del valor de la tabla: un encargo sin plazo de
  -- respuesta es un encargo perdido.
  extract(epoch from (now() - s.created_at)) / 3600 as horas
from public.solicitudes s
join public.cuentas c on c.id = s.cuenta_id
join public.perfiles v on v.id = s.vendedor_id
left join public.cotizaciones d on d.id = s.documento_id
where s.deleted_at is null
  and s.resuelve = 'oficina';

comment on view public.bandeja_oficina is 'Lo que espera por la oficina, con su documento y su reloj. Hereda el RLS de solicitudes.';
