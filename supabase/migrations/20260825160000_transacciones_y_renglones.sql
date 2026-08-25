-- ===========================================================================
-- Qué compró, cuándo y de qué
--
-- Hasta ahora el espejo traía agregados: cuánto compró en el año, cuándo fue
-- la última vez, cada cuánto compra. Sirve para saber **si** un cliente se
-- está enfriando, pero no para la conversación que el vendedor tiene frente al
-- mostrador:
--
--     «Le vendes rollos y bolsas hace un año.
--      Las bolsas se las dejó de comprar en marzo.»
--
-- Eso exige el renglón, no el total. Y hoy no lo sabe nadie — ni gerencia, ni
-- la oficina, ni el propio vendedor salvo que se acuerde.
--
-- **El costo es de una sola vez.** Zoho no manda los renglones en el listado:
-- hay que abrir cada documento, y son 2 109 en doce meses — unos 17 minutos.
-- De ahí en adelante la pasada de noche pide solo lo modificado desde la
-- anterior: diez o veinte consultas, segundos.
--
-- El vendedor nunca espera por Zoho: lee de aquí.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Hasta dónde llegó la última pasada
--
-- Sin esto, cada noche habría que volver a traerlo todo. La marca **solo
-- avanza cuando la pasada termina bien**: si falla a la mitad, la siguiente
-- recupera lo que quedó sin traer en vez de dejar un hueco para siempre.
-- ---------------------------------------------------------------------------

create table public.sincronizaciones (
  fuente        text primary key,
  hasta         timestamptz not null,
  documentos    integer not null default 0,
  terminada_en  timestamptz not null default now()
);

comment on table public.sincronizaciones is 'Marca de agua por fuente. Solo avanza cuando la pasada termina completa, para que un fallo no deje un hueco permanente.';

alter table public.sincronizaciones enable row level security;

create policy "sincronizaciones_lectura"
  on public.sincronizaciones for select to authenticated
  using (public.es_gerente());

-- ---------------------------------------------------------------------------
-- 2. Las transacciones
--
-- Factura y entrega conviven en la misma tabla porque para el vendedor son lo
-- mismo: el cliente compró. La diferencia es contable —la entrega es la orden
-- anulada que liberó el inventario— y se guarda por si hace falta explicarla,
-- no para separarlas en pantalla.
-- ---------------------------------------------------------------------------

create type public.tipo_transaccion as enum ('factura', 'entrega');

comment on type public.tipo_transaccion is 'Factura formal, o entrega contra orden de venta anulada. Para el vendedor las dos son una compra.';

create table public.transacciones_zoho (
  id            uuid primary key,
  documento_id  text not null,
  tipo          public.tipo_transaccion not null,
  numero        text,

  contacto_id   text not null,
  cuenta_id     uuid references public.cuentas (id),
  perfil_id     uuid references public.perfiles (id),

  fecha         date not null,
  total         numeric(12, 2) not null default 0,
  -- Cuánto queda por cobrar. Se guarda aunque todavía no se muestre: traerlo
  -- después costaría abrir las 2 109 otra vez.
  saldo         numeric(12, 2) not null default 0,
  estado        text,

  sincronizado_en timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint transacciones_zoho_documento_unico unique (documento_id, tipo)
);

create index transacciones_zoho_cuenta_idx
  on public.transacciones_zoho (cuenta_id, fecha desc) where deleted_at is null;
create index transacciones_zoho_contacto_idx
  on public.transacciones_zoho (contacto_id) where deleted_at is null;

comment on table public.transacciones_zoho is 'Cada compra de un cliente de calle: factura o entrega. Espejo de Books, se rehace; aquí no se edita nada.';

alter table public.transacciones_zoho enable row level security;

create policy "transacciones_zoho_lectura"
  on public.transacciones_zoho for select to authenticated
  using (
    public.es_gerente()
    or perfil_id = auth.uid()
    or public.es_mi_equipo(perfil_id)
  );

create trigger transacciones_zoho_tocar_updated_at
  before update on public.transacciones_zoho
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Los renglones
--
-- `cuenta_id` y `perfil_id` se repiten aquí a propósito, aunque estén en la
-- transacción. Sin eso, «qué líneas compra esta cuenta» obliga a unir dos
-- tablas grandes en cada consulta, y el RLS tendría que evaluarse a través de
-- la unión. Es la única desnormalización del esquema y se paga sola.
-- ---------------------------------------------------------------------------

create table public.renglones_zoho (
  id              uuid primary key,
  transaccion_id  uuid not null references public.transacciones_zoho (id) on delete cascade,

  cuenta_id       uuid references public.cuentas (id),
  perfil_id       uuid references public.perfiles (id),
  fecha           date not null,

  item_id         text,
  sku             text,
  nombre          text not null,
  cantidad        numeric(12, 2) not null default 0,
  precio          numeric(12, 2) not null default 0,
  total           numeric(12, 2) not null default 0,

  created_at      timestamptz not null default now()
);

create index renglones_zoho_cuenta_idx on public.renglones_zoho (cuenta_id, fecha desc);
create index renglones_zoho_item_idx on public.renglones_zoho (item_id);
create index renglones_zoho_transaccion_idx on public.renglones_zoho (transaccion_id);

comment on table public.renglones_zoho is 'Qué se vendió en cada transacción. Es lo que permite decir «las bolsas se las dejó de comprar en marzo».';

alter table public.renglones_zoho enable row level security;

create policy "renglones_zoho_lectura"
  on public.renglones_zoho for select to authenticated
  using (
    public.es_gerente()
    or perfil_id = auth.uid()
    or public.es_mi_equipo(perfil_id)
  );

-- ---------------------------------------------------------------------------
-- 4. Qué compra cada cuenta, y qué dejó de comprar
--
-- La vista que contesta la pregunta del mostrador. Una fila por producto y
-- cuenta, con cuándo fue la última vez y cuánto lleva sin pedirlo.
-- ---------------------------------------------------------------------------

create view public.lineas_por_cuenta
with (security_invoker = true)
as
select
  r.cuenta_id,
  r.perfil_id,
  coalesce(nullif(trim(r.nombre), ''), 'Sin nombre') as producto,
  r.sku,
  count(*) as veces,
  sum(r.cantidad) as cantidad_total,
  sum(r.total) as total,
  min(r.fecha) as primera_vez,
  max(r.fecha) as ultima_vez,
  (public.hoy_panama() - max(r.fecha)) as dias_sin_pedirlo
from public.renglones_zoho r
where r.cuenta_id is not null
group by r.cuenta_id, r.perfil_id, coalesce(nullif(trim(r.nombre), ''), 'Sin nombre'), r.sku;

comment on view public.lineas_por_cuenta is 'Qué productos compra cada cuenta y cuánto lleva sin pedir cada uno. Hereda el RLS de renglones_zoho por security_invoker.';
