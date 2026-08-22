-- Etapa 4 del plan v2: qué acción exige cada compromiso.
-- Ver docs/08-plan-v2.md.
--
-- Hasta ahora el compromiso guardaba qué hacer en texto libre y cuándo. Con
-- eso no se puede armar la pantalla que pide el negocio: "las llamadas de
-- hoy", "las visitas vencidas". El tipo de acción tiene que ser un dato, no
-- una frase.

alter table public.compromisos
  add column tipo_accion public.tipo_interaccion not null default 'visita';

comment on column public.compromisos.tipo_accion is 'Qué hay que hacer: visita, llamada, WhatsApp, correo o entrega de muestra.';

-- El índice de la agenda pasa a incluir la acción: la pantalla filtra casi
-- siempre por tipo y ventana de tiempo a la vez.
drop index if exists compromisos_pendientes_idx;

create index compromisos_pendientes_idx
  on public.compromisos (vendedor_id, fecha_compromiso, tipo_accion)
  where cumplido_en is null and deleted_at is null;
