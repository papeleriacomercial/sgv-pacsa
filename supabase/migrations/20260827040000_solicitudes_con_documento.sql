-- ===========================================================================
-- La solicitud trae su documento
--
-- **Cuarta vez que un `select s.*` congela la lista de columnas.** La columna
-- `documento_id` se agregó a `solicitudes` en la migración anterior y la vista
-- siguió sin verla, así que la bandeja no podía abrir el PDF que Verónica
-- necesita imprimir. Se rehace entera, como manda la regla.
--
-- De paso se retira `bandeja_oficina`, creada hace media hora para esto mismo.
-- Dos vistas que contestan la misma pregunta se desincronizan: una gana una
-- columna, la otra no, y a los tres meses la pantalla del vendedor y la de la
-- oficina dicen cosas distintas del mismo encargo.
-- ===========================================================================

drop view if exists public.bandeja_oficina;
drop view if exists public.solicitudes_resumen;

create view public.solicitudes_resumen
with (security_invoker = true)
as
select
  s.*,
  case
    when s.resuelta_en is null then
      extract(epoch from (now() - s.created_at)) / 3600
    else
      extract(epoch from (s.resuelta_en - s.created_at)) / 3600
  end as horas,
  -- Vencida es lo pendiente que ya pasó de un día. Aproximación deliberada:
  -- contar solo horas hábiles exige un calendario de feriados que hoy no
  -- existe, y para la conversación que esto habilita alcanza.
  (s.estado = 'pendiente' and s.created_at < now() - interval '24 hours')
    as vencida,

  -- Quién lo pidió. Verónica atiende a tres personas y tiene que saber a quién
  -- contestarle sin abrir otra pantalla.
  v.nombre as vendedor,

  -- El documento, cuando lo hay. **Es lo que convierte la bandeja en algo que
  -- se puede atender**: sin el PDF, «cotización COT-260827-A3F1» es un número
  -- y hay que ir a buscarlo.
  d.codigo as documento_codigo,
  d.tipo   as documento_tipo,
  d.total  as documento_total,
  d.con_itbms as documento_con_itbms,
  d.pdf_path  as documento_pdf,

  -- Sin RUC la factura vuelve de Zoho sin poder engancharse a esta cuenta.
  -- Que se vea aquí es lo que permite pedirlo antes de facturar, no después.
  c.ruc as cuenta_ruc
from public.solicitudes s
join public.perfiles v on v.id = s.vendedor_id
join public.cuentas c on c.id = s.cuenta_id
left join public.cotizaciones d on d.id = s.documento_id
where s.deleted_at is null;

comment on view public.solicitudes_resumen is 'Solicitudes con su reloj, quién las pidió y el documento que las originó. Hereda el RLS por security_invoker. OJO: se crea con `select s.*`, así que toda columna nueva de `solicitudes` obliga a rehacerla entera.';
