-- ===========================================================================
-- Cotizar en el acto, hasta cierto monto
--
-- El vendedor arma la cotización con productos del catálogo, cantidades y el
-- precio que él conoce, genera un PDF y lo manda por donde quiera desde el
-- teléfono. Queda guardado contra el cliente como constancia.
--
-- **Con un tope, y el tope no es una imposición: es lo que ya pasa.** Con la
-- libreta tampoco cotizan valores altos — la libreta es para dos o tres cajas
-- a un comercio que pide venta rápida. Lo que sube de ahí va a la oficina,
-- donde alguien mira el precio antes de que el cliente lo vea.
--
-- Y eso importa aquí más que en otros negocios: en la facturación real, el
-- mismo rollo se vende a $21.25 y a $29.50 según a quién. **Esos precios los
-- decidió alguien uno por uno.**
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Los umbrales, fuera del código
--
-- Un número que el negocio va a querer mover —y este lo va a mover, porque
-- todavía no se ha hablado con el equipo— no puede vivir en el código: cada
-- ajuste sería un despliegue. Vive aquí, lo cambia gerencia, y queda
-- constancia de quién lo cambió (§16).
-- ---------------------------------------------------------------------------

create table public.parametros (
  clave       text primary key,
  valor       numeric(12, 2) not null,
  descripcion text not null,

  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.perfiles (id)
);

comment on table public.parametros is 'Umbrales que el negocio ajusta sin tocar el código. Todo cambio queda en auditoria.';

insert into public.parametros (clave, valor, descripcion) values
  ('cotizacion_tope',
   500,
   'Hasta cuánto puede cotizar un vendedor por su cuenta. Por encima, la cotización se le pide a la oficina.');

alter table public.parametros enable row level security;

create policy "parametros_lectura"
  on public.parametros for select to authenticated using (true);

create policy "parametros_gerencia"
  on public.parametros for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

-- Cambiar un umbral cambia lo que la gente puede hacer. Queda anotado.
create function public.parametro_auditado()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
  values (
    'parametros',
    null,
    new.clave,
    old.valor::text,
    new.valor::text,
    auth.uid()
  );
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$fn$;

create trigger parametros_auditados
  before update on public.parametros
  for each row when (old.valor is distinct from new.valor)
  execute function public.parametro_auditado();

create function public.parametro(p_clave text)
returns numeric
language sql
stable
security definer
set search_path = public
as $fn$
  select valor from public.parametros where clave = p_clave;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. La cotización
-- ---------------------------------------------------------------------------

create type public.estado_cotizacion as enum ('borrador', 'emitida', 'anulada');

create table public.cotizaciones (
  id          uuid primary key,

  -- **No es correlativo, y es a propósito.** Pedir el siguiente número a la
  -- base exige señal, y el vendedor cotiza donde no la hay. O se queda sin
  -- poder cotizar, o dos cotizaciones salen con el mismo número. Como no es
  -- documento fiscal, se prefiere un código único que siempre funcione.
  codigo      text not null,

  cuenta_id   uuid not null references public.cuentas (id),
  vendedor_id uuid not null references public.perfiles (id),

  estado      public.estado_cotizacion not null default 'borrador',
  total       numeric(12, 2) not null default 0,
  validez_dias smallint not null default 15,
  notas       text,

  -- Dónde quedó el PDF. Se guarda el archivo, no se regenera: una cotización
  -- es un documento que alguien recibió. Si mañana cambia un precio y el PDF
  -- se rehace, el papel que tiene el cliente y el que ve la oficina dejan de
  -- coincidir.
  pdf_path    text,
  emitida_en  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.perfiles (id),
  deleted_at  timestamptz,

  constraint cotizaciones_codigo_unico unique (codigo),
  constraint cotizaciones_emitida_con_sello
    check ((estado = 'emitida') = (emitida_en is not null))
);

create index cotizaciones_cuenta_idx
  on public.cotizaciones (cuenta_id, created_at desc) where deleted_at is null;
create index cotizaciones_vendedor_idx
  on public.cotizaciones (vendedor_id, created_at desc) where deleted_at is null;

comment on table public.cotizaciones is 'Cotizaciones que arma el vendedor en el acto. El PDF queda guardado como constancia.';

create table public.renglones_cotizacion (
  id            uuid primary key,
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,

  -- El nombre se copia, no se referencia. El catálogo cambia y la cotización
  -- no: tiene que decir siempre lo que decía el papel que recibió el cliente.
  item_id       text,
  nombre        text not null,
  unidad        text,

  cantidad      numeric(12, 2) not null,
  precio        numeric(12, 2) not null,
  total         numeric(12, 2) generated always as (cantidad * precio) stored,
  orden         smallint not null default 0,

  created_at    timestamptz not null default now(),

  constraint renglones_cotizacion_cantidad_positiva check (cantidad > 0),
  constraint renglones_cotizacion_precio_no_negativo check (precio >= 0)
);

create index renglones_cotizacion_idx
  on public.renglones_cotizacion (cotizacion_id, orden);

comment on table public.renglones_cotizacion is 'Qué se cotizó. El nombre se copia del catálogo: la cotización no cambia aunque el catálogo sí.';

-- ---------------------------------------------------------------------------
-- 3. El tope, aplicado donde no se puede saltar
--
-- La pantalla también lo aplica —es lo que hace que se entienda— pero la regla
-- vive aquí. Una regla de negocio que solo existe en la interfaz es una
-- sugerencia.
-- ---------------------------------------------------------------------------

create function public.cotizacion_respeta_el_tope()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  tope numeric := coalesce(public.parametro('cotizacion_tope'), 0);
  rol public.rol_usuario;
begin
  if new.estado <> 'emitida' then
    return new;
  end if;

  select p.rol into rol from public.perfiles p where p.id = auth.uid();

  -- Gerencia no tiene tope: es quien decide los precios.
  if rol = 'gerente' then
    return new;
  end if;

  if new.total > tope then
    raise exception
      'Esta cotización suma % y el tope para cotizar directo es %. Pídesela a la oficina desde Solicitudes.',
      to_char(new.total, 'FM999,999.00'), to_char(tope, 'FM999,999.00')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger cotizaciones_respetan_el_tope
  before insert or update on public.cotizaciones
  for each row execute function public.cotizacion_respeta_el_tope();

-- ---------------------------------------------------------------------------
-- 4. RLS — el modelo de siempre
-- ---------------------------------------------------------------------------

alter table public.cotizaciones enable row level security;
alter table public.renglones_cotizacion enable row level security;

create policy "cotizaciones_lectura"
  on public.cotizaciones for select to authenticated
  using (
    public.es_gerente()
    or vendedor_id = auth.uid()
    or public.es_mi_equipo(vendedor_id)
    or public.es_administracion()
  );

create policy "cotizaciones_propias"
  on public.cotizaciones for all to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "renglones_cotizacion_lectura"
  on public.renglones_cotizacion for select to authenticated
  using (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_id
        and (
          public.es_gerente()
          or c.vendedor_id = auth.uid()
          or public.es_mi_equipo(c.vendedor_id)
          or public.es_administracion()
        )
    )
  );

create policy "renglones_cotizacion_propios"
  on public.renglones_cotizacion for all to authenticated
  using (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_id and c.vendedor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_id and c.vendedor_id = auth.uid()
    )
  );

create trigger cotizaciones_tocar_updated_at
  before update on public.cotizaciones
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 5. El precio que ya se le hizo a este cliente
--
-- Lo que convierte la cotización en algo que se arma en un minuto. Si el
-- cliente ya compró ese producto, el precio sale solo — y es el suyo, no un
-- precio de lista que no existe: el mismo rollo se factura a $21.25 y a $29.50
-- según a quién.
--
-- El vendedor lo puede cambiar. Es una propuesta, no una atadura.
-- ---------------------------------------------------------------------------

create function public.precio_anterior(p_cuenta uuid, p_item text)
returns table (precio numeric, fecha date)
language sql
stable
set search_path = public
as $fn$
  select r.precio, r.fecha
  from public.renglones_zoho r
  where r.cuenta_id = p_cuenta
    and r.item_id = p_item
    and r.precio > 0
  order by r.fecha desc
  limit 1;
$fn$;

comment on function public.precio_anterior is 'El último precio que se le facturó a este cliente por este producto. Se propone; el vendedor decide.';
