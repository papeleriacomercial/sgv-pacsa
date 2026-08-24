-- ===========================================================================
-- El puntaje de §7.5 deja de llamarse «potencial»
--
-- Efecto secundario de D-025: «potencial» pasó a ser el nombre de una cuenta
-- que nadie ha tocado todavía, así que ya no puede seguir nombrando también al
-- puntaje 1–5 que §7.5 calculará desde la facturación de Zoho.
--
-- Se queda con **puntaje** a secas. Dos cosas distintas con el mismo nombre en
-- el mismo sistema garantizan que alguien las confunda —y esa confusión no
-- aparecería hasta que el puntaje exista, cuando ya sería cara de deshacer—.
-- ===========================================================================

comment on column public.cuentas.volumen is 'Volumen estimado por el vendedor. No confundir con el puntaje calculado de §7.5, que vendrá de la facturación.';
