-- ===========================================================================
-- La auditoría también sirve para lo que no es una fila con identificador
--
-- `auditoria.registro_id` se creó obligatorio, dando por hecho que todo lo
-- auditable es una fila con un uuid. Pero hay dos cosas que se auditan y no lo
-- son: **el tope de cotización** —una fila de `parametros`, con clave de
-- texto— y **los datos de la casa** —una tabla de una sola fila—.
--
-- Los dos son justo lo que §16 manda auditar: umbrales y lo que sale en el
-- papel que ve el cliente. Que la columna sea obligatoria no protege nada aquí;
-- solo impide anotar los cambios que más importan.
--
-- El `campo` ya dice de qué se habla —«cotizacion_tope», «ruc»— así que no se
-- pierde información.
-- ===========================================================================

alter table public.auditoria alter column registro_id drop not null;

comment on column public.auditoria.registro_id is 'La fila afectada, cuando la hay. Nulo en lo que no es fila con uuid: umbrales y datos de la casa, que se identifican por el campo.';
