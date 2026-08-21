-- Oportunidades: prospecto + línea de producto + monto + etapa.
-- Cierra el pipeline visual de §7.1. Especificado en docs/02-modelo-datos.md.

-- ===========================================================================
-- oportunidades
--
-- Reutiliza el enum `etapa_prospecto` en vez de crear uno propio. Un segundo
-- catálogo casi idéntico obligaría a traducir entre dos vocabularios en cada
-- pantalla y en cada consulta, para distinguir matices que el negocio no hace.
--
-- No lleva `fecha_recontacto`: cuándo volver es una decisión del punto, no de
-- una línea de producto, y vive en `prospectos`.
-- ===========================================================================

create table public.oportunidades (
  id             uuid primary key,
  prospecto_id   uuid not null references public.prospectos (id),
  vendedor_id    uuid not null references public.perfiles (id),
  linea          public.linea_producto not null,
  descripcion    text,
  monto_estimado numeric(12,2),
  probabilidad   smallint,
  etapa          public.etapa_prospecto not null default 'nuevo',
  etapa_desde    timestamptz not null default now(),
  motivo_perdida public.motivo_perdida,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid not null default auth.uid() references public.perfiles (id),
  deleted_at     timestamptz,

  constraint oportunidades_motivo_solo_si_perdida
    check ((etapa = 'perdido') = (motivo_perdida is not null)),

  constraint oportunidades_probabilidad_valida
    check (probabilidad is null or probabilidad between 0 and 100),

  constraint oportunidades_monto_positivo
    check (monto_estimado is null or monto_estimado >= 0)
);

comment on table public.oportunidades is 'Oportunidad de venta: un punto, una línea de producto, un monto y una etapa.';
comment on column public.oportunidades.etapa_desde is 'Cuándo entró a la etapa actual. De aquí sale el tiempo de ciclo de §7.3.';

create index oportunidades_vendedor_idx
  on public.oportunidades (vendedor_id, etapa)
  where deleted_at is null;

create index oportunidades_prospecto_idx
  on public.oportunidades (prospecto_id)
  where deleted_at is null;

alter table public.oportunidades enable row level security;

create policy "oportunidades_vendedor"
  on public.oportunidades
  for all
  to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "oportunidades_equipo_lider"
  on public.oportunidades
  for select
  to authenticated
  using (public.es_mi_equipo(vendedor_id));

create policy "oportunidades_gerencia"
  on public.oportunidades
  for all
  to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create trigger oportunidades_tocar_updated_at
  before update on public.oportunidades
  for each row
  execute function public.tocar_updated_at();

-- Reutiliza el disparador genérico: mira new.etapa contra old.etapa, que
-- existen igual en esta tabla.
create trigger oportunidades_tocar_etapa_desde
  before update on public.oportunidades
  for each row
  execute function public.tocar_etapa_desde();

-- ===========================================================================
-- Auditoría de oportunidades
--
-- De estas filas sale la tasa de cierre por vendedor, por zona y por producto
-- (§7.3), sin pedirle al vendedor que reporte nada.
-- ===========================================================================

create function public.auditar_oportunidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('oportunidades', new.id, 'etapa', old.etapa::text, new.etapa::text, auth.uid());
  end if;

  if new.monto_estimado is distinct from old.monto_estimado then
    insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
    values ('oportunidades', new.id, 'monto_estimado', old.monto_estimado::text, new.monto_estimado::text, auth.uid());
  end if;

  return new;
end;
$$;

create trigger oportunidades_auditar
  after update on public.oportunidades
  for each row
  execute function public.auditar_oportunidad();
