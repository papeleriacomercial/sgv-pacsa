-- ===========================================================================
-- LOS CIERRES DECLARADOS — docs/18-plan-diario.md §5
--
-- Lo pidió el usuario al leer la primera versión del plan diario: *«falta lo
-- principal, enganchar los cierres, que diariamente también pueda reportar qué
-- cerró y por qué cantidad»*.
--
-- ---------------------------------------------------------------------------
-- DOS NÚMEROS, Y NUNCA SE MEZCLAN
-- ---------------------------------------------------------------------------
--
--   DECLARADO   lo que el vendedor dice que cerró, el mismo día, de memoria.
--               Esta tabla. Sirve para el pulso del día y la conversación del
--               viernes.
--
--   FACTURADO   lo que Books emitió, de noche, con número de documento.
--               `transacciones_zoho`. Sirve para el mes, la comisión y
--               cualquier cifra que alguien cobre.
--
-- **La comisión se calcula sólo sobre lo facturado. Nunca sobre esta tabla.**
-- Es la regla más importante del capítulo: en el momento en que un número que el
-- vendedor teclea pueda mover lo que cobra, deja de ser información y pasa a ser
-- una negociación. Hoy ya es así —`comision_del_mes` lee `transacciones_zoho`—
-- y esto lo deja escrito para que no se afloje después.
--
-- Y **no se suman**. Un tablero que mostrara «vendido: $5 520» mezclando los dos
-- sería el caso de los dos números ciertos que juntos engañan.
--
-- ---------------------------------------------------------------------------
-- EL MONTO VA SIN ITBMS
-- ---------------------------------------------------------------------------
--
-- Para poder compararlo con el neto de la factura, que es la base de la
-- comisión. El impuesto no es venta: se cobra para el Estado y se entrega.
-- ===========================================================================

create type public.emparejado_como as enum (
  -- La factura llevaba escrito el código del documento del SGV. Exacto.
  'codigo',
  -- Misma cuenta, mismo monto con tolerancia, dentro de una ventana de días.
  'monto_y_ventana',
  -- Alguien lo confirmó mirando los dos.
  'a_mano'
);

comment on type public.emparejado_como is
  'Con qué grado de certeza se ató un cierre declarado a su factura. Se guarda porque un emparejamiento aproximado no se puede defender igual que uno exacto.';

create table public.cierres_declarados (
  id          uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.perfiles (id),

  -- En hora de Panamá. La base corre en UTC y a partir de las 7 p.m. de Panamá
  -- `current_date` ya es mañana (D-021) — y las 7 p.m. es justo cuando el
  -- vendedor cierra su día.
  fecha       date not null default public.hoy_panama(),

  cuenta_id   uuid not null references public.cuentas (id),

  -- **Sin ITBMS**, para poder compararlo con el neto de la factura.
  monto       numeric(12, 2) not null,

  /**
   * De qué documento salió, si salió de uno.
   *
   * Nulo es la venta del mostrador, la de la libreta, la que se despachó del
   * camión. **Ésa es la única que se teclea**; las demás ya traen su monto y sus
   * renglones del documento.
   */
  cotizacion_id uuid references public.cotizaciones (id),

  nota        text,

  -- -------------------------------------------------------------------------
  -- El emparejamiento con la factura. Vacío hasta que la pasada lo ate.
  -- -------------------------------------------------------------------------
  transaccion_id uuid references public.transacciones_zoho (id),
  emparejado_en  timestamptz,
  emparejado_como public.emparejado_como,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.perfiles (id),
  deleted_at  timestamptz,

  constraint cierres_declarados_monto_positivo check (monto > 0),

  -- **Una cotización se cierra una sola vez.** Sin esto, dos toques seguidos
  -- —o el vendedor cerrando el día dos veces— contarían la misma venta dos
  -- veces, y el declarado de la semana saldría inflado sin que nada falle.
  constraint cierres_declarados_una_por_documento
    unique (cotizacion_id),

  -- Las tres columnas del emparejamiento van juntas o no van. Una sola puesta
  -- es una fila a medio escribir, y después nadie sabe si se ató o no.
  constraint cierres_declarados_emparejado_completo
    check (
      (transaccion_id is null) = (emparejado_en is null)
      and (emparejado_en is null) = (emparejado_como is null)
    )
);

comment on table public.cierres_declarados is
  'Lo que el vendedor dice que cerró, el mismo día. NO es la fuente de la comisión: eso sale de transacciones_zoho. La diferencia entre los dos es el número que informa.';
comment on column public.cierres_declarados.monto is
  'Sin ITBMS, para poder compararlo con el neto de la factura.';
comment on column public.cierres_declarados.cotizacion_id is
  'Nulo cuando la venta no pasó por documento — la del mostrador. Es la única que se teclea.';

create index cierres_declarados_vendedor_idx
  on public.cierres_declarados (vendedor_id, fecha desc) where deleted_at is null;
create index cierres_declarados_cuenta_idx
  on public.cierres_declarados (cuenta_id) where deleted_at is null;
-- Los que todavía no se ataron a su factura: es la lista de trabajo de la
-- pasada de emparejamiento y la de las excepciones.
create index cierres_declarados_sin_emparejar_idx
  on public.cierres_declarados (fecha)
  where deleted_at is null and transaccion_id is null;

create trigger cierres_declarados_tocar_updated_at
  before update on public.cierres_declarados
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- RLS, con una diferencia que importa
--
-- El vendedor declara lo suyo y **lo puede corregir el mismo día**. Un monto
-- tecleado de memoria a las seis de la tarde se equivoca, y obligarlo a dejar
-- un número malo porque «ya se guardó» enseña a no declarar.
--
-- **Pasado el día, no.** Corregir la semana pasada es reescribir lo que ya se
-- comparó contra la factura y lo que ya salió en un reporte. Si de verdad hubo
-- un error viejo, lo arregla gerencia y queda a la vista.
-- ---------------------------------------------------------------------------

alter table public.cierres_declarados enable row level security;

create policy "cierres_declarados_lectura"
  on public.cierres_declarados for select to authenticated
  using (
    vendedor_id = auth.uid()
    or public.es_gerente()
    or public.es_mi_equipo(vendedor_id)
  );

create policy "cierres_declarados_declara_el_suyo"
  on public.cierres_declarados for insert to authenticated
  with check (vendedor_id = auth.uid());

create policy "cierres_declarados_corrige_el_suyo"
  on public.cierres_declarados for update to authenticated
  using (vendedor_id = auth.uid() and fecha = public.hoy_panama())
  with check (vendedor_id = auth.uid() and fecha = public.hoy_panama());

create policy "cierres_declarados_borra_el_de_hoy"
  on public.cierres_declarados for delete to authenticated
  using (vendedor_id = auth.uid() and fecha = public.hoy_panama());

create policy "cierres_declarados_gerencia"
  on public.cierres_declarados for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

-- ---------------------------------------------------------------------------
-- Que el vendedor no pueda tocar el emparejamiento
--
-- Las columnas del emparejamiento las escribe la pasada de la noche. Si el
-- vendedor pudiera escribirlas, podría declarar un cierre y atarlo él mismo a
-- una factura cualquiera — y entonces el cuadre, que es la razón de ser de todo
-- esto, no serviría para nada.
-- ---------------------------------------------------------------------------

create function public.cierre_declarado_el_emparejamiento_no_es_suyo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if public.es_gerente() then
    return new;
  end if;

  if new.transaccion_id is distinct from old.transaccion_id
     or new.emparejado_en is distinct from old.emparejado_en
     or new.emparejado_como is distinct from old.emparejado_como then
    raise exception
      'El cruce con la factura lo hace el sistema, no se escribe a mano.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.vendedor_id is distinct from old.vendedor_id
     or new.fecha is distinct from old.fecha then
    raise exception 'De un cierre declarado no se cambian el dueño ni la fecha.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger cierres_declarados_el_emparejamiento_no_es_suyo
  before update on public.cierres_declarados
  for each row execute function public.cierre_declarado_el_emparejamiento_no_es_suyo();

-- ---------------------------------------------------------------------------
-- Lo declarado por semana, al lado de lo facturado
--
-- **Las dos columnas, nunca una sola suma.** Es la vista que el reporte semanal
-- lee, y está escrita así para que no haya forma de mezclarlas por descuido.
--
-- `facturado` sale de `transacciones_zoho` con su total; `declarado` de esta
-- tabla. Que no coincidan **no es un error**: un cierre declarado el viernes se
-- factura el lunes, y una venta que entró por la oficina nunca se declaró. La
-- diferencia es el dato que informa.
-- ---------------------------------------------------------------------------

create view public.declarado_contra_facturado
with (security_invoker = true)
as
with semanas_declaradas as (
  select
    c.vendedor_id as perfil_id,
    (c.fecha - ((extract(isodow from c.fecha)::integer) - 1))::date as semana,
    sum(c.monto) as declarado,
    count(*)::integer as cierres
  from public.cierres_declarados c
  where c.deleted_at is null
  group by 1, 2
),
semanas_facturadas as (
  select
    t.perfil_id,
    (t.fecha - ((extract(isodow from t.fecha)::integer) - 1))::date as semana,
    sum(t.total) as facturado,
    count(*)::integer as documentos
  from public.transacciones_zoho t
  where t.deleted_at is null and t.perfil_id is not null
  group by 1, 2
)
select
  coalesce(d.perfil_id, f.perfil_id) as perfil_id,
  coalesce(d.semana, f.semana) as semana,
  coalesce(d.declarado, 0) as declarado,
  coalesce(d.cierres, 0) as cierres,
  coalesce(f.facturado, 0) as facturado,
  coalesce(f.documentos, 0) as documentos
from semanas_declaradas d
full outer join semanas_facturadas f
  on f.perfil_id = d.perfil_id and f.semana = d.semana;

comment on view public.declarado_contra_facturado is
  'Lo declarado y lo facturado por vendedor y semana, en columnas separadas. Que no coincidan no es un error: un cierre del viernes se factura el lunes. Hereda el RLS de las dos tablas.';
