-- ===========================================================================
-- Una cuenta puede venir de la facturación
--
-- Los 178 clientes de calle que entran desde Books no vinieron de la calle, ni
-- de una búsqueda, ni de un referido: **ya eran clientes**, con un año de
-- facturas encima, y el SGV simplemente no los conocía. Guardarlos como
-- `otro` sería perder de dónde salieron el día que haya que auditarlo.
--
-- Se aprovecha para que `created_by` admita nulo. La pasada de noche escribe
-- con el rol de servicio, donde `auth.uid()` es nulo — y hasta ahora la
-- columna lo exigía. Lo honesto es que quede vacío: no lo creó una persona.
-- ===========================================================================

alter type public.origen_prospecto add value 'facturacion' after 'objetivo';

comment on type public.origen_prospecto is 'De dónde salió la cuenta. Objetivo: la escribió el líder. Facturación: llegó desde Zoho Books porque ya compraba.';

alter table public.cuentas alter column created_by drop not null;

comment on column public.cuentas.created_by is 'Quién la creó. Nulo cuando la trajo la sincronización con Books: no la creó una persona.';
