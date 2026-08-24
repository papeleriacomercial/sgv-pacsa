-- ===========================================================================
-- Un objetivo no se busca en el mapa: se escribe
--
-- Armar una lista de objetivos mandaba a la búsqueda de Google, que es la
-- herramienta del vendedor de calle. El líder escribió «Banco General» y la
-- aplicación le devolvió las sucursales — cuando lo que él quiere no es una
-- sucursal, es **llegar a alguien en la oficina central**.
--
-- La diferencia no es de pantalla, es de oficio:
--
-- | | Vendedor de ruta | Líder con un objetivo |
-- |---|---|---|
-- | Cómo lo encuentra | Está en la calle, se ve | Ya sabe el nombre; le falta con quién hablar |
-- | Qué le falta al empezar | Nada: va y toca | Contacto, teléfono, correo, dirección |
-- | Qué hace antes de la primera visita | Nada | **Investigar** |
--
-- Por eso un objetivo nace con lo poco que se sepa —a veces solo el nombre— y
-- la lista se vuelve la libreta de lo que falta averiguar.
-- ===========================================================================

-- Cómo entró la cuenta. Ninguno de los valores existentes servía: no vino de
-- la calle, ni de la búsqueda, ni de un referido — la escribió el líder porque
-- decidió ir por ella.
alter type public.origen_prospecto add value 'objetivo' after 'busqueda';

comment on type public.origen_prospecto is 'De dónde salió la cuenta. Objetivo: la escribió el líder porque decidió ir por ella, no porque se la encontrara.';
