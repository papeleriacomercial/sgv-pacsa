-- Etapa 5 del plan v2: la oportunidad completa.
-- Ver docs/08-plan-v2.md.

-- ===========================================================================
-- 1. Nombre y fecha estimada de cierre
--
-- Una oportunidad llamada "rollos_fiscales" no le dice nada a nadie en una
-- lista de treinta. "Compra de 100 cajas de rollos térmicos 80mm" sí.
-- ===========================================================================

alter table public.oportunidades add column nombre text;

-- Las filas que ya existen quedan con un nombre derivado de su línea, para
-- poder exigir el campo sin perderlas.
update public.oportunidades
set nombre = 'Oportunidad de ' || replace(linea::text, '_', ' ')
where nombre is null;

alter table public.oportunidades
  alter column nombre set not null,
  add constraint oportunidades_nombre_no_vacio check (length(trim(nombre)) > 0);

alter table public.oportunidades add column fecha_cierre_estimada date;

comment on column public.oportunidades.nombre is 'Qué se está vendiendo, en palabras del vendedor.';
comment on column public.oportunidades.fecha_cierre_estimada is 'Cuándo se espera cerrar. Vencida, bloquea la edición hasta moverla.';

create index oportunidades_cierre_idx
  on public.oportunidades (fecha_cierre_estimada)
  where deleted_at is null and etapa not in ('ganado', 'perdido');

-- ===========================================================================
-- 2. Bitácora de avance
--
-- Notas que se agregan, nunca se editan. Cada una nace con su fecha y hora.
-- Un campo de texto único se sobrescribe y pierde la historia; esto conserva
-- cómo evolucionó la negociación, que es justamente lo que hay que mirar
-- cuando una oportunidad lleva dos meses en negociación.
-- ===========================================================================

create table public.notas_oportunidad (
  id             uuid primary key,
  oportunidad_id uuid not null references public.oportunidades (id),
  texto          text not null,
  autor_id       uuid not null default auth.uid() references public.perfiles (id),
  created_at     timestamptz not null default now(),

  constraint notas_texto_no_vacio check (length(trim(texto)) > 0)
);

comment on table public.notas_oportunidad is 'Bitácora de avance de una oportunidad. Se agrega, no se edita.';

create index notas_oportunidad_idx
  on public.notas_oportunidad (oportunidad_id, created_at desc);

alter table public.notas_oportunidad enable row level security;

-- Se leen y escriben con el mismo alcance que la oportunidad a la que cuelgan.
create policy "notas_vendedor"
  on public.notas_oportunidad
  for select
  to authenticated
  using (
    exists (
      select 1 from public.oportunidades o
      where o.id = oportunidad_id and o.vendedor_id = auth.uid()
    )
  );

create policy "notas_equipo_lider"
  on public.notas_oportunidad
  for select
  to authenticated
  using (
    exists (
      select 1 from public.oportunidades o
      where o.id = oportunidad_id and public.es_mi_equipo(o.vendedor_id)
    )
  );

create policy "notas_gerencia"
  on public.notas_oportunidad
  for select
  to authenticated
  using (public.es_gerente());

create policy "notas_escribe_su_dueno"
  on public.notas_oportunidad
  for insert
  to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.oportunidades o
      where o.id = oportunidad_id
        and (o.vendedor_id = auth.uid() or public.es_gerente())
    )
  );

-- Sin política de update ni de delete: la bitácora no se reescribe, igual que
-- los seguimientos y la auditoría.

-- ===========================================================================
-- 3. Seguimientos ligados a una oportunidad
--
-- Un seguimiento puede ser sobre la cuenta en general o sobre una venta
-- concreta. Ligarlo permite ver el panorama completo de una negociación en un
-- solo lugar.
-- ===========================================================================

alter table public.seguimientos
  add column oportunidad_id uuid references public.oportunidades (id);

comment on column public.seguimientos.oportunidad_id is 'Opcional: la venta concreta sobre la que trató este seguimiento.';

create index seguimientos_oportunidad_idx
  on public.seguimientos (oportunidad_id)
  where deleted_at is null and oportunidad_id is not null;

-- ===========================================================================
-- 4. La regla de la oportunidad vencida
--
-- Con la fecha de cierre pasada, la oportunidad se congela: lo único que se
-- puede hacer es moverla a una fecha futura. Obliga a que nadie arrastre
-- oportunidades muertas en el pipeline sin volver a comprometerse con una
-- fecha.
--
-- **Con dos excepciones**, para que la regla no obligue a mentir:
--
--   1. Cerrarla como ganada o perdida. Si no, para registrar una venta que se
--      perdió habría que inventarle primero una fecha futura de cierre.
--   2. Borrarla lógicamente.
-- ===========================================================================

create function public.oportunidad_vencida_congelada()
returns trigger
language plpgsql
as $$
begin
  if old.fecha_cierre_estimada is null
     or old.fecha_cierre_estimada >= current_date then
    return new;
  end if;

  -- Cerrarla siempre se puede: registrar el desenlace es un hecho, no una
  -- edición que haya que justificar con una fecha nueva.
  if new.etapa in ('ganado', 'perdido') and old.etapa not in ('ganado', 'perdido') then
    return new;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    return new;
  end if;

  if new.fecha_cierre_estimada is null
     or new.fecha_cierre_estimada <= current_date then
    raise exception
      'La fecha estimada de cierre está vencida. Muévela a una fecha futura antes de modificar la oportunidad.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger oportunidades_vencida_congelada
  before update on public.oportunidades
  for each row
  execute function public.oportunidad_vencida_congelada();
