-- ===========================================================================
-- Corregir antes de mandar, anular después
--
-- El vendedor genera la cotización, la abre para revisarla —que es justo lo
-- que le pedimos que haga— y ve que se equivocó de precio. Hasta ahora no
-- tenía salida: el documento ya estaba emitido y lo único posible era hacer
-- otro y dejar el malo ahí para siempre.
--
-- Son dos situaciones distintas y merecen respuestas distintas:
--
--   * **Todavía no salió de la casa.** Nadie lo ha visto más que él. Se
--     corrige y ya: no hay nada que explicar porque no pasó nada.
--   * **Ya se mandó.** Ahí sí hay un papel circulando con un precio que no
--     era. Se anula, queda anulado a la vista, y se emite otro. Borrarlo
--     sería fingir que nunca existió, y el cliente tiene el correo.
-- ===========================================================================

-- La restricción daba por hecho que solo lo emitido lleva sello, y por eso
-- anular obligaba a borrar la fecha de emisión — o sea, a perder cuándo salió.
-- Lo que hace falta es lo contrario: **el sello no se quita nunca**, y anular
-- solo cambia el estado.
alter table public.cotizaciones
  drop constraint cotizaciones_emitida_con_sello;

alter table public.cotizaciones
  add constraint cotizaciones_emitida_con_sello
    check (estado <> 'emitida' or emitida_en is not null);

alter table public.cotizaciones
  add column anulada_en timestamptz,
  add column motivo_anulacion text;

comment on column public.cotizaciones.anulada_en is 'Cuándo se anuló. La fecha de emisión se conserva: importa cuándo salió, aunque después se anulara.';
comment on column public.cotizaciones.motivo_anulacion is 'Por qué. Sin motivo no se puede anular: una cotización anulada sin explicación no le sirve a nadie que la mire después.';

alter table public.cotizaciones
  add constraint cotizaciones_anulada_con_motivo
    check (
      (estado = 'anulada') = (anulada_en is not null)
      and (anulada_en is null or length(trim(coalesce(motivo_anulacion, ''))) > 0)
    );

-- El tope solo se comprueba al emitir; una anulada ya no promete nada.
create or replace function public.cotizacion_respeta_el_tope()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  tope numeric := coalesce(public.parametro('cotizacion_tope'), 0);
  rol public.rol_usuario;
begin
  if new.estado <> 'emitida' then
    return new;
  end if;

  select p.rol into rol from public.perfiles p where p.id = auth.uid();

  -- Gerencia no tiene tope: es quien decide los precios.
  if rol = 'gerente' then
    return new;
  end if;

  if new.total > tope then
    raise exception
      'Esta cotización suma % y el tope para cotizar directo es %. Pídesela a la oficina desde Solicitudes.',
      to_char(new.total, 'FM999,999.00'), to_char(tope, 'FM999,999.00')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Lo emitido no se toca
--
-- Corregir un borrador es normal. Corregir algo que ya salió de la casa no:
-- el cliente tiene una copia, y que las dos digan cosas distintas es peor que
-- el error original. Para eso está anular.
-- ---------------------------------------------------------------------------

create function public.cotizacion_emitida_no_se_edita()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if old.estado <> 'emitida' then
    return new;
  end if;

  -- Anular sí se puede. Borrarla lógicamente, también.
  if new.estado in ('anulada')
     or new.deleted_at is distinct from old.deleted_at then
    return new;
  end if;

  if new.total is distinct from old.total
     or new.subtotal is distinct from old.subtotal
     or new.con_itbms is distinct from old.con_itbms
     or new.condicion_pago is distinct from old.condicion_pago
     or new.cuenta_id is distinct from old.cuenta_id then
    raise exception
      'Esta cotización ya se emitió. Si el precio estaba mal, anúlala y haz una nueva: el cliente tiene una copia de la anterior.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger cotizaciones_emitidas_no_se_editan
  before update on public.cotizaciones
  for each row execute function public.cotizacion_emitida_no_se_edita();

-- Y sus renglones tampoco.
create function public.renglon_de_emitida_no_se_toca()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  estado public.estado_cotizacion;
begin
  select c.estado into estado
  from public.cotizaciones c
  where c.id = coalesce(new.cotizacion_id, old.cotizacion_id);

  if estado = 'emitida' then
    raise exception
      'No se pueden cambiar los renglones de una cotización emitida. Anúlala y haz una nueva.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$fn$;

create trigger renglones_de_emitida_no_se_tocan
  before insert or update or delete on public.renglones_cotizacion
  for each row execute function public.renglon_de_emitida_no_se_toca();
