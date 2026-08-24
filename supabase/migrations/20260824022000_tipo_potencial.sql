-- ===========================================================================
-- La cuenta que nadie ha tocado se llama «potencial»
--
-- Cierra el cambio de vocabulario de D-025. `sin_clasificar` describía el
-- estado desde dentro del sistema —«todavía no le pusimos etiqueta»— y la
-- interfaz lo repetía tal cual. Visto desde la calle es otra cosa: es un
-- comercio que puede comprarnos y al que nadie ha ido. Eso es un potencial.
--
-- La escalera queda legible de un vistazo, y en el orden en que ocurre:
--
--     potencial → prospecto → cliente
--                          ↘ descartada
--
-- Se renombra el valor del enum y no solo la etiqueta de la pantalla: §14 pide
-- que el esquema hable el mismo idioma que la interfaz, y una consulta que
-- dice `sin_clasificar` mientras la app dice «Potencial» obliga a traducir
-- mentalmente cada vez.
--
-- `alter type ... rename value` es seguro aquí: se comprobó que ninguna vista
-- ni política guarda el literal en su definición. El valor por omisión de
-- `cuentas.tipo` sobrevive porque apunta al valor del enum, no a su texto.
-- ===========================================================================

alter type public.tipo_cuenta rename value 'sin_clasificar' to 'potencial';

comment on column public.cuentas.tipo is 'Potencial hasta el primer contacto; luego prospecto, cliente o descartada.';
