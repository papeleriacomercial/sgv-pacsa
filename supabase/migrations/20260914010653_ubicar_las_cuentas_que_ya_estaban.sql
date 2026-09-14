-- Las cuentas que ya existían también tienen dónde están.
--
-- El disparador ubica lo que nace o se mueve, pero las 552 cuentas que ya tenían punto marcado
-- nunca van a pasar por él. Se ubican aquí, de una vez.
--
-- **No se toca `poblado`.** Se queda como estaba, y a propósito: es lo que el vendedor escribió a
-- mano y todavía no se ha decidido si se borra. Las tres columnas nuevas no lo reemplazan por
-- ahora — conviven, y eso permite comparar. Cuando la pantalla ya no lo muestre y nadie lo eche
-- de menos, se borra en su propia migración.
--
-- **Las 207 sin coordenadas quedan sin ubicación, y eso es correcto.** Un campo vacío es honesto:
-- dice «marca el punto». Rellenarlo con el poblado escrito sería sembrar de nuevo lo que este
-- trabajo vino a arrancar — «CALIDONIA Y CENTARL» volvería a entrar, esta vez como corregimiento.

-- Se cruza directo contra los polígonos en vez de llamar a `ubicar_punto` por fila. Con `lateral`
-- no se puede —un `update ... from lateral` no alcanza la tabla que está actualizando— y con tres
-- subconsultas se recorrería el índice tres veces por cuenta. Así es una sola pasada.
update public.cuentas c
   set provincia     = k.provincia,
       distrito      = k.distrito,
       corregimiento = k.corregimiento
  from public.corregimientos k
 where c.deleted_at is null
   and c.lat is not null
   and c.lng is not null
   and extensions.ST_Contains(
         k.geom,
         extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::float8, c.lat::float8), 4326)
       );
