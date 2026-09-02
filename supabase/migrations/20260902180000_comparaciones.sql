-- Cada comparación queda en la bitácora de la cuenta — §7.10, etapa 3a.
--
-- El usuario, 2 de septiembre de 2026: «el vendedor va a estar haciendo varias de estas
-- comparaciones en diferentes clientes o prospectos, y no va a tener la memoria de qué fue lo que le
-- ofreció a uno en particular». **La hoja se la lleva el cliente y nosotros nos quedamos sin copia**;
-- a los tres días el vendedor vuelve a un local donde escribió un precio a mano y no sabe cuál fue.
--
-- EL RESULTADO SE GUARDA AUNQUE SE PUEDA RECALCULAR, y es deliberado: esto es el registro de **lo que
-- se le dijo al cliente**, no una vista derivada. El día que se toque una fórmula, lo que quedó dicho
-- aquella tarde no puede cambiar retroactivamente.
--
-- NO HACE FALTA TABLA PARA EL PRÓXIMO PASO: `compromisos` ya existe y es «el motor del seguimiento
-- diario». La comparación inserta ahí como lo hace «Programar seguimiento», con `visita_id` en nulo.

-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------

create table if not exists public.comparaciones (
  id                    uuid primary key,
  cuenta_id             uuid not null references public.cuentas (id),
  vendedor_id           uuid not null references public.perfiles (id),
  creada_en             timestamptz not null default now(),

  -- Texto libre hasta que exista el catálogo de competencia (etapa 3b).
  marca_competencia     text,

  -- LO QUE EL CLIENTE QUISO DECIR. Todos opcionales: ésa es la razón de ser del módulo — si hubiera
  -- que exigirle el precio que paga hoy, la herramienta no serviría con el cliente que no lo dice.
  cliente_precio_caja   numeric(12,2),
  cliente_rollos_caja   integer,
  cliente_metros_rollo  numeric(10,2),
  cliente_cajas_pedido  integer,
  cliente_semanas       integer,

  -- LO NUESTRO. Obligatorio: la hoja nunca sale en blanco completo.
  nuestro_precio_caja   numeric(12,2) not null,
  nuestro_rollos_caja   integer       not null,
  nuestro_metros_rollo  numeric(10,2) not null,
  nuestro_calibre       integer,

  -- EL RESULTADO QUE SE LE ENSEÑÓ. Nulo cuando el cliente no dio lo suficiente para calcularlo, que
  -- es un caso normal y no una falla.
  costo_metro_cliente   numeric(14,6),
  costo_metro_nuestro   numeric(14,6),
  cajas_equivalentes    integer,
  ahorro_por_pedido     numeric(14,2),
  diferencia_al_ano     numeric(14,2),

  -- La copia exacta del archivo que recibió el cliente. Nulo si la subida quedó en cola.
  archivo_path          text,

  -- El próximo paso que dejó. Nulo si su creación no llegó a completarse.
  compromiso_id         uuid references public.compromisos (id),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid not null default auth.uid() references public.perfiles (id),
  deleted_at            timestamptz,

  -- Nuestros tres números son el mínimo, y un cero ahí no es un dato: es un error de captura que
  -- volvería infinito el costo por metro.
  constraint comparaciones_lo_nuestro_es_real
    check (nuestro_precio_caja > 0 and nuestro_rollos_caja > 0 and nuestro_metros_rollo > 0)
);

comment on table public.comparaciones is
  'Una fila por hoja de comparación entregada. Es la memoria de qué se le ofreció a cada cliente: la hoja se la lleva él, y sin esto no queda copia.';
comment on column public.comparaciones.archivo_path is
  'Ruta del .xlsx exacto que recibió el cliente. Nulo mientras la subida espera señal en la cola.';
comment on column public.comparaciones.costo_metro_cliente is
  'El resultado tal como se le mostró. Se guarda aunque sea recalculable: es lo que se dijo, no una vista derivada.';

create index if not exists comparaciones_cuenta_idx
  on public.comparaciones (cuenta_id, creada_en desc)
  where deleted_at is null;

-- La bitácora se lee por cuenta y por fecha; la agenda del vendedor, por vendedor.
create index if not exists comparaciones_vendedor_idx
  on public.comparaciones (vendedor_id, creada_en desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Permisos: los mismos que ya rigen para una cotización
-- ---------------------------------------------------------------------------

alter table public.comparaciones enable row level security;

-- La ve quien puede ver la cuenta: su vendedor, su líder, gerencia y administración.
create policy "comparaciones_lectura"
  on public.comparaciones for select to authenticated
  using (
    public.es_gerente()
    or vendedor_id = auth.uid()
    or public.es_mi_equipo(vendedor_id)
    or public.es_administracion()
  );

-- La escribe sólo quien la hizo. Comparar por otro embarraría de quién es la venta.
create policy "comparaciones_propias"
  on public.comparaciones for all to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- El depósito del archivo
-- ---------------------------------------------------------------------------
--
-- PRIVADO, por lo mismo que el de cotizaciones: la hoja lleva un precio hecho para un cliente
-- concreto, y esos precios son distintos para cada uno. Que fueran públicos por dirección adivinable
-- sería regalar la lista de precios.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comparaciones',
  'comparaciones',
  false,
  2097152,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

create policy "comparaciones_suben_los_duenos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comparaciones'
    and exists (
      select 1 from public.comparaciones c
      where c.id::text = split_part(name, '/', 1)
        and c.vendedor_id = auth.uid()
    )
  );

create policy "comparaciones_las_lee_quien_ve_la_cuenta"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comparaciones'
    and exists (
      select 1 from public.comparaciones c
      where c.id::text = split_part(name, '/', 1)
        and (
          public.es_gerente()
          or c.vendedor_id = auth.uid()
          or public.es_mi_equipo(c.vendedor_id)
          or public.es_administracion()
        )
    )
  );
