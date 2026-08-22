-- Ciclo de vida de la cuenta: sin clasificar → prospecto → cliente, o descartada.
--
-- Una cuenta nace de dos formas distintas y hasta ahora las dos quedaban
-- iguales:
--
--   1. En la calle, parado frente al local. Se captura el GPS y se registra la
--      visita en el acto.
--   2. En la oficina, planificando sobre el mapa. No hay contacto todavía.
--
-- La segunda produce cuentas que nadie ha visitado ni contactado, y llamarlas
-- "prospecto" es afirmar algo que no ocurrió. `sin_clasificar` es lo que son
-- hasta que alguien las trabaje.
--
-- `descartada` conserva la cuenta con su visita y su motivo en vez de borrarla:
-- saber que se fue a ver y no sirvió es información, y evita que otro vendedor
-- repita el viaje.

-- ===========================================================================
-- 1. El enum crece
--
-- Se reemplaza en vez de usar `alter type ... add value`, porque un valor
-- agregado no se puede usar dentro de la misma transacción, y aquí hace falta
-- usarlo de inmediato como valor por omisión.
-- ===========================================================================

-- Dependen del tipo y hay que rehacerlas después del cambio. La vista incluida:
-- Postgres no deja cambiar el tipo de una columna de la que cuelga una vista.
drop view if exists public.cuentas_resumen;
drop policy "cuentas_admin_clientes" on public.cuentas;
drop function if exists public.estado_de_puntos(text[]);

alter type public.tipo_cuenta rename to tipo_cuenta_viejo;

create type public.tipo_cuenta as enum (
  'sin_clasificar',
  'prospecto',
  'cliente',
  'descartada'
);

alter table public.cuentas alter column tipo drop default;

alter table public.cuentas
  alter column tipo type public.tipo_cuenta
  using tipo::text::public.tipo_cuenta;

-- Las cuentas que ya existen se crearon a mano y visitándolas, así que se
-- quedan como están. El valor por omisión sí cambia: de aquí en adelante una
-- cuenta nace sin clasificar salvo que se diga lo contrario.
alter table public.cuentas
  alter column tipo set default 'sin_clasificar';

drop type public.tipo_cuenta_viejo;

comment on column public.cuentas.tipo is 'Sin clasificar hasta el primer contacto; luego prospecto, cliente o descartada.';

-- ===========================================================================
-- 2. Motivo del descarte de una cuenta
--
-- Distinto de `descartes`, que guarda puntos de Google que nunca llegaron a
-- ser cuenta. Esto es una cuenta que sí se creó, se fue a ver, y no sirvió.
-- ===========================================================================

alter table public.cuentas add column motivo_descarte public.motivo_descarte;

alter table public.cuentas
  add constraint cuentas_motivo_solo_si_descartada
    check ((tipo = 'descartada') = (motivo_descarte is not null));

comment on column public.cuentas.motivo_descarte is 'Por qué no sirvió. Obligatorio si y solo si la cuenta está descartada.';

-- ===========================================================================
-- 3. Se rehacen las piezas que dependían del tipo
-- ===========================================================================

-- La bandeja de administración sigue siendo la de clientes (§7.2).
create policy "cuentas_admin_clientes"
  on public.cuentas
  for select
  to authenticated
  using (public.es_administracion() and tipo = 'cliente');

create function public.estado_de_puntos(p_place_ids text[])
returns table (
  place_id          text,
  cuenta_id         uuid,
  es_mio            boolean,
  vendedor          text,
  tipo              public.tipo_cuenta,
  ultimo_contacto   timestamptz,
  ultimo_resultado  public.resultado_visita,
  descartado_por    text,
  motivo_descarte   public.motivo_descarte
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ids.place_id,
    c.id as cuenta_id,
    c.vendedor_id = auth.uid() as es_mio,
    v.nombre as vendedor,
    c.tipo,
    ult.fecha as ultimo_contacto,
    ult.resultado as ultimo_resultado,
    dv.nombre as descartado_por,
    d.motivo as motivo_descarte
  from unnest(p_place_ids) as ids(place_id)
  left join public.cuentas c
    on c.place_id = ids.place_id and c.deleted_at is null
  left join public.perfiles v on v.id = c.vendedor_id
  left join lateral (
    select s.fecha, s.resultado
    from public.seguimientos s
    where s.cuenta_id = c.id and s.deleted_at is null
    order by s.fecha desc
    limit 1
  ) ult on true
  left join public.descartes d
    on d.place_id = ids.place_id and d.deleted_at is null
  left join public.perfiles dv on dv.id = d.vendedor_id
  where c.id is not null or d.id is not null;
$$;

comment on function public.estado_de_puntos is 'Semáforo de §7.4. Divulgación controlada: devuelve lo mínimo para decidir a dónde ir.';

-- ===========================================================================
-- 4. El check-in deja de exigirse en lo que no es una visita
--
-- La restricción anterior pedía coordenadas o marca de `sin_gps` para el tipo
-- `visita`, y eso sigue igual. Lo que cambia es la interfaz: en una llamada o
-- un correo el check-in ni se pide. Se deja constancia aquí porque la regla de
-- §6 —check-in obligatorio— sigue viva y solo aplica a las visitas.
-- ===========================================================================

comment on column public.seguimientos.sin_gps is 'El GPS no enganchó. Solo aplica a las visitas: una llamada no tiene ubicación.';

-- ===========================================================================
-- 5. La vista se rehace igual que estaba
--
-- `security_invoker = true` no es opcional: sin eso correría con los permisos
-- de quien la creó y saltaría el RLS de las tablas de abajo, dejando que
-- cualquier vendedor viera la cartera completa.
-- ===========================================================================

create view public.cuentas_resumen
with (security_invoker = true)
as
select
  c.*,
  ult.fecha as ultimo_contacto,
  case
    when ult.fecha is null then null
    else (current_date - (ult.fecha at time zone 'America/Panama')::date)
  end as dias_sin_contacto,
  prox.fecha_compromiso as proximo_compromiso,
  case
    when prox.fecha_compromiso is null then null
    else (prox.fecha_compromiso - current_date)
  end as dias_hasta_compromiso,
  case
    when c.dias_cadencia is null then null
    when ult.fecha is null then true
    else (current_date - (ult.fecha at time zone 'America/Panama')::date) > c.dias_cadencia
  end as fuera_de_cadencia,
  (c.lat is null or c.lng is null) as sin_ubicacion,
  (select count(*) from public.oportunidades o
    where o.cuenta_id = c.id and o.deleted_at is null
      and o.etapa not in ('ganado', 'perdido')) as oportunidades_abiertas
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
where c.deleted_at is null;

comment on view public.cuentas_resumen is 'Cuentas con sus días calculados. Hereda el RLS de las tablas de abajo por security_invoker.';
