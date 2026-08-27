-- ===========================================================================
-- Borrar el error, no el juicio
--
-- Hasta hoy no había forma de deshacer nada. La cuenta escogida por equivocación
-- se quedaba en la lista para siempre, ensuciando el conteo de «sin tocar» que
-- alimenta el compromiso de la semana.
--
-- **La palabra «borrar» tapa tres necesidades distintas**, y solo una de ellas
-- es borrar:
--
--   «Este punto no va en mi ruta»  → se quita de la lista. No toca la cuenta.
--   «Fui y no sirve»               → se descarta con motivo. Ya existía (D-010),
--                                     y es mejor que borrar: evita que otro
--                                     repita el viaje.
--   «Me equivoqué al crearlo»      → esto sí se borra.
--
-- --------------------------------------------------------------------------
-- Qué cuenta como error
-- --------------------------------------------------------------------------
--
-- Dos cosas a la vez: **nadie la tocó** y **la creó quien la está borrando**.
--
-- La primera sola no alcanza. De las 521 cuentas de la cartera, 286 no tienen
-- ninguna historia —221 son prospectos que trajo Badger y nadie ha visitado
-- todavía—. Una regla de «se borra lo que no tiene historia» no sería una
-- escapatoria para errores: dejaría borrar media cartera.
--
-- La segunda es la que distingue el error del juicio. Si alguien la evaluó, eso
-- pasó, y lo que corresponde es descartarla con motivo.
--
-- **Gerencia queda exenta** porque tiene que poder limpiar lo que sea; pero
-- tampoco borra de verdad: `deleted_at` es marca, no destrucción (§16).
-- ===========================================================================

create function public.cuenta_es_un_error(p_cuenta uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    c.created_by = auth.uid()
    and c.tipo in ('potencial', 'prospecto')
    and not exists (select 1 from public.seguimientos s
                    where s.cuenta_id = c.id and s.deleted_at is null)
    and not exists (select 1 from public.oportunidades o
                    where o.cuenta_id = c.id and o.deleted_at is null)
    and not exists (select 1 from public.cotizaciones q
                    where q.cuenta_id = c.id and q.deleted_at is null)
    and not exists (select 1 from public.solicitudes r
                    where r.cuenta_id = c.id and r.deleted_at is null)
    and not exists (select 1 from public.transacciones_zoho t
                    where t.cuenta_id = c.id and t.deleted_at is null)
  from public.cuentas c
  where c.id = p_cuenta;
$fn$;

comment on function public.cuenta_es_un_error is 'Si una cuenta se puede borrar: la creó quien pregunta, es potencial o prospecto, y nadie la tocó. Lo demás se descarta con motivo, no se borra.';

grant execute on function public.cuenta_es_un_error(uuid) to authenticated;

create function public.cuenta_solo_se_borra_si_es_un_error()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  -- Solo interesa el momento en que se marca como borrada.
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  if public.es_gerente() then
    return new;
  end if;

  if not public.cuenta_es_un_error(new.id) then
    raise exception
      'Esta cuenta ya tiene historia o no la creaste tú. Si fuiste y no sirve, descártala con su motivo: así queda dicho y nadie repite el viaje.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger cuentas_borrado_solo_por_error
  before update on public.cuentas
  for each row execute function public.cuenta_solo_se_borra_si_es_un_error();

-- ---------------------------------------------------------------------------
-- Las listas: archivar es lo normal, borrar es para la vacía
--
-- Una lista con puntos adentro representa trabajo de planificación. Borrarla
-- deja a esos puntos sin ruta y a nadie le avisa. **Archivar ya existía en el
-- esquema desde el primer día** —`archivada`— y nunca tuvo pantalla.
--
-- Borrar se reserva para la que se creó con un dedazo en el nombre y no llegó a
-- tener nada dentro. Ahí no hay nada que archivar.
-- ---------------------------------------------------------------------------

create function public.lista_solo_se_borra_vacia()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.listas_cuentas lc
    join public.cuentas c on c.id = lc.cuenta_id and c.deleted_at is null
    where lc.lista_id = new.id
  ) then
    raise exception
      'La lista tiene puntos adentro. Archívala: se guarda con todo lo que trabajaste y deja de estorbar.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger listas_borrado_solo_vacias
  before update on public.listas
  for each row execute function public.lista_solo_se_borra_vacia();
