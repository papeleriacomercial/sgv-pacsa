-- El teléfono del vendedor, para los documentos que salen a manos del cliente.
--
-- Lo pidió el usuario el 2 de septiembre de 2026, para el Comparador de Rendimiento (§7.10): la hoja
-- que el cliente se lleva no decía de qué empresa venía ni quién se la entregó. «Sería bueno dejar
-- esto como si fuera una tarjeta de presentación... según el vendedor que está logueado, colocar ahí
-- vendedor y su número de contacto.»
--
-- El nombre de la empresa y sus datos ya viven en `public.empresa`. Del vendedor existía el nombre
-- en `public.perfiles`; **el teléfono no existía en ninguna parte**, y sin él la hoja no puede
-- cerrar el circuito: el jefe que aprueba la compra lee la impresión y tiene que poder llamar.
--
-- NO HACE FALTA POLÍTICA NUEVA. `perfiles_update_propio` ya deja a cada usuario actualizar su propio
-- perfil mientras no se cambie a sí mismo el rol ni el líder, así que el vendedor puede escribir su
-- teléfono y nadie puede escribir el de otro. Se deja dicho acá porque la ausencia de una política
-- nueva en una migración que agrega una columna se lee como olvido, y no lo es.

alter table public.perfiles
  add column if not exists telefono text;

comment on column public.perfiles.telefono is
  'Teléfono de contacto del vendedor. Sale impreso en los documentos que recibe el cliente '
  '(Comparador de Rendimiento, §7.10). Lo escribe el propio vendedor; nulo mientras no lo cargue.';
