-- Solicitudes: el carril de lo que entra y necesita que alguien más actúe.
--
-- A las dos de la tarde llama un cliente de La Chorrera: quiere cotización, o
-- hace un pedido, o pide una muestra. **Eso no es un seguimiento** —un
-- seguimiento es algo que el vendedor hizo o prometió— es un encargo que entra
-- y que la mayoría de las veces resuelve otro.
--
-- Si cae en la agenda se pierde entre lo suyo y nadie de la oficina se entera
-- de que hay un pedido esperando. Por eso va aparte, y por eso lleva reloj.
--
-- No es alcance nuevo: §7.2 ya define el rol de administración con "bandejas
-- de cotización, alta de clientes y pedidos". Lo que faltaba era conectarlo con
-- el día del vendedor.

-- ===========================================================================
-- 1. Qué se pide
-- ===========================================================================

create type public.tipo_solicitud as enum (
  'pedido',
  'cotizacion',
  'muestra',
  'precio'
);

comment on type public.tipo_solicitud is 'Pedido, cotización y muestra las atiende administración; precio y condiciones, gerencia.';

-- ===========================================================================
-- 2. Quién lo resuelve
--
-- Los dos caminos son reales y ninguno es el excepcional: un pedido lo puede
-- facturar el vendedor con su talonario, o mandarlo a la oficina cuando el
-- cliente necesita factura fiscal. Una cotización sale de su libreta por foto,
-- o formal desde la oficina.
--
-- Registrar los dos tiene un beneficio que no se ve de entrada: **hoy la
-- facturación manual es invisible**. Con esto se puede ver al mes qué
-- proporción del negocio salió del talonario y cuál de la oficina.
-- ===========================================================================

create type public.resuelve_solicitud as enum (
  'yo',
  'oficina'
);

create type public.estado_solicitud as enum (
  'pendiente',
  'resuelta',
  'rechazada'
);

-- ===========================================================================
-- 3. La tabla
-- ===========================================================================

create table public.solicitudes (
  id uuid primary key,
  cuenta_id uuid not null references public.cuentas (id),
  -- Si el encargo pertenece a una venta concreta, queda ligado: es lo que
  -- permite ver desde la venta todo lo que está esperando por ella.
  oportunidad_id uuid references public.oportunidades (id),
  vendedor_id uuid not null references public.perfiles (id),

  tipo public.tipo_solicitud not null,
  resuelve public.resuelve_solicitud not null default 'oficina',
  detalle text not null,
  monto_estimado numeric(12, 2),
  para_cuando date,

  estado public.estado_solicitud not null default 'pendiente',
  respuesta text,
  resuelta_en timestamptz,
  resuelta_por uuid references public.perfiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  deleted_at timestamptz,

  constraint solicitudes_detalle_no_vacio check (length(trim(detalle)) > 0),
  constraint solicitudes_monto_positivo
    check (monto_estimado is null or monto_estimado >= 0),

  -- Resuelta o rechazada exige sello de cuándo. Sin esto el reloj de las 24
  -- horas no se puede calcular, que es la mitad del valor de esta tabla.
  constraint solicitudes_sello_al_cerrar
    check ((estado = 'pendiente') = (resuelta_en is null))
);

comment on table public.solicitudes is 'Encargos que entran y necesitan que alguien más actúe. Con reloj: un pedido sin plazo de respuesta es un pedido perdido.';
comment on column public.solicitudes.resuelve is 'Yo: se queda en la lista del vendedor. Oficina: sale a la bandeja con reloj.';
comment on column public.solicitudes.para_cuando is 'Para cuándo lo necesita el cliente. Distinto de cuándo se contesta.';

create index solicitudes_bandeja_idx
  on public.solicitudes (estado, created_at)
  where deleted_at is null and resuelve = 'oficina';

create index solicitudes_vendedor_idx
  on public.solicitudes (vendedor_id, estado)
  where deleted_at is null;

create index solicitudes_cuenta_idx
  on public.solicitudes (cuenta_id)
  where deleted_at is null;

-- ===========================================================================
-- 4. RLS en la misma migración (§16)
-- ===========================================================================

alter table public.solicitudes enable row level security;

-- El vendedor crea las suyas y las ve. También las actualiza: las que se
-- resuelve él mismo con su talonario las cierra él.
create policy "solicitudes_vendedor"
  on public.solicitudes
  for all
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "solicitudes_equipo_lider"
  on public.solicitudes
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

-- Administración atiende su bandeja: pedidos, cotizaciones y muestras que
-- salieron a la oficina. Los precios no — esos son decisión de gerencia.
create policy "solicitudes_administracion"
  on public.solicitudes
  for select
  to authenticated
  using (
    public.es_administracion()
    and resuelve = 'oficina'
    and tipo <> 'precio'
  );

create policy "solicitudes_administracion_resuelve"
  on public.solicitudes
  for update
  to authenticated
  using (
    public.es_administracion()
    and resuelve = 'oficina'
    and tipo <> 'precio'
  )
  with check (
    public.es_administracion()
    and resuelve = 'oficina'
    and tipo <> 'precio'
  );

create policy "solicitudes_gerencia"
  on public.solicitudes
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger solicitudes_tocar_updated_at
  before update on public.solicitudes
  for each row execute function public.tocar_updated_at();

-- ===========================================================================
-- 5. El reloj
--
-- El compromiso de gerencia es contestar en 24 horas hábiles lo que desbloquea
-- una venta. Y la simetría es lo que lo vuelve creíble: si los vendedores
-- quedan medidos y la oficina no, esto es control con buena interfaz.
--
-- Por eso el tiempo de respuesta se calcula y se ve, para los dos lados.
-- ===========================================================================

create view public.solicitudes_resumen
with (security_invoker = true)
as
select
  s.*,
  case
    when s.resuelta_en is null then
      extract(epoch from (now() - s.created_at)) / 3600
    else
      extract(epoch from (s.resuelta_en - s.created_at)) / 3600
  end as horas,
  -- Vencida es lo pendiente que ya pasó de un día. Aproximación deliberada:
  -- contar solo horas hábiles exige un calendario de feriados que hoy no
  -- existe, y para la conversación que esto habilita alcanza.
  (s.estado = 'pendiente' and s.created_at < now() - interval '24 hours')
    as vencida
from public.solicitudes s
where s.deleted_at is null;

comment on view public.solicitudes_resumen is 'Solicitudes con su reloj. Hereda el RLS por security_invoker.';
