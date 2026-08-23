-- Listas: los paquetes de leads, por zona y por objetivo.
--
-- El problema que resuelven: poner "sin clasificar" como estado de la cuenta
-- fue correcto en el modelo y equivocado en la pantalla. Cincuenta puntos
-- escogidos en el mapa un domingo ahogan las treinta cuentas reales que el
-- vendedor trabaja, y la cartera deja de servir.
--
-- Un lead y una cuenta son objetos económicos distintos: **el lead es
-- abundante y desechable** —cuesta un toque, se bota sin culpa, vale como
-- conjunto—; **la cuenta es escasa y permanente** —costó una visita, tiene
-- historia, vale individualmente—. Lo que hay que separar es la superficie de
-- trabajo, no el registro.
--
-- Y hay una segunda razón, más importante: **sin intención declarada no hay
-- embudo**. La pregunta "trabajó 50 leads y convirtió 10, ¿qué pasó con los
-- 40?" hoy es incontestable porque el sistema no sabe que había 50.
--
-- Ver docs/12-flujo-vendedor.html y docs/13-flujo-lider.html.

-- ===========================================================================
-- 1. Qué clase de lista es
--
-- Las dos usan el mismo mecanismo y no se parecen en nada por dentro. La de
-- zona se arma barriendo el mapa y tiene veinte o treinta locales; la de
-- objetivos se arma por nombre —uno ya sabe cuáles son los bancos— y tiene
-- diez o quince, casi todos oficinas de negociación.
-- ===========================================================================

create type public.tipo_lista as enum (
  'zona',
  'objetivo'
);

-- ===========================================================================
-- 2. Qué espera de esa lista
--
-- Rápida o grande. **Es lo que él espera al armarla**, no lo que resultó: lo
-- real sale de la fecha estimada de cierre de cada venta.
--
-- Las dos cosas conviven a propósito y no es redundancia. Sin la marca en la
-- lista, la mezcla solo se puede mirar hacia atrás — y la mezcla es una
-- decisión que se toma antes de empezar. Y cuando lo esperado y lo real no
-- coinciden, eso no es un error de captura: es un hallazgo de mercado.
--
-- La misma categoría puede ser de las dos clases: un supermercado regional de
-- tres tiendas cierra en semanas, uno corporativo tarda meses.
-- ===========================================================================

create type public.clase_venta as enum (
  'rapida',
  'grande'
);

comment on type public.clase_venta is 'Rápida: cierra en semanas, paga el mes. Grande: tarda meses, construye el año.';

-- ===========================================================================
-- 3. La lista
-- ===========================================================================

create table public.listas (
  id uuid primary key,
  vendedor_id uuid not null references public.perfiles (id),
  nombre text not null,
  tipo public.tipo_lista not null default 'zona',

  -- Nulo mientras no la declare. No se fuerza: obligar a clasificar antes de
  -- saber nada del segmento produce una marca inventada.
  clase public.clase_venta,

  -- Solo para las de zona. Permite que la ruta ordene por cercanía y que la
  -- cartera se agrupe después por poblado.
  poblado text,

  -- El paquete no se cierra: es permanente y por zona, porque Aguadulce va a
  -- existir mientras exista Aguadulce. Archivar es para cuando de verdad se
  -- abandona un frente.
  archivada boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  deleted_at timestamptz,

  constraint listas_nombre_no_vacio check (length(trim(nombre)) > 0)
);

comment on table public.listas is 'Paquetes de leads por zona o por objetivo. Es donde se caza; la agenda es lo que se debe.';
comment on column public.listas.clase is 'Lo que el vendedor espera al armarla. Lo real sale de la fecha de cierre de cada venta.';

create index listas_vendedor_idx
  on public.listas (vendedor_id)
  where deleted_at is null and archivada = false;

-- ===========================================================================
-- 4. Qué hay dentro
--
-- Tabla de unión y no una columna en `cuentas`: una cuenta puede estar en más
-- de una lista sin que eso sea un error —un banco puede estar en "Banca
-- corporativa" y en un empujón de trimestre— y la fecha en que entró es dato:
-- es lo que permite decir "levantaste 60 y nunca fuiste a ver 26".
-- ===========================================================================

create table public.listas_cuentas (
  lista_id  uuid not null references public.listas (id) on delete cascade,
  cuenta_id uuid not null references public.cuentas (id),
  agregada_en timestamptz not null default now(),
  agregada_por uuid not null default auth.uid() references public.perfiles (id),

  primary key (lista_id, cuenta_id)
);

comment on table public.listas_cuentas is 'Qué cuentas hay en cada lista. La fecha de entrada mide la calidad de la planificación.';

create index listas_cuentas_cuenta_idx on public.listas_cuentas (cuenta_id);

-- ===========================================================================
-- 5. RLS en la misma migración (§16)
--
-- La lista es de su dueño. El líder ve las de su equipo y gerencia todas, con
-- la misma forma de siempre.
-- ===========================================================================

alter table public.listas enable row level security;

create policy "listas_vendedor"
  on public.listas
  for all
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "listas_equipo_lider"
  on public.listas
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

create policy "listas_gerencia"
  on public.listas
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger listas_tocar_updated_at
  before update on public.listas
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- El contenido hereda el permiso de la lista.
--
-- `security definer` para no recursar: la política de `listas_cuentas`
-- consulta `listas`, que a su vez tiene RLS, y sin esto Postgres evalúa en
-- círculo. Es la misma razón por la que `rol_actual()` es definer (§16).
-- ---------------------------------------------------------------------------

create function public.puedo_ver_lista(p_lista uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.listas l
    where l.id = p_lista
      and l.deleted_at is null
      and (
        l.vendedor_id = auth.uid()
        or public.es_mi_equipo(l.vendedor_id)
        or public.es_gerente()
      )
  );
$$;

create function public.puedo_editar_lista(p_lista uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.listas l
    where l.id = p_lista
      and l.deleted_at is null
      and (l.vendedor_id = auth.uid() or public.es_gerente())
  );
$$;

comment on function public.puedo_ver_lista is 'Divulgación controlada: contesta si esta lista es visible sin abrirla. Definer para evitar recursión al evaluar RLS.';

alter table public.listas_cuentas enable row level security;

create policy "listas_cuentas_lectura"
  on public.listas_cuentas
  for select
  to authenticated
  using (public.puedo_ver_lista(lista_id));

-- El líder ve las listas de su equipo pero no las modifica: son el plan del
-- vendedor y la autoría se queda con quien lo propuso.
create policy "listas_cuentas_escritura"
  on public.listas_cuentas
  for all
  to authenticated
  using (public.puedo_editar_lista(lista_id))
  with check (public.puedo_editar_lista(lista_id));

-- ===========================================================================
-- 6. La lista con sus cuentas contadas
--
-- `security_invoker` obligatorio: sin eso la vista correría con los permisos
-- de quien la creó y saltaría el RLS de las tablas de abajo. Es el error más
-- silencioso de todo el esquema — funcionaría y devolvería datos ajenos.
-- ===========================================================================

create view public.listas_resumen
with (security_invoker = true)
as
select
  l.*,
  coalesce(c.total, 0) as total,
  coalesce(c.sin_tocar, 0) as sin_tocar,
  coalesce(c.trabajadas, 0) as trabajadas,
  coalesce(c.viejos, 0) as sin_tocar_hace_mucho
from public.listas l
left join lateral (
  select
    count(*) as total,
    count(*) filter (where s.fecha is null) as sin_tocar,
    count(*) filter (where s.fecha is not null) as trabajadas,
    -- Un paquete permanente acumula muertos. La defensa no es vencerlo por la
    -- fuerza, es mostrar la antigüedad: "12 leads llevan más de dos meses en
    -- tu lista sin que los toques".
    count(*) filter (
      where s.fecha is null and lc.agregada_en < now() - interval '60 days'
    ) as viejos
  from public.listas_cuentas lc
  join public.cuentas cu on cu.id = lc.cuenta_id and cu.deleted_at is null
  left join lateral (
    select sg.fecha from public.seguimientos sg
    where sg.cuenta_id = cu.id and sg.deleted_at is null
    order by sg.fecha desc limit 1
  ) s on true
  where lc.lista_id = l.id
) c on true
where l.deleted_at is null;

comment on view public.listas_resumen is 'Listas con cuántas cuentas tienen, cuántas sin tocar y cuántas llevan más de dos meses esperando.';
