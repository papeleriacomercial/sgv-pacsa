-- ===========================================================================
-- El espejo necesita una llave de verdad, no una parcial
--
-- `clientes_zoho_contacto_idx` se creó como índice único **parcial**
-- —`where deleted_at is null`—, siguiendo la convención del resto del esquema.
-- Ahí tiene sentido: una cuenta borrada lógicamente no debe estorbar a la que
-- la reemplaza.
--
-- Aquí no. Este espejo **se rehace en cada pasada**: no hay borrado lógico que
-- respetar, y la sincronización necesita poder decir «esta fila ya existe,
-- actualízala». PostgREST rechaza esa operación contra un índice parcial:
--
--     42P10: there is no unique or exclusion constraint matching the
--            ON CONFLICT specification
--
-- Es la diferencia entre «único entre los vivos» y «único, punto». Para un
-- espejo, lo segundo.
-- ===========================================================================

drop index if exists public.clientes_zoho_contacto_idx;

alter table public.clientes_zoho
  add constraint clientes_zoho_contacto_unico unique (contacto_id);

comment on constraint clientes_zoho_contacto_unico on public.clientes_zoho is 'Un contacto de Books, una fila. Completa y no parcial: la sincronización la usa para reemplazar en vez de duplicar.';
