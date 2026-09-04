-- El plan se traba cuando alguien lo lee, no cuando pasa un día — §7.1, el contrato semanal.
--
-- Lo decidió el usuario el 4 de septiembre de 2026, después de descartar la ventana por fecha que
-- yo había propuesto: *«me parece que sería mejor que estar manejando días calendarios sin saber en
-- qué momento se leen los planes»*.
--
-- **LA REGLA.** El vendedor puede corregir su cierre —el plan incluido— mientras nadie lo haya
-- revisado. Quien lo revisa lo marca como visto, y ahí queda como está. Al vendedor lo revisa su
-- líder; al líder, gerencia: *«yo abro el plan del líder, lo veo. Si tengo algún comentario, lo
-- llamo para que corrija. Si no, me das una opción de responderle y, al mismo tiempo, de un campo
-- que marque como cerrado»*.
--
-- Y ahí está lo bueno de la regla: **responder y marcar como visto son dos gestos distintos**. El
-- que tiene una observación responde y no marca, y con eso deja el plan abierto para que el otro lo
-- arregle. El que no tiene nada que decir marca, y lo congela. La observación no necesita un botón
-- de «reabrir»: no marcar *es* dejarlo abierto.
--
-- **SE LLAMA «VISTO» Y NO «APROBADO», Y NO ES UN DETALLE DE PALABRAS.** Este módulo existe sobre una
-- idea: *«si el plan se puede editar desde arriba, deja de ser su plan, y el vendedor aprende a
-- proponer lo que va a ser aprobado. Ahí se acabó la información»*. Un plan flojo con su nombre
-- encima dice cómo piensa quien trabaja solo; uno aprobado no dice nada. **«Aprobado» reintroduce
-- por la etiqueta exactamente lo que el trigger impide por el dato.** «Visto» traba el plan igual y
-- no le enseña a nadie a escribir para complacer.

alter table public.cierres
  add column if not exists visto_en  timestamptz,
  add column if not exists visto_por uuid references public.perfiles (id);

comment on column public.cierres.visto_en is
  'Cuándo lo revisó quien lo tenía que revisar. Mientras esté nulo, el dueño puede seguir corrigiendo su cierre; una vez puesto, queda como está. No marcar es lo que deja el plan abierto para que el vendedor atienda una observación.';

comment on column public.cierres.visto_por is
  'Quién lo marcó. El líder para un vendedor, gerencia para el líder. Nunca el dueño: revisarse a uno mismo no revisa nada.';

-- ===========================================================================
-- El líder cuestiona, no reescribe — ahora también decide cuándo se traba
-- ===========================================================================
--
-- Tres caminos, y cada uno con lo suyo:
--
--   · **El dueño** puede con su contenido mientras nadie lo haya visto, y **nunca** puede marcarse
--     a sí mismo. Ponerse el visto propio sería trabarse el plan para que no se lo revisen, o —peor
--     al revés— quitárselo para reescribirlo después de que le dijeron algo.
--   · **Gerencia** puede con todo, como antes.
--   · **El líder** sólo puede dejar su respuesta y poner el visto. Sigue sin poder tocar una cifra.
create or replace function public.cierre_solo_el_dueno_edita_su_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Lo que es del vendedor. Se calcula una vez y se usa en los dos caminos que la miran, para que
  -- no puedan discrepar: dos listas de campos escritas aparte se separan a la tercera columna nueva.
  cambio_el_contenido boolean :=
       new.numeros             is distinct from old.numeros
    or new.sorprendio          is distinct from old.sorprendio
    or new.freno               is distinct from old.freno
    or new.necesito            is distinct from old.necesito
    or new.plan                is distinct from old.plan
    or new.apuesta_potenciales is distinct from old.apuesta_potenciales
    or new.apuesta_clientes    is distinct from old.apuesta_clientes
    or new.semana              is distinct from old.semana
    or new.vendedor_id         is distinct from old.vendedor_id;
begin
  if new.vendedor_id = auth.uid() then
    if new.visto_en is distinct from old.visto_en then
      raise exception
        'Marcar como visto le toca a quien lo revisa, no a quien lo escribió.'
        using errcode = 'check_violation';
    end if;

    if old.visto_en is not null and cambio_el_contenido then
      raise exception
        'Tu líder ya revisó esta semana. Lo que sigue va en el cierre de la próxima.'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- Gerencia puede con todo. Es quien revisa al líder, y quien arregla lo que haya que arreglar.
  if public.es_gerente() then
    return new;
  end if;

  if cambio_el_contenido then
    raise exception
      'El plan es del vendedor. Puedes responder y marcarlo como visto, no reescribirlo.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.cierre_solo_el_dueno_edita_su_plan is
  'El líder cuestiona, no reescribe: puede responder y marcar como visto, nunca tocar una cifra. Y el dueño corrige lo suyo sólo mientras nadie lo haya visto — ni se pone ni se quita el visto él mismo.';
