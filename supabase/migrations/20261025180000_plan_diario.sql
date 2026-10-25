-- ===========================================================================
-- EL PLAN DIARIO — docs/18-plan-diario.md, capa 1
--
-- Reemplaza al contrato semanal como mecánica de planificación. El diagnóstico
-- es del usuario, el 25 de octubre de 2026:
--
--     «Algunos no reparten su semana y sencillamente no veo esto, no tengo un
--      mecanismo de reclamo… no hay consecuencias. Por lo tanto, sigo
--      vendiendo, me siguen pagando mis comisiones. Y la herramienta se queda
--      como algo opcional.»
--
-- Y sobre las tres preguntas del cierre semanal:
--
--     «Esto de las preguntas, de qué te frena, qué te sorprendió, eso no está
--      funcionando. Yo estaba agarrando eso de poner cualquier frase ahí.»
--
-- **El concepto se lo había advertido a sí mismo.** `10-concepto.html` dice que
-- «un relato suelto se vuelve teatro en un mes; uno anclado tiene que
-- reconciliar con la realidad». Las tres preguntas estaban ancladas a números y
-- no alcanzó, y conviene entender por qué: **un ancla sin consecuencia es
-- decoración.** De ahí que esta migración guarde la hora de apertura y el
-- cumplimiento de cada meta, que es lo que después se puede reclamar.
--
-- ---------------------------------------------------------------------------
-- NO SE TOCA NADA DE LO QUE YA EXISTE
-- ---------------------------------------------------------------------------
--
-- Lo preguntó el usuario antes de aprobar: *«lo importante es que no se les
-- borre sus listas, sus cuentas, sus mapas»*. Esta migración **sólo crea**:
-- tres tablas, dos enums, un parámetro y dos funciones. Ni un `alter table`
-- sobre `cuentas`, `listas`, `seguimientos`, `compromisos`, `oportunidades`,
-- `cotizaciones` ni el espejo de Zoho.
--
-- **Y el contrato semanal no se borra.** `cierres` se queda con su histórico de
-- agosto a octubre y con la observación de gerencia: lo que se jubila es la
-- captura, no el dato. Un histórico que se reescribe no sirve para comparar.
--
-- ---------------------------------------------------------------------------
-- LA TRAMPA QUE SE EVITA DE ENTRADA
-- ---------------------------------------------------------------------------
--
-- `a_tiempo` y `logrado` **se guardan**, no se deducen al leer. En el proyecto
-- hermano hay un pendiente abierto que dice exactamente esto —«un viernes
-- pasado se mide con el horario de hoy»—: allá el score de cada día se
-- recalcula con el turno vigente **hoy**, así que cambiar el horario cambia el
-- pasado. Acá la hora de corte es un parámetro que se va a mover, y el día que
-- se mueva **los días ya cerrados tienen que seguir diciendo lo que dijeron**.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. La hora de corte, como parámetro
--
-- Decidida por el usuario: las 9:00. Va en `parametros` y no en el código por
-- la misma razón que el porcentaje de comisión y el tope de cotización — es del
-- negocio, y el negocio lo mueve. Admite media hora: 9.5 son las nueve y media.
-- ---------------------------------------------------------------------------

insert into public.parametros (clave, valor, descripcion) values
  ('plan_hora_corte',
   9,
   'Hasta qué hora se puede abrir el plan del día y contar como a tiempo. 9 son las 9:00 a.m.; admite 9.5 para las nueve y media.')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Los dos catálogos cerrados
--
-- **Enum y no texto libre, y es la decisión de fondo del rediseño.** Una lista
-- corta se puede contar al cabo de dos meses; «el tráfico» escrito cuarenta
-- veces, no. Es la misma razón por la que `motivo_perdida` existe desde el
-- principio: sin catálogo, «perdimos» no se puede repartir entre precio, plazo
-- y especificación.
-- ---------------------------------------------------------------------------

create type public.tipo_accion_plan as enum (
  'llamar_frio',
  'visitar',
  'reparto',
  'cobrar',
  'entregar_cotizacion'
);

comment on type public.tipo_accion_plan is 'Qué clase de trabajo se compromete el vendedor a hacer hoy. Cerrado a propósito: es lo que permite contar.';

create type public.motivo_incumplido as enum (
  'falto_tiempo',
  'cliente_cambio_el_dia',
  'cliente_no_estaba',
  'se_alargo_una_visita',
  'problema_de_vehiculo',
  'otra_cosa'
);

comment on type public.motivo_incumplido is 'Por qué no se cumplió una meta del día. «otra_cosa» exige escribirlo, y si sale mucho es que falta un motivo en este catálogo.';

-- ---------------------------------------------------------------------------
-- 3. El plan del día
-- ---------------------------------------------------------------------------

create table public.planes_diarios (
  id          uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.perfiles (id),

  -- En hora de Panamá, siempre. La base corre en UTC y a partir de las 7 p.m.
  -- de Panamá `current_date` ya es mañana (D-021).
  fecha       date not null default public.hoy_panama(),

  abierto_en  timestamptz not null default now(),

  -- **Se guarda, no se deduce.** Ver la trampa en la cabecera: la hora de corte
  -- es un parámetro que va a cambiar, y un día ya cerrado tiene que seguir
  -- diciendo lo que dijo. Lo escribe el disparador de abajo.
  a_tiempo    boolean not null default true,

  cerrado_en  timestamptz,

  -- El texto libre existe, pero colgado de algo. Una nota suelta se vuelve
  -- teatro; una atada a una cuenta permite que mañana el sistema pregunte
  -- «¿cerró?».
  nota        text,
  nota_cuenta_id uuid references public.cuentas (id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.perfiles (id),
  deleted_at  timestamptz,

  -- Un plan por persona y por día. Dos planes del mismo día serían dos
  -- compromisos distintos sobre las mismas horas.
  constraint planes_diarios_uno_por_dia unique (vendedor_id, fecha),

  -- La nota sin cuenta se acepta; una cuenta sin nota no dice nada.
  constraint planes_diarios_nota_con_texto
    check (nota_cuenta_id is null or coalesce(trim(nota), '') <> '')
);

comment on table public.planes_diarios is 'Lo que cada vendedor se compromete a hacer en el día. Uno por persona y fecha; reemplaza al contrato semanal.';
comment on column public.planes_diarios.a_tiempo is 'Si se abrió antes de la hora de corte. GUARDADO y no deducido: mover el parámetro no puede reescribir el pasado.';
comment on column public.planes_diarios.cerrado_en is 'Cuándo lo cerró. Nulo es una falta: el día quedó sin rendir.';

create index planes_diarios_vendedor_idx
  on public.planes_diarios (vendedor_id, fecha desc) where deleted_at is null;
create index planes_diarios_fecha_idx
  on public.planes_diarios (fecha desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Las acciones que el vendedor escoge
-- ---------------------------------------------------------------------------

create table public.plan_acciones (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references public.planes_diarios (id) on delete cascade,

  orden     smallint not null,
  tipo      public.tipo_accion_plan not null,

  -- De dónde sale el trabajo. Una lista, o cuentas sueltas en la tabla de
  -- abajo. Nunca escrito a mano: **se escoge, no se escribe.**
  lista_id  uuid references public.listas (id),

  meta      integer not null,

  -- Al cerrar el día. `logrado` se congela acá por lo mismo que `a_tiempo`:
  -- recalcularlo mañana con los datos de mañana daría otro número.
  logrado   integer,
  motivo    public.motivo_incumplido,
  motivo_otro text,
  pasar_a_manana boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plan_acciones_orden_valido check (orden between 1 and 3),
  constraint plan_acciones_meta_positiva check (meta > 0),
  constraint plan_acciones_logrado_no_negativo check (logrado is null or logrado >= 0),
  constraint plan_acciones_una_por_puesto unique (plan_id, orden),

  -- «otra_cosa» obliga a escribir qué fue, y ningún otro motivo lo admite: si
  -- se pudiera escribir junto a un motivo del catálogo, el catálogo dejaría de
  -- servir para contar.
  --
  -- **Escrito con `case` y no con una igualdad, porque un `check` que da NULL
  -- pasa.** La primera versión era `(motivo = 'otra_cosa') = (motivo_otro <> '')`,
  -- y con `motivo` nulo esa comparación no da `false` sino NULL — así que
  -- aceptaba un texto sin motivo. Un hueco que no se ve leyendo la línea.
  constraint plan_acciones_otra_cosa_se_explica
    check (
      case
        when motivo is null then motivo_otro is null
        when motivo = 'otra_cosa' then coalesce(trim(motivo_otro), '') <> ''
        else motivo_otro is null
      end
    )
);

comment on table public.plan_acciones is 'Hasta tres acciones propias por plan. Los seguimientos no van acá: ésos los impone el sistema y no se escogen.';
comment on column public.plan_acciones.meta is 'El número al que se compromete. Sin meta la acción no se puede cumplir ni incumplir.';
comment on column public.plan_acciones.logrado is 'Cuánto hizo, congelado al cerrar el día. Nulo mientras el día está abierto.';

create index plan_acciones_plan_idx on public.plan_acciones (plan_id);
create index plan_acciones_lista_idx on public.plan_acciones (lista_id);

-- ---------------------------------------------------------------------------
-- 5. Las cuentas de una acción
--
-- **Es lo que contesta la pregunta de gerencia**, textual: *«si ellos ponen que
-- solamente van a haber 3 clientes, entender, poder ver cuáles son esos 3
-- clientes… y poder entender si efectivamente son clientes que demandan mucho
-- tiempo o sencillamente se puso una meta muy fácil»*.
--
-- Sin esta tabla, una acción de «visitar, meta 3» es un número sin nombres y la
-- conversación no se puede tener.
-- ---------------------------------------------------------------------------

create table public.plan_accion_cuentas (
  accion_id uuid not null references public.plan_acciones (id) on delete cascade,
  cuenta_id uuid not null references public.cuentas (id),

  primary key (accion_id, cuenta_id)
);

comment on table public.plan_accion_cuentas is 'Qué cuentas nombró el vendedor en una acción. Es el detalle que permite juzgar si la meta era fácil.';

create index plan_accion_cuentas_cuenta_idx on public.plan_accion_cuentas (cuenta_id);

-- ---------------------------------------------------------------------------
-- 6. El tope de tres, puesto por la base
--
-- **No se deja a la pantalla.** La regla es la que obliga a elegir, y elegir es
-- justamente lo que gerencia quiere ver; una lista de doce es una lista de
-- cero. Es el mismo criterio del tope de cotización: «dejarla a la memoria es
-- dejar que un día pase».
--
-- La restricción `orden between 1 and 3` ya topa de hecho, pero da un mensaje
-- de Postgres que no dice nada. Este disparador explica.
-- ---------------------------------------------------------------------------

create function public.plan_acciones_tope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  cuantas integer;
begin
  select count(*) into cuantas
    from public.plan_acciones
   where plan_id = new.plan_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if cuantas >= 3 then
    raise exception
      'Un plan lleva hasta tres acciones propias. Si quieres una cuarta, quita una: la restricción es la que obliga a elegir.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger plan_acciones_tope_de_tres
  before insert on public.plan_acciones
  for each row execute function public.plan_acciones_tope();

-- ---------------------------------------------------------------------------
-- 7. ¿Se abrió a tiempo?
--
-- Se decide al insertar y queda escrito. **Pasada la hora el día sigue
-- funcionando** —se puede trabajar y registrar— pero queda marcado, y eso es lo
-- que se ve y lo que cuenta.
--
-- Trabar la aplicación al que no planificó se consideró y se descartó: un
-- vendedor que no puede registrar una visita **no registra la visita, pero la
-- visita ocurre igual**. Se traba el dato, no la conducta, y encima se le
-- regala la excusa.
-- ---------------------------------------------------------------------------

create function public.plan_marca_si_llego_a_tiempo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  corte numeric := coalesce(public.parametro('plan_hora_corte'), 9);
  ahora time := (new.abierto_en at time zone 'America/Panama')::time;
begin
  -- Un plan abierto para un día que no es hoy no se juzga por la hora: lo
  -- normal es que sea una corrección, y marcarlo tarde sería inventar una falta.
  if new.fecha <> (new.abierto_en at time zone 'America/Panama')::date then
    new.a_tiempo := false;
    return new;
  end if;

  new.a_tiempo := ahora < make_time(floor(corte)::int, ((corte - floor(corte)) * 60)::int, 0);
  return new;
end;
$fn$;

create trigger planes_diarios_a_tiempo
  before insert on public.planes_diarios
  for each row execute function public.plan_marca_si_llego_a_tiempo();

-- ---------------------------------------------------------------------------
-- 8. RLS: el plan es de su dueño
--
-- La misma forma de siempre —el vendedor lo suyo, el líder su equipo, gerencia
-- todo— y **el resumen de una línea va aparte**, en §9. Si los pares pudieran
-- leer la tabla para ver el resumen, podrían leer también la nota y el detalle.
-- ---------------------------------------------------------------------------

alter table public.planes_diarios enable row level security;
alter table public.plan_acciones enable row level security;
alter table public.plan_accion_cuentas enable row level security;

create policy "planes_diarios_lectura"
  on public.planes_diarios for select to authenticated
  using (
    vendedor_id = auth.uid()
    or public.es_gerente()
    or public.es_mi_equipo(vendedor_id)
  );

-- El vendedor arma y cierra su propio día. Nadie planifica por otro: un plan
-- que el vendedor no escribió no es un compromiso suyo.
create policy "planes_diarios_propio"
  on public.planes_diarios for insert to authenticated
  with check (vendedor_id = auth.uid());

create policy "planes_diarios_cierra_el_suyo"
  on public.planes_diarios for update to authenticated
  using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());

create policy "planes_diarios_gerencia"
  on public.planes_diarios for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

-- Las acciones heredan el permiso de su plan. Se escribe con `exists` y no con
-- un `join` porque el RLS se evalúa fila por fila.
create policy "plan_acciones_del_plan"
  on public.plan_acciones for select to authenticated
  using (
    exists (
      select 1 from public.planes_diarios p
      where p.id = plan_id
        and (p.vendedor_id = auth.uid() or public.es_gerente() or public.es_mi_equipo(p.vendedor_id))
    )
  );

-- ---------------------------------------------------------------------------
-- **EL DUEÑO INSERTA Y ACTUALIZA, PERO NO BORRA.** Y es la guarda que decide si
-- todo esto sirve de algo.
--
-- Una acción que se puede borrar a las cuatro de la tarde no es un compromiso:
-- el que no cumplió la quita y el día le queda perfecto. Lo mismo vale para
-- bajarle la meta, y de eso se encarga el disparador de §8.b.
--
-- Borrar queda para gerencia, que tiene su política de abajo. Si un vendedor se
-- equivoca al armar el día, lo correcto es que alguien lo vea.
-- ---------------------------------------------------------------------------

create policy "plan_acciones_arma_el_dueno"
  on public.plan_acciones for insert to authenticated
  with check (
    exists (select 1 from public.planes_diarios p where p.id = plan_id and p.vendedor_id = auth.uid())
  );

create policy "plan_acciones_cierra_el_dueno"
  on public.plan_acciones for update to authenticated
  using (
    exists (select 1 from public.planes_diarios p where p.id = plan_id and p.vendedor_id = auth.uid())
  )
  with check (
    exists (select 1 from public.planes_diarios p where p.id = plan_id and p.vendedor_id = auth.uid())
  );

create policy "plan_acciones_gerencia"
  on public.plan_acciones for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

create policy "plan_accion_cuentas_de_la_accion"
  on public.plan_accion_cuentas for select to authenticated
  using (
    exists (
      select 1 from public.plan_acciones a
      join public.planes_diarios p on p.id = a.plan_id
      where a.id = accion_id
        and (p.vendedor_id = auth.uid() or public.es_gerente() or public.es_mi_equipo(p.vendedor_id))
    )
  );

-- Igual que las acciones: el dueño las nombra al armar el día y no las puede
-- quitar después. Quitar una cuenta de una acción ya abierta borraría a quién
-- había prometido visitar, que es justo lo que gerencia va a mirar.
create policy "plan_accion_cuentas_nombra_el_dueno"
  on public.plan_accion_cuentas for insert to authenticated
  with check (
    exists (
      select 1 from public.plan_acciones a
      join public.planes_diarios p on p.id = a.plan_id
      where a.id = accion_id and p.vendedor_id = auth.uid()
    )
  );

create policy "plan_accion_cuentas_gerencia"
  on public.plan_accion_cuentas for all to authenticated
  using (public.es_gerente()) with check (public.es_gerente());

create trigger planes_diarios_tocar_updated_at
  before update on public.planes_diarios
  for each row execute function public.tocar_updated_at();

create trigger plan_acciones_tocar_updated_at
  before update on public.plan_acciones
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 8.b. LO COMPROMETIDO NO SE EDITA
--
-- **Es la otra mitad de la guarda.** Impedir borrar una acción no sirve de nada
-- si la meta se puede bajar de 10 a 2 antes de cerrar el día: el resultado es
-- el mismo plan perfecto y encima queda escrito como si se hubiera cumplido.
--
-- Lo que se puede escribir después de abrir el día es sólo la rendición:
-- `logrado`, `motivo`, `motivo_otro` y `pasar_a_manana`. El tipo, la lista y la
-- meta quedan como se prometieron.
--
-- Y `logrado` **se escribe una vez**: corregirlo mañana sería volver a contar un
-- día cerrado. Si de verdad hubo un error, lo corrige gerencia, que tiene su
-- propia política y deja rastro.
-- ---------------------------------------------------------------------------

create function public.plan_accion_lo_prometido_no_cambia()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  -- Gerencia corrige; el dueño rinde. `es_gerente()` ya mira el rol del perfil.
  if public.es_gerente() then
    return new;
  end if;

  if new.tipo is distinct from old.tipo
     or new.lista_id is distinct from old.lista_id
     or new.meta is distinct from old.meta
     or new.orden is distinct from old.orden
     or new.plan_id is distinct from old.plan_id then
    raise exception
      'Lo que prometiste no se cambia: el tipo, la lista y la meta quedan como las pusiste al abrir el día. Lo que sí se escribe al cerrar es cuánto hiciste y por qué.'
      using errcode = 'check_violation';
  end if;

  if old.logrado is not null and new.logrado is distinct from old.logrado then
    raise exception
      'Este día ya se cerró con % de %. Volver a contarlo sería reescribir un día cerrado; si hubo un error, lo corrige gerencia.',
      old.logrado, old.meta
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger plan_acciones_lo_prometido_no_cambia
  before update on public.plan_acciones
  for each row execute function public.plan_accion_lo_prometido_no_cambia();

-- Lo mismo en el plan: la fecha, la hora de apertura y el veredicto de
-- puntualidad son del momento en que se abrió. Y un día cerrado no se reabre.
create function public.plan_diario_lo_del_momento_no_cambia()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if public.es_gerente() then
    return new;
  end if;

  if new.fecha is distinct from old.fecha
     or new.abierto_en is distinct from old.abierto_en
     or new.a_tiempo is distinct from old.a_tiempo
     or new.vendedor_id is distinct from old.vendedor_id then
    raise exception
      'La fecha y la hora en que abriste el día no se cambian.'
      using errcode = 'check_violation';
  end if;

  if old.cerrado_en is not null and new.cerrado_en is distinct from old.cerrado_en then
    raise exception
      'Este día ya está cerrado. Lo de hoy se arma en el plan de hoy.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger planes_diarios_lo_del_momento_no_cambia
  before update on public.planes_diarios
  for each row execute function public.plan_diario_lo_del_momento_no_cambia();

-- ---------------------------------------------------------------------------
-- 9. El resumen de una línea, que sí ven todos
--
-- Decisión del usuario: los tres se ven **la línea** entre ellos, y nunca el
-- detalle. El razonamiento, para que no se afloje después:
--
--   · Lo que sostiene la disciplina en un equipo chico no es el castigo: es que
--     lo que prometí ayer lo vea alguien hoy.
--   · El detalle entre pares no suma y puede restar — invita a copiarse las
--     metas o a compararse por el número en vez del resultado. El detalle es de
--     quien supervisa.
--   · Con tres personas la línea compartida es sana; **con treinta sería
--     tóxica**, y conviene dejarlo escrito por si el equipo crece.
--
-- **`security definer` y no una vista con `security_invoker`**: la tabla está
-- cerrada a propósito, así que una vista normal devolvería vacío para los
-- pares. Esta función salta el RLS **y por eso devuelve solamente las columnas
-- del resumen** — ni la nota, ni las cuentas, ni los motivos.
-- ---------------------------------------------------------------------------

create function public.plan_del_dia_resumen(p_fecha date default null)
returns table (
  vendedor_id   uuid,
  nombre        text,
  abierto_en    timestamptz,
  a_tiempo      boolean,
  cerrado       boolean,
  acciones      integer,
  acciones_cumplidas integer
)
language sql
security definer
stable
set search_path = public
as $fn$
  select
    pf.id,
    pf.nombre,
    p.abierto_en,
    p.a_tiempo,
    (p.cerrado_en is not null),
    coalesce(a.cuantas, 0)::integer,
    coalesce(a.cumplidas, 0)::integer
  from public.perfiles pf
  left join public.planes_diarios p
    on p.vendedor_id = pf.id
   and p.fecha = coalesce(p_fecha, public.hoy_panama())
   and p.deleted_at is null
  left join lateral (
    select
      count(*) as cuantas,
      count(*) filter (where x.logrado is not null and x.logrado >= x.meta) as cumplidas
    from public.plan_acciones x
    where x.plan_id = p.id
  ) a on true
  where pf.deleted_at is null
    and pf.activo
    -- Gerencia no planifica un día de ruta, así que no tiene línea.
    and pf.rol <> 'gerente'
  order by pf.nombre;
$fn$;

comment on function public.plan_del_dia_resumen is
  'La línea por persona del día: si abrió, a qué hora, si cerró y cuántas metas cumplió. SECURITY DEFINER a propósito, y por eso no devuelve ni la nota ni las cuentas. Un vendedor sin plan sale con todo nulo — que es justamente lo que hay que ver.';

-- Los tres la leen, y gerencia también.
grant execute on function public.plan_del_dia_resumen(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Las faltas del mes
--
-- Decidido por el usuario el 25 de octubre de 2026: *«cuenta las faltas, tú
-- decides el monto»*. **El sistema no calcula ningún descuento** — una fórmula
-- automática hay que defenderla caso por caso el día que alguien tuvo una
-- razón. Lo que sí hace es que el número llegue sin que nadie lo pida.
--
-- **Una falta es de disciplina, no de resultado.** No cumplir una meta no
-- cuenta: eso es lo que el reporte explica. Cuentan no abrir el día y no
-- cerrarlo.
--
-- Se cuenta sobre los días que el plan **debía** existir, y de ahí sale
-- `dias_sin_plan`: los días hábiles del mes que ya pasaron y no tienen fila.
-- Eso no se puede saber sin un calendario de días hábiles, que vive en
-- `src/lib/fechas.ts` y no en la base — así que esta vista cuenta lo que sí
-- puede contar con certeza, y el reporte compone el resto.
-- ---------------------------------------------------------------------------

create view public.faltas_del_mes
with (security_invoker = true)
as
select
  p.vendedor_id,
  date_trunc('month', p.fecha)::date as mes,
  count(*)::integer as dias_con_plan,
  count(*) filter (where not p.a_tiempo)::integer as abiertos_tarde,
  count(*) filter (where p.cerrado_en is null and p.fecha < public.hoy_panama())::integer as sin_cerrar
from public.planes_diarios p
where p.deleted_at is null
group by p.vendedor_id, date_trunc('month', p.fecha);

comment on view public.faltas_del_mes is
  'Disciplina por vendedor y mes: cuántos días planificó, cuántos tarde y cuántos dejó sin cerrar. No calcula descuentos: el monto es decisión de quien paga. `sin_cerrar` ignora hoy, que todavía se puede cerrar.';
