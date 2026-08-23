-- El tiempo del vendedor: la jornada.
--
-- Hoy el sistema no sabe que el martes se fue de Santiago a Natá a cargar
-- mercancía y volvió a repartir. Sin ese dato su semana se ve floja cuando no
-- lo estaba — y una métrica injusta no se corrige después: se sabotea.
--
-- Es además la única captura de todo el sistema donde el interés del vendedor
-- y el de la empresa apuntan al mismo lado: **es su coartada**. Por eso se
-- alimenta sola, y por eso se presenta como lo que es —"esto existe para que
-- la semana que hiciste dos viajes a Natá no se vea floja"— y no como control.
--
-- Ver docs/09-medicion-y-gestion.md y docs/12-flujo-vendedor.html.

-- ===========================================================================
-- 1. Qué clases de bloque existen
--
-- La lista incluye a propósito lo que de verdad pasa y no solo lo que uno
-- quisiera que pasara: el día que no se pudo salir por calles cerradas es tan
-- real como el viaje de carga, y si no tiene dónde registrarse, la semana
-- aparece como flojera.
--
-- Provisional: hay que validarla sentándose con los tres vendedores y
-- reconstruyendo una semana real. Agregar valores después es una línea.
-- ===========================================================================

create type public.tipo_jornada as enum (
  'viaje_mercancia',
  'entrega',
  'entrega_urgente',
  'no_pudo_salir',
  'administrativo',
  'personal'
);

comment on type public.tipo_jornada is 'En qué se fue el tiempo que no fue vender. Catálogo provisional: se valida con los vendedores.';

-- ===========================================================================
-- 2. Cuánto duró
--
-- Media jornada de resolución alcanza. La pregunta de negocio es si la
-- logística se come el 30% o el 60% de la semana, no una planilla de nómina —
-- y pedir horas exactas a alguien que está cargando un camión produce números
-- inventados.
-- ===========================================================================

create type public.duracion_jornada as enum (
  'media',
  'completa'
);

-- ===========================================================================
-- 3. La tabla
-- ===========================================================================

create table public.jornadas (
  id uuid primary key,
  vendedor_id uuid not null references public.perfiles (id),
  fecha date not null,
  tipo public.tipo_jornada not null,
  duracion public.duracion_jornada not null,

  -- De dónde a dónde. Texto libre a propósito: "Natá → Aguadulce" lo escribe
  -- en tres segundos y se entiende; un catálogo de rutas no se llenaría.
  desde_texto text,
  hasta_texto text,

  -- A quién le entregó. Opcional, y vale la pena: la entrega también es un
  -- contacto con el cliente, y hoy el del interior ve a los suyos repartiendo
  -- sin recibir crédito por ese contacto.
  cuentas_atendidas uuid[] not null default '{}',

  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  deleted_at timestamptz
);

comment on table public.jornadas is 'Bloques de tiempo que no fueron venta. Es lo que permite leer la semana contra días vendibles y no contra el calendario.';
comment on column public.jornadas.cuentas_atendidas is 'A quién se le entregó. Cuenta como contacto para la cadencia de esos clientes.';
comment on column public.jornadas.fecha is 'El día del bloque, no el día en que se registró. Se llena de noche o a la mañana siguiente.';

create index jornadas_vendedor_fecha_idx
  on public.jornadas (vendedor_id, fecha desc)
  where deleted_at is null;

-- ===========================================================================
-- 4. RLS en la misma migración que crea la tabla (§16)
--
-- Mismo modelo que `seguimientos`: cada quien registra y ve lo suyo, el líder
-- ve a su equipo, gerencia ve todo.
--
-- Sin política de UPDATE para el vendedor, con una excepción: puede corregir
-- lo de hoy. Registrar "media jornada" cuando fue completa y no poder
-- arreglarlo hasta el viernes es lo que hace que se deje de registrar.
-- ===========================================================================

alter table public.jornadas enable row level security;

create policy "jornadas_vendedor_insert"
  on public.jornadas
  for insert
  to authenticated
  with check (vendedor_id = auth.uid());

create policy "jornadas_vendedor_select"
  on public.jornadas
  for select
  to authenticated
  using (vendedor_id = auth.uid());

-- Corregir lo de hoy sí; reescribir la semana pasada antes del cierre, no.
create policy "jornadas_vendedor_corrige_hoy"
  on public.jornadas
  for update
  to authenticated
  using (
    vendedor_id = auth.uid()
    and fecha = (now() at time zone 'America/Panama')::date
  )
  with check (
    vendedor_id = auth.uid()
    and fecha = (now() at time zone 'America/Panama')::date
  );

create policy "jornadas_equipo_lider"
  on public.jornadas
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

create policy "jornadas_gerencia"
  on public.jornadas
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger jornadas_tocar_updated_at
  before update on public.jornadas
  for each row execute function public.tocar_updated_at();
