-- ===========================================================================
-- Los datos de la casa, para el papel que ve el cliente
--
-- La cotización que genera el vendedor tiene que parecerse a la que sale de la
-- oficina: mismo encabezado, mismos términos, mismo pie. Si el cliente recibe
-- un martes una del vendedor y un jueves una de la oficina y no se parecen, lo
-- que percibe es desorden.
--
-- **Van en la base y no en el código** por tres razones. Cambian —un teléfono,
-- un porcentaje de abono, los días de entrega— y cada cambio no puede ser un
-- despliegue. Los edita gerencia, que es quien los decide. Y así el número de
-- cuenta bancaria y el RUC los escribe la casa, no quedan escritos en el
-- repositorio.
--
-- El texto de los términos se guarda como texto largo, con un renglón por
-- línea. No es tabla de nada: es la letra chica, y su forma la decide quien la
-- escribe, no el esquema.
-- ===========================================================================

create table public.empresa (
  id            boolean primary key default true,

  nombre        text not null,
  ruc           text,
  direccion     text,
  telefono      text,
  correo        text,
  web           text,

  -- La letra chica del pie. Un renglón por línea.
  terminos      text,
  nota_pie      text,

  -- Cuántos días vale una cotización, por omisión.
  validez_dias  smallint not null default 15,

  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.perfiles (id),

  -- Una sola fila, siempre. Sin esto acaban existiendo tres «empresas» y nadie
  -- sabe cuál es la buena.
  constraint empresa_fila_unica check (id)
);

comment on table public.empresa is 'Los datos de la casa que salen en la cotización. Una sola fila; los edita gerencia.';

insert into public.empresa (nombre, direccion, web, terminos, nota_pie) values (
  'Papelería Comercial, S.A.',
  'Chilibre, Carretera Madden Dam, Sector Ma. Eugenia, del Puente Don Bosco',
  'www.papeleriacomercial.com.pa',
  'Pago contado. Abono contra orden de pedido y saldo contra entrega.',
  'Esperamos servirle pronto'
);

alter table public.empresa enable row level security;

-- Todo el equipo la lee: el vendedor la necesita para generar el documento.
create policy "empresa_lectura"
  on public.empresa for select to authenticated using (true);

create policy "empresa_gerencia"
  on public.empresa for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

-- Cambiar lo que sale en el papel que ve el cliente queda anotado.
create function public.empresa_auditada()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.auditoria (tabla, registro_id, campo, valor_anterior, valor_nuevo, actor_id)
  select
    'empresa',
    null,
    c.campo,
    c.antes,
    c.despues,
    auth.uid()
  from (values
    ('nombre', old.nombre, new.nombre),
    ('ruc', old.ruc, new.ruc),
    ('direccion', old.direccion, new.direccion),
    ('telefono', old.telefono, new.telefono),
    ('correo', old.correo, new.correo),
    ('web', old.web, new.web),
    ('terminos', old.terminos, new.terminos),
    ('nota_pie', old.nota_pie, new.nota_pie)
  ) as c(campo, antes, despues)
  where c.antes is distinct from c.despues;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$fn$;

create trigger empresa_auditada
  before update on public.empresa
  for each row execute function public.empresa_auditada();

-- ---------------------------------------------------------------------------
-- Dónde viven los PDF
--
-- Privado: una cotización lleva precios de un cliente concreto, y esos precios
-- son distintos para cada uno. Que fueran públicos por dirección adivinable
-- sería regalar la lista de precios de la competencia.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cotizaciones', 'cotizaciones', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;

create policy "cotizaciones_suben_los_duenos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cotizaciones'
    and exists (
      select 1 from public.cotizaciones c
      where c.id::text = split_part(name, '/', 1)
        and c.vendedor_id = auth.uid()
    )
  );

create policy "cotizaciones_las_lee_quien_ve_la_cuenta"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'cotizaciones'
    and exists (
      select 1 from public.cotizaciones c
      where c.id::text = split_part(name, '/', 1)
        and (
          public.es_gerente()
          or c.vendedor_id = auth.uid()
          or public.es_mi_equipo(c.vendedor_id)
          or public.es_administracion()
        )
    )
  );
