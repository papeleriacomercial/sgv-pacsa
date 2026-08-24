-- ===========================================================================
-- El espejo de Zoho Books
--
-- Trae la cartera real de los vendedores de calle y su facturación. Ver
-- docs/05-modulos/7.6-clientes-y-facturacion.md.
--
-- **Books manda.** Nada de este espejo se edita desde la aplicación: se rehace
-- entero en cada pasada de noche. Lo que el vendedor escribe vive en `cuentas`,
-- que es suya; lo que la contabilidad sabe vive aquí.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Quién es quién
--
-- En Books los vendedores están escritos con el celular pegado al nombre:
--
--     Javier Rodríguez  ______ Cel. 6635-8728
--
-- Emparejar por texto —quitar guiones bajos, cortar en «Cel.»— funcionaría hoy
-- y se rompería el día que alguien cambie de celular. Esta tabla lo amarra una
-- vez y el emparejamiento deja de ser una adivinanza.
-- ---------------------------------------------------------------------------

create table public.vendedores_zoho (
  nombre_zoho text primary key,
  perfil_id   uuid not null references public.perfiles (id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.perfiles (id),
  deleted_at  timestamptz,

  constraint vendedores_zoho_nombre_no_vacio check (length(trim(nombre_zoho)) > 0)
);

comment on table public.vendedores_zoho is 'Equivalencia entre el nombre del vendedor en Books y su perfil del SGV. Se escribe a mano una vez.';

alter table public.vendedores_zoho enable row level security;

-- Todo el equipo la lee: sin ella no se entiende de quién es una cuenta.
create policy "vendedores_zoho_lectura"
  on public.vendedores_zoho for select to authenticated using (true);

create policy "vendedores_zoho_gerencia"
  on public.vendedores_zoho for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

create trigger vendedores_zoho_tocar_updated_at
  before update on public.vendedores_zoho
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Normalizar el RUC
--
-- En Books viene con el dígito verificante pegado y con guiones:
--
--     155123456-2-2017 DV 45   →   1551234562017
--     8-123-456 DV 12          →   8123456
--
-- El DV se descarta a propósito: **no forma parte del RUC**, se calcula a
-- partir de él. Dejarlo dentro haría que el mismo contribuyente no enganchara
-- si en un lado se escribió con DV y en el otro sin él — que es exactamente lo
-- que pasa cuando lo teclean dos personas distintas.
-- ---------------------------------------------------------------------------

create function public.normalizar_ruc(t text)
returns text
language sql
immutable
as $fn$
  select nullif(
    regexp_replace(
      regexp_replace(coalesce(t, ''), '\s*DV\s*[0-9]+\s*$', '', 'i'),
      '[^0-9A-Za-z]', '', 'g'
    ),
    ''
  );
$fn$;

comment on function public.normalizar_ruc is 'RUC comparable: sin el sufijo DV, sin guiones ni espacios. El DV no es parte del RUC, se deriva de él.';

-- El SGV también captura RUC, y hay que poder cruzarlos.
create index cuentas_ruc_normalizado_idx
  on public.cuentas (public.normalizar_ruc(ruc))
  where deleted_at is null and ruc is not null;

-- ---------------------------------------------------------------------------
-- 3. El espejo
-- ---------------------------------------------------------------------------

alter table public.cuentas
  add column zoho_contacto_id text;

comment on column public.cuentas.zoho_contacto_id is 'Contacto de Zoho Books al que corresponde. Explícito, para que el enlace sobreviva a que alguien corrija el RUC.';

create unique index cuentas_zoho_contacto_idx
  on public.cuentas (zoho_contacto_id)
  where deleted_at is null and zoho_contacto_id is not null;

create table public.clientes_zoho (
  id            uuid primary key,
  contacto_id   text not null,
  nombre        text not null,

  ruc           text,
  ruc_comparable text generated always as (public.normalizar_ruc(ruc)) stored,

  -- Tal como viene en la factura, con celular y todo. Se traduce por
  -- `vendedores_zoho`.
  vendedor_zoho text,
  perfil_id     uuid references public.perfiles (id),

  facturas_12m  integer not null default 0,
  total_12m     numeric(12, 2) not null default 0,
  primera_compra date,
  ultima_compra date,

  -- Mediana de los días entre compras. Nula con menos de tres facturas: dos
  -- compras dan un intervalo, y un intervalo no es un ritmo.
  cadencia_observada smallint,

  cuenta_id     uuid references public.cuentas (id),
  sincronizado_en timestamptz not null default now(),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Nulo a propósito: lo escribe la pasada de noche, que no es nadie.
  created_by    uuid references public.perfiles (id),
  deleted_at    timestamptz,

  constraint clientes_zoho_cadencia_razonable
    check (cadencia_observada is null or cadencia_observada between 1 and 365)
);

create unique index clientes_zoho_contacto_idx
  on public.clientes_zoho (contacto_id) where deleted_at is null;
create index clientes_zoho_ruc_idx
  on public.clientes_zoho (ruc_comparable) where deleted_at is null;
create index clientes_zoho_perfil_idx
  on public.clientes_zoho (perfil_id) where deleted_at is null;

comment on table public.clientes_zoho is 'Espejo de lo que Books sabe de cada cliente de calle. Se rehace en cada pasada: Books manda, aquí no se edita nada.';

alter table public.clientes_zoho enable row level security;

-- El mismo modelo de siempre: el vendedor lo suyo, el líder su equipo,
-- gerencia todo.
create policy "clientes_zoho_lectura"
  on public.clientes_zoho for select to authenticated
  using (
    public.es_gerente()
    or perfil_id = auth.uid()
    or public.es_mi_equipo(perfil_id)
  );

-- Nadie escribe desde la aplicación. La pasada de noche entra por el rol de
-- servicio, que se salta el RLS por diseño.
create policy "clientes_zoho_gerencia"
  on public.clientes_zoho for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

create trigger clientes_zoho_tocar_updated_at
  before update on public.clientes_zoho
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 4. La cuenta, con lo que Books sabe de ella
--
-- Recordatorio: el `select c.*` congela la lista de columnas al crear la
-- vista, así que se rehace entera cada vez que se toca `cuentas` —y acaba de
-- ganar `zoho_contacto_id`—. `security_invoker` no es opcional.
-- ---------------------------------------------------------------------------

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

  -- Lo que dice la contabilidad. Nulo si esta cuenta no enganchó con Books.
  z.ultima_compra,
  case
    when z.ultima_compra is null then null
    else (public.hoy_panama() - z.ultima_compra)
  end as dias_sin_comprar,
  z.facturas_12m,
  z.total_12m,
  z.cadencia_observada
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
