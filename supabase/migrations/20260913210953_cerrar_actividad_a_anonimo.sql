-- La llave anónima no tiene por qué poder llamar un reporte de gerencia.
--
-- **`revoke all from public` no alcanza, y ahí está la trampa.** Supabase trae
-- `alter default privileges` que concede `execute` a `anon`, `authenticated` y `service_role` en
-- toda función nueva del esquema `public`. Ese permiso queda **otorgado explícitamente a `anon`**,
-- no heredado de `public`, así que revocarle a `public` lo deja intacto — y el `grant` a
-- `authenticated` que uno escribe al lado es redundante y da la falsa impresión de haber elegido
-- quién entra.
--
-- Se vio al comprobar la migración de `cuentas_con_actividad`: `has_function_privilege('anon', …)`
-- daba verdadero justo después de haberla revocado de `public`.
--
-- **No había fuga.** La función se cierra por dentro —`es_gerente()` o ser el dueño o su líder—,
-- así que a un anónimo le devuelve cero filas. Pero la llave anónima viaja en el navegador de
-- cualquiera, y un permiso que no hace falta es superficie que no hay que dejar abierta. La
-- defensa de adentro se queda igual: son dos capas, no una en vez de la otra.

revoke all on function public.cuentas_con_actividad(date, date) from anon;

-- El mismo caso, y por la misma razón: es un reporte de gerencia. Ésta sí levanta excepción con un
-- anónimo en vez de devolver vacío, pero el permiso sobra igual.
revoke all on function public.actividad_por_vendedor(date) from anon;
