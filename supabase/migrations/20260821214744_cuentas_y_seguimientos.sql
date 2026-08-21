-- Etapa A del plan v2: vocabulario y modelo de cuentas.
-- Ver docs/08-plan-v2.md.
--
-- El sistema deja de girar alrededor del prospecto —que se acaba al ganarlo o
-- perderlo— y pasa a girar alrededor de la cuenta, que se sigue trabajando
-- después de la primera venta.
--
-- Tres cambios de fondo:
--   1. `prospectos` pasa a `cuentas` y `visitas` a `seguimientos`.
--   2. La cuenta lleva `tipo`: prospecto o cliente.
--   3. La etapa se muda de la cuenta a la oportunidad. Se pierde una venta,
--      no un local.

-- ===========================================================================
-- 1. Renombrados
-- ===========================================================================

alter table public.prospectos rename to cuentas;
alter table public.visitas rename to seguimientos;

alter table public.seguimientos rename column prospecto_id to cuenta_id;
alter table public.compromisos rename column prospecto_id to cuenta_id;
alter table public.oportunidades rename column prospecto_id to cuenta_id;

-- El enum de etapas ya no describe a un prospecto sino a una oportunidad.
alter type public.etapa_prospecto rename to etapa_oportunidad;

comment on table public.cuentas is 'Cuenta: un punto con el que hay relación comercial, sea prospecto o cliente.';
comment on table public.seguimientos is 'Bitácora de interacciones: visita, llamada, WhatsApp, correo o entrega de muestra.';

-- ===========================================================================
-- 2. Tipo de cuenta
--
-- Es la marca del vendedor: "a este ya le vendí". Zoho sigue siendo la verdad
-- de la facturación y, cuando exista la integración, confirma o corrige esta
-- marca. Si el vendedor marca cliente y Zoho no tiene facturas, eso es un
-- hallazgo, no un error a esconder. Ver D-010.
-- ===========================================================================

create type public.tipo_cuenta as enum ('prospecto', 'cliente');

alter table public.cuentas
  add column tipo public.tipo_cuenta not null default 'prospecto';

comment on column public.cuentas.tipo is 'Prospecto hasta la primera venta; cliente después. Lo marca el vendedor.';

create index cuentas_tipo_idx on public.cuentas (tipo) where deleted_at is null;

-- ===========================================================================
-- 3. La etapa se muda a la oportunidad
--
-- Una cuenta con tres oportunidades en tres etapas distintas no está "en una
-- etapa". Lo que avanza, se gana o se pierde es la venta, no el local.
-- Ver D-011.
-- ===========================================================================

-- Esta política filtraba por etapa. Se elimina aquí porque depende de la
-- columna que está por desaparecer, y se recrea al final mirando el tipo.
drop policy "prospectos_admin_ganados" on public.cuentas;

alter table public.cuentas
  drop constraint prospectos_motivo_solo_si_perdido,
  drop constraint prospectos_recontacto_obligatorio;

drop index if exists prospectos_etapa_idx;
drop trigger prospectos_tocar_etapa_desde on public.cuentas;
drop trigger prospectos_auditar on public.cuentas;

alter table public.cuentas
  drop column etapa,
  drop column etapa_desde,
  drop column motivo_perdida,
  drop column fecha_recontacto;

-- La oportunidad recibe lo que la cuenta pierde. `motivo_perdida` ya existía.
alter table public.oportunidades
  add column fecha_recontacto date;

comment on column public.oportunidades.fecha_recontacto is 'Cuándo volver. Obligatoria si el motivo de pérdida significa reintentar (§6).';

alter table public.oportunidades
  add constraint oportunidades_recontacto_obligatorio
    check (
      motivo_perdida is null
      or motivo_perdida not in ('precio', 'espera_licitacion')
      or fecha_recontacto is not null
    );

-- ===========================================================================
-- 4. Funciones que nombraban a las tablas viejas
--
-- El renombrado arrastra políticas e índices, pero no el cuerpo de las
-- funciones, que es texto. Sin recrearlas, fallarían en tiempo de ejecución.
-- ===========================================================================

drop function if exists public.auditar_prospecto();

create function public.auditar_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La reasignación de cartera requiere aprobación del gerente (§3) y queda
  -- registrada aunque se haga por otra vía.
  if new.vendedor_id is distinct from old.vendedor_id then
    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('cuentas', new.id, 'vendedor_id', old.vendedor_id::text, new.vendedor_id::text, auth.uid());
  end if;

  -- El paso de prospecto a cliente es el hecho comercial más importante de
  -- una cuenta: es la primera venta.
  if new.tipo is distinct from old.tipo then
    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('cuentas', new.id, 'tipo', old.tipo::text, new.tipo::text, auth.uid());
  end if;

  return new;
end;
$$;

create trigger cuentas_auditar
  after update on public.cuentas
  for each row
  execute function public.auditar_cuenta();

drop function if exists public.buscar_duplicados(text, numeric, numeric, text, text);

create function public.buscar_duplicados(
  p_nombre   text,
  p_lat      numeric default null,
  p_lng      numeric default null,
  p_ruc      text default null,
  p_place_id text default null
)
returns table (
  id           uuid,
  nombre       text,
  vendedor     text,
  es_mio       boolean,
  distancia_m  numeric,
  coincide_por text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidatos as (
    select
      c.id,
      c.nombre,
      v.nombre as vendedor,
      c.vendedor_id = auth.uid() as es_mio,
      c.place_id,
      c.ruc,
      case
        when p_lat is null or p_lng is null or c.lat is null or c.lng is null then null
        else round((6371000 * 2 * asin(sqrt(
          power(sin(radians(c.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(c.lat)) *
          power(sin(radians(c.lng - p_lng) / 2), 2)
        )))::numeric, 0)
      end as distancia_m
    from public.cuentas c
    join public.perfiles v on v.id = c.vendedor_id
    where c.deleted_at is null
  )
  select
    c.id,
    c.nombre,
    c.vendedor,
    c.es_mio,
    c.distancia_m,
    case
      when p_place_id is not null and c.place_id = p_place_id then 'place_id'
      when p_ruc is not null and c.ruc = p_ruc then 'ruc'
      when c.distancia_m is not null and c.distancia_m < 50 then 'cercania'
      else 'nombre'
    end as coincide_por
  from candidatos c
  where (p_place_id is not null and c.place_id = p_place_id)
     or (p_ruc is not null and c.ruc = p_ruc)
     or (c.distancia_m is not null and c.distancia_m < 50)
     or (p_nombre is not null and length(p_nombre) >= 4 and c.nombre ilike '%' || p_nombre || '%')
  order by c.distancia_m nulls last
  limit 10;
$$;

comment on function public.buscar_duplicados is 'Divulgación controlada para el aviso de duplicado de §6. Devuelve lo mínimo para decidir, nunca el expediente ajeno.';

drop function if exists public.estado_de_puntos(text[]);

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
-- 5. Nombres de políticas, índices y disparadores
--
-- Postgres los arrastra al renombrar la tabla pero conserva sus nombres
-- viejos. Un objeto que se llama `prospectos_vendedor` sobre una tabla que se
-- llama `cuentas` es exactamente la clase de deuda que §17 pide no dejar.
-- ===========================================================================

alter policy "prospectos_vendedor" on public.cuentas rename to "cuentas_vendedor";
alter policy "prospectos_equipo_lider" on public.cuentas rename to "cuentas_equipo_lider";
alter policy "prospectos_gerencia" on public.cuentas rename to "cuentas_gerencia";

alter policy "visitas_vendedor_insert" on public.seguimientos rename to "seguimientos_vendedor_insert";
alter policy "visitas_vendedor_select" on public.seguimientos rename to "seguimientos_vendedor_select";
alter policy "visitas_equipo_lider" on public.seguimientos rename to "seguimientos_equipo_lider";
alter policy "visitas_gerencia" on public.seguimientos rename to "seguimientos_gerencia";

alter index prospectos_place_id_unico rename to cuentas_place_id_unico;
alter index prospectos_ruc_unico rename to cuentas_ruc_unico;
alter index prospectos_vendedor_idx rename to cuentas_vendedor_idx;
alter index visitas_prospecto_idx rename to seguimientos_cuenta_idx;
alter index visitas_vendedor_idx rename to seguimientos_vendedor_idx;
alter index compromisos_prospecto_idx rename to compromisos_cuenta_idx;
alter index oportunidades_prospecto_idx rename to oportunidades_cuenta_idx;

alter trigger prospectos_tocar_updated_at on public.cuentas rename to cuentas_tocar_updated_at;
alter trigger visitas_tocar_updated_at on public.seguimientos rename to seguimientos_tocar_updated_at;

-- La política de administración ya no mira una etapa: mira el tipo de cuenta.
-- Su bandeja son los clientes pendientes de alta formal (§7.2).
create policy "cuentas_admin_clientes"
  on public.cuentas
  for select
  to authenticated
  using (public.es_administracion() and tipo = 'cliente');
