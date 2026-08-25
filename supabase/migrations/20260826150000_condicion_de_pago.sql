-- ===========================================================================
-- La condición de pago se escoge, no está fija
--
-- Al leer la plantilla di por hecho que los términos eran un párrafo igual
-- para todos. No lo son: **«Contado», «50 % abono y 50 % contra entrega» y
-- «Crédito 30 días» son tres opciones**, y cada cotización lleva la que se
-- acordó con ese cliente.
--
-- Meterlas las tres en el pie habría dejado al cliente eligiendo la que más le
-- convenga, que es justo lo contrario de lo que hace un documento comercial.
-- ===========================================================================

create type public.condicion_pago as enum (
  'contado',
  'abono_50',
  'credito_30'
);

comment on type public.condicion_pago is 'Cómo se paga esta cotización. Se acuerda con el cliente, no es fija.';

alter table public.cotizaciones
  add column condicion_pago public.condicion_pago not null default 'contado';

comment on column public.cotizaciones.condicion_pago is 'Congelada en el documento: la cotización dice siempre lo que se acordó al emitirla.';

-- El pie deja de llevar los tiempos de entrega de rollos —los quitó gerencia—
-- y se queda con lo que sí vale para todas: dónde se abona.
update public.empresa
set terminos = 'Abonos ACH Banco General. YAPPY @papeleriacomercial';
