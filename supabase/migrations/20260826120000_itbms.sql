-- ===========================================================================
-- El ITBMS: se pone o no se pone, y hay clientes que siempre piden que no
--
-- La cotización lleva 7 % de ITBMS, y hay clientes que piden que no se
-- incluya. No es la excepción rara: es una preferencia estable del cliente —
-- el que lo pide una vez lo pide siempre.
--
-- Por eso va en dos sitios y no en uno:
--
--   * **En la cuenta**, como preferencia. Así el vendedor no tiene que
--     acordarse de cada cliente cada vez, que es justo lo que se olvida
--     estando frente al mostrador.
--   * **En la cotización**, como decisión de ese documento. Porque la
--     preferencia se puede cambiar en el momento, y porque la cotización tiene
--     que decir siempre lo que decía cuando se emitió — aunque después la
--     cuenta cambie de criterio.
--
-- El porcentaje también sale del código: es una tasa de impuesto, y esas
-- cambian por decreto sin avisar a nadie.
-- ===========================================================================

insert into public.parametros (clave, valor, descripcion) values
  ('itbms_porcentaje',
   7,
   'Porcentaje de ITBMS que se aplica en las cotizaciones. Cambia por decreto, no por código.')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- La preferencia del cliente
--
-- Se llama «pide sin ITBMS» y no «exento» a propósito: exento es una condición
-- legal del contribuyente, y esto es lo que el cliente pide. Nombrarlo como lo
-- que no es haría creer que el sistema verificó algo que nadie verificó.
-- ---------------------------------------------------------------------------

alter table public.cuentas
  add column pide_sin_itbms boolean not null default false;

comment on column public.cuentas.pide_sin_itbms is 'Este cliente pide que no se le incluya el ITBMS. Es su preferencia, no una exención verificada.';

-- ---------------------------------------------------------------------------
-- Los tres números de la cotización
--
-- Se guardan calculados, no se recalculan al mostrar. Si mañana cambia la tasa
-- del impuesto, una cotización de hoy tiene que seguir diciendo lo que decía
-- el papel que recibió el cliente.
-- ---------------------------------------------------------------------------

alter table public.cotizaciones
  add column con_itbms boolean not null default true,
  add column subtotal numeric(12, 2) not null default 0,
  add column itbms numeric(12, 2) not null default 0,
  add column itbms_porcentaje numeric(5, 2) not null default 7;

comment on column public.cotizaciones.con_itbms is 'Si este documento lleva ITBMS. Se copia de la preferencia de la cuenta y se puede cambiar en el momento.';
comment on column public.cotizaciones.itbms_porcentaje is 'La tasa con la que se calculó, congelada: la cotización dice siempre lo que decía al emitirse.';
comment on column public.cotizaciones.total is 'Lo que paga el cliente: subtotal más ITBMS si lo lleva. Es contra este número que se aplica el tope.';

-- Que los tres números cuadren no puede quedar en manos de la pantalla: un
-- total que no es la suma de sus partes es lo que hace que alguien deje de
-- creerle al documento entero.
alter table public.cotizaciones
  add constraint cotizaciones_total_cuadra
    check (total = subtotal + itbms),
  add constraint cotizaciones_itbms_coherente
    check ((con_itbms and itbms >= 0) or (not con_itbms and itbms = 0));
