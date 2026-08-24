-- ===========================================================================
-- «Lead» sale del vocabulario. Se llama potencial.
--
-- Decisión de negocio (D-025): la aplicación se le presenta a tres vendedores
-- panameños, y §14 manda nomenclatura en español —tablas, columnas e interfaz—.
-- «Lead» era el único anglicismo que había entrado al esquema, y encima al
-- lugar más visible: la apuesta que el vendedor escribe cada viernes.
--
-- Se renombra la columna en vez de dejarla y traducir solo la pantalla. Una
-- columna que se llama distinto de lo que dice la interfaz obliga a traducir
-- mentalmente cada vez que se lee una consulta, y esa traducción se equivoca.
-- ===========================================================================

alter table public.cierres rename column apuesta_leads to apuesta_potenciales;

alter table public.cierres
  rename constraint cierres_apuesta_razonable to cierres_apuesta_razonable_vieja;

alter table public.cierres
  drop constraint cierres_apuesta_razonable_vieja;

alter table public.cierres
  add constraint cierres_apuesta_razonable check (
    (apuesta_potenciales is null or apuesta_potenciales between 0 and 500) and
    (apuesta_clientes is null or apuesta_clientes between 0 and 500)
  );

comment on column public.cierres.apuesta_potenciales is 'Cuántos potenciales se compromete a tocar la semana entrante. La apuesta es del vendedor.';

-- El disparador nombra la columna, así que se rehace con el nombre nuevo.
create or replace function public.cierre_solo_el_dueno_edita_su_plan()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.vendedor_id = auth.uid() then
    return new;
  end if;

  -- Cualquier otro —el líder— solo puede dejar su respuesta.
  if new.numeros is distinct from old.numeros
     or new.sorprendio is distinct from old.sorprendio
     or new.freno is distinct from old.freno
     or new.necesito is distinct from old.necesito
     or new.plan is distinct from old.plan
     or new.apuesta_potenciales is distinct from old.apuesta_potenciales
     or new.apuesta_clientes is distinct from old.apuesta_clientes
     or new.semana is distinct from old.semana
     or new.vendedor_id is distinct from old.vendedor_id then
    raise exception
      'El plan es del vendedor. Puedes responder y agregar objetivos, no reescribirlo.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

-- Los comentarios de `listas` también decían «leads».
comment on table public.listas is 'Paquetes de potenciales por zona o por objetivo. Es donde se caza; la agenda es lo que se debe.';
