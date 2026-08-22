-- Falta un motivo de descarte: "no le interesó".
--
-- `motivo_descarte` nació para los puntos de Google que nunca llegaron a ser
-- cuenta, y ahí los cinco valores alcanzaban: no existe, muy pequeño, no usa
-- nuestros productos, ya lo atiende la casa, otro.
--
-- Ahora el mismo enum califica una cuenta que sí se visitó y no prosperó, y el
-- caso más común de esa visita —el encargado escuchó y no le interesó— no tiene
-- dónde caer. Sin este valor todo termina en "otro", y en seis meses el reporte
-- de por qué se pierden los prospectos no dice nada.

alter type public.motivo_descarte add value 'sin_interes' after 'no_usa_productos';
