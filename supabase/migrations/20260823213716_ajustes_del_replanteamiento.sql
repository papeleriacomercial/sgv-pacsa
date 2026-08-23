-- Ajustes que salieron del replanteamiento de diseño del 2026-08-22 y 23.
--
-- Son huecos que se encontraron revisando el flujo de cada rol contra lo ya
-- construido. Ninguno es grande; todos son baratos ahora y caros después de
-- que haya datos encima. Ver docs/12, docs/13 y docs/14.

-- ===========================================================================
-- 1. Falta el mejor resultado posible de una visita: que le compren
--
-- El catálogo de nueve resultados se diseñó para prospectar —no estaba el
-- encargado, pide cotización, quiere precio— y ninguno dice "compró". El
-- vendedor de ruta cierra ventas en la visita todos los días, y sin este valor
-- las iba a registrar como "dejó información": el dato se perdía justo en el
-- caso que más importa.
-- ===========================================================================

alter type public.resultado_visita add value 'compro' before 'pide_cotizacion';

-- ===========================================================================
-- 2. Falta la reunión
--
-- Para el líder es su unidad de avance real: conseguir que un jefe de compras
-- lo reciba cuesta semanas de insistencia. Contarla como "visita" la mezcla
-- con pasar por un minisúper, y entonces no se puede medir lo único que de
-- verdad mueve una venta grande.
-- ===========================================================================

alter type public.tipo_interaccion add value 'reunion' after 'visita';

-- ===========================================================================
-- 3. El compromiso no sabe a qué venta pertenece
--
-- El seguimiento sí se puede ligar a una oportunidad desde la Etapa 5. El
-- compromiso no — y la agenda del vendedor está hecha de compromisos.
--
-- Sin esto, un renglón que dice "Banco Aliado" no distingue si es por los
-- rollos de los cajeros o por las bolsas de la cafetería, cuando las dos
-- ventas están abiertas al mismo tiempo con el mismo cliente.
-- ===========================================================================

alter table public.compromisos
  add column oportunidad_id uuid references public.oportunidades (id);

comment on column public.compromisos.oportunidad_id is 'Opcional: la venta a la que sirve este próximo paso. Se hereda del seguimiento que lo originó.';

create index compromisos_oportunidad_idx
  on public.compromisos (oportunidad_id)
  where oportunidad_id is not null and deleted_at is null;

-- ===========================================================================
-- 4. Las cadenas: un cliente con muchos puntos
--
-- Starbucks es una negociación y diez tiendas. Creadas como once cuentas
-- sueltas, el sistema cuenta once clientes nuevos y es uno solo: infla la
-- cartera y arruina la tasa de conversión.
--
-- No hace falta una entidad nueva. La tienda es una cuenta —tiene dirección e
-- historia— y la madre también —tiene RUC y contrato—. Basta con que una
-- cuente cuelgue de otra.
-- ===========================================================================

alter table public.cuentas
  add column cuenta_madre_id uuid references public.cuentas (id);

comment on column public.cuentas.cuenta_madre_id is 'La cuenta de la que cuelga este punto. Nulo si es independiente. Los clientes se cuentan por madre; el trabajo, por punto.';

create index cuentas_madre_idx
  on public.cuentas (cuenta_madre_id)
  where cuenta_madre_id is not null and deleted_at is null;

-- Una cuenta no puede colgar de sí misma. No evita una cadena circular de
-- tres, pero sí el error que de verdad ocurre al tocar mal la pantalla.
alter table public.cuentas
  add constraint cuentas_madre_no_es_ella_misma
    check (cuenta_madre_id is null or cuenta_madre_id <> id);

-- ---------------------------------------------------------------------------
-- La madre de una cadena no suele ser una tienda: es una oficina
--
-- En Starbucks no se negocia en ninguna sucursal, se negocia en una oficina
-- administrativa que no vende al público, no recibe entregas y no hace
-- pedidos. Tratarla como local la metería en las rutas de reparto y en la
-- cadencia de visita comercial, donde no pinta nada.
--
-- No es forzoso —una cadena chica puede negociar en su local principal— por
-- eso es un campo y no una regla derivada de tener hijos.
-- ---------------------------------------------------------------------------

create type public.tipo_punto as enum (
  'local',
  'oficina'
);

alter table public.cuentas
  add column tipo_punto public.tipo_punto not null default 'local';

comment on column public.cuentas.tipo_punto is 'Local: se vende y se entrega. Oficina: solo se negocia, no entra a rutas de reparto.';

comment on type public.tipo_punto is 'Qué clase de punto es la cuenta. Ver §7.9 y docs/13-flujo-lider.html.';
