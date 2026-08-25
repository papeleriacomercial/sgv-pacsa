-- ===========================================================================
-- Una cuenta puede venir de Badger Maps
--
-- Badger fue la aplicación de campo de los vendedores antes del SGV, y lo que
-- guardaron ahí es lo único que existe de su trabajo de calle: **dónde queda
-- cada local y a quién le han estado tocando la puerta**.
--
-- Zoho sabe quién compró; Badger sabe dónde está y a quién se visitó sin que
-- comprara todavía. Los prospectos que traen no aparecen en ninguna factura,
-- por definición: si no compraron, no existen para la contabilidad.
--
-- Guardarlos como `otro` sería perder de dónde salieron el día que alguien
-- pregunte por qué esa cuenta tiene coordenadas y nadie recuerda haberlas
-- puesto.
-- ===========================================================================

alter type public.origen_prospecto add value 'badger' after 'facturacion';

comment on type public.origen_prospecto is 'De dónde salió la cuenta. Objetivo: la escribió el líder. Facturación: llegó de Zoho Books porque ya compraba. Badger: venía de la aplicación de campo anterior.';
