-- Reprogramar un compromiso deja rastro.
--
-- El vendedor tiene que poder mover a otro día lo que hoy no va a alcanzar: es
-- más honesto que dejarlo pudrirse como vencido, y si no puede moverlo aprende
-- a ignorar la agenda entera.
--
-- Pero si reprogramar fuera gratis, todo se empujaría para siempre y
-- **"vencido" dejaría de significar algo**. Por eso se cuenta.
--
-- Uno movido cuatro veces no es una falta del vendedor: es una señal de que o
-- la cuenta no es real, o el plan no lo era. Es información para quien lo
-- acompaña, no un castigo.

alter table public.compromisos
  add column veces_movido smallint not null default 0;

comment on column public.compromisos.veces_movido is 'Cuántas veces se empujó la fecha. Tres está bien; a la cuarta hay que preguntar si la cuenta sigue viva.';

-- ===========================================================================
-- Se cuenta solo
--
-- En un trigger y no en la pantalla: contar desde el cliente deja la puerta
-- abierta a moverlo por otro camino y que el contador no se entere. Y aquí no
-- hay nada que el vendedor tenga que acordarse de hacer.
-- ===========================================================================

create function public.contar_reprogramacion()
returns trigger
language plpgsql
as $$
begin
  -- Solo cuenta si de verdad se movió la fecha. Editar la descripción o
  -- marcarlo cumplido no es reprogramar.
  if new.fecha_compromiso is distinct from old.fecha_compromiso
     and new.cumplido_en is null then
    new.veces_movido := old.veces_movido + 1;
  end if;
  return new;
end;
$$;

create trigger compromisos_cuenta_reprogramacion
  before update on public.compromisos
  for each row execute function public.contar_reprogramacion();

comment on function public.contar_reprogramacion is 'Cuenta los empujones de fecha. En trigger para que no dependa de que la pantalla se acuerde.';
