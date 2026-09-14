-- Fuera las dos cotizaciones con que se probó el correo a la oficina.
--
-- **Las emitió el usuario el 14 de septiembre de 2026 probando el envío por Gmail**, sobre la
-- cuenta «mini centro gloria». Son documentos reales —con número, PDF y solicitud— porque no hay
-- ambiente de pruebas: la previsualización escribe en esta misma base (ver la nota del ambiente en
-- `07-estado.md`). Pidió quitarlas para no dejarle esa basura al vendedor en su expediente.
--
--   COT-260914-6EF6   $16.05
--   COT-260914-8EA2   $19.26
--
-- **Borrado lógico, no físico**, como manda §16: se les pone `deleted_at` y desaparecen de todas
-- las pantallas —cada consulta filtra por eso— pero siguen ahí si algún día resulta que una no era
-- de prueba. Cuesta lo mismo y no se puede deshacer al revés.
--
-- **Se borran también sus dos solicitudes**, que son las que le avisaron a la oficina. Sin eso la
-- cotización desaparecería del expediente y el encargo se quedaría en el registro del vendedor,
-- apuntando a un documento que ya no existe.
--
-- **Los dos PDF se borran de Storage**, a pedido del usuario, y eso **sí es definitivo**: no hay
-- borrado lógico en el almacenamiento. Si alguna vez se recuperara una de estas cotizaciones
-- quitándole el `deleted_at`, el documento no estaría — quedaría el registro sin su papel.
--
-- Se aceptó a sabiendas: son pruebas, y además el enlace firmado de un año viajó en un correo que
-- está en la bandeja de la oficina; dejar el archivo vivo significaría que ese enlace sigue
-- abriendo un documento que ya no debería existir.
--
-- Se borran con `scripts/borrar-pdf.mjs`, no desde aquí: una migración no puede tocar Storage.
--
-- Se identifican **por código y no por identificador**, que se lee y se comprueba; y acotado a esa
-- cuenta, para que esta migración no pueda tocar nada más aunque un código se repitiera.

update public.cotizaciones c
   set deleted_at = now()
  from public.cuentas cu
 where cu.id = c.cuenta_id
   and cu.nombre ilike 'mini centro gloria'
   and c.codigo in ('COT-260914-6EF6', 'COT-260914-8EA2')
   and c.deleted_at is null;

update public.solicitudes s
   set deleted_at = now()
  from public.cotizaciones c
  join public.cuentas cu on cu.id = c.cuenta_id
 where s.documento_id = c.id
   and cu.nombre ilike 'mini centro gloria'
   and c.codigo in ('COT-260914-6EF6', 'COT-260914-8EA2')
   and s.deleted_at is null;
