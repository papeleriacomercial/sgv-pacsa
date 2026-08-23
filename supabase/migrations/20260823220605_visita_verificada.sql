-- Visita verificada: la única cifra difícil de inflar de todo el sistema.
--
-- El vendedor puede registrar quince seguimientos desde el sofá un martes de
-- lluvia. No es pensar mal: la puerta existe y hay que cerrarla.
--
-- La regla se escribe al revés a propósito — **una sola forma de aprobar, tres
-- de no aprobar**— porque si solo se marcara "lejos del local", apagar la
-- ubicación sería la salida fácil y el control quedaría decorativo:
--
--   verificada = es visita + hay check-in + la lectura es buena + está cerca
--
-- Y no se bloquea nada. Bloquear el registro tardío enseña a no registrar, que
-- es mucho peor que registrar tarde. Se marca, se cuenta y se ve.
--
-- Ver docs/12-flujo-vendedor.html.

-- ===========================================================================
-- 1. Los umbrales, en un solo lugar
--
-- Provisionales, como todo lo que se fija sin datos: doscientos metros es un
-- punto de partida razonable para el interior, pero en una plaza comercial
-- puede quedar corto. Se revisan con las primeras semanas de uso.
-- ===========================================================================

create function public.metros_para_verificar()
returns numeric language sql immutable as $$ select 200::numeric $$;

create function public.precision_para_verificar()
returns numeric language sql immutable as $$ select 150::numeric $$;

comment on function public.metros_para_verificar is 'Qué tan cerca del local cuenta como estar ahí. Provisional: se afina con datos reales.';

-- ===========================================================================
-- 2. La distancia entre el check-in y el local
--
-- Haversine sin PostGIS, igual que en la validación de duplicados: a esta
-- escala la diferencia es nula y evita depender de una extensión que habría
-- que mantener.
-- ===========================================================================

create function public.distancia_m(
  lat_a numeric, lng_a numeric, lat_b numeric, lng_b numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when lat_a is null or lng_a is null or lat_b is null or lng_b is null then null
    else round((6371000 * 2 * asin(sqrt(
      power(sin(radians(lat_b - lat_a) / 2), 2) +
      cos(radians(lat_a)) * cos(radians(lat_b)) *
      power(sin(radians(lng_b - lng_a) / 2), 2)
    )))::numeric, 0)
  end;
$$;

-- ===========================================================================
-- 3. El seguimiento con su veredicto
-- ===========================================================================

create view public.seguimientos_resumen
with (security_invoker = true)
as
select
  s.*,
  public.distancia_m(s.checkin_lat, s.checkin_lng, c.lat, c.lng) as metros_del_local,

  -- Una sola forma de aprobar.
  (
    s.tipo = 'visita'
    and s.sin_gps = false
    and s.checkin_lat is not null
    and s.checkin_precision_m is not null
    and s.checkin_precision_m <= public.precision_para_verificar()
    and public.distancia_m(s.checkin_lat, s.checkin_lng, c.lat, c.lng)
        <= public.metros_para_verificar()
  ) as verificada,

  -- Registrada lejos del local. No es una falta: es un hábito, y es una
  -- conversación de veinte segundos. Muchas veces la explicación es legítima
  -- —registró todo al final del día en el carro— y eso también es información.
  (
    s.tipo = 'visita'
    and s.sin_gps = false
    and s.checkin_lat is not null
    and c.lat is not null
    and public.distancia_m(s.checkin_lat, s.checkin_lng, c.lat, c.lng)
        > public.metros_para_verificar()
  ) as fuera_del_local,

  c.nombre as cuenta_nombre,
  c.tipo   as cuenta_tipo
from public.seguimientos s
join public.cuentas c on c.id = s.cuenta_id
where s.deleted_at is null;

comment on view public.seguimientos_resumen is 'Seguimientos con el veredicto de visita verificada. Hereda el RLS por security_invoker.';
