-- Silenciar una excepción del tablero, una vez leída — §7.1, el tablero del lunes.
--
-- Lo pidió el usuario el 3 de septiembre de 2026: *«hay que agregarle una forma de borrar las
-- excepciones una vez leídas»*.
--
-- **BORRAR NO PUEDE SIGNIFICAR BORRAR**, y esa es la única decisión de fondo de esta tabla. Las
-- excepciones no están guardadas en ninguna parte: **se recalculan cada vez que se abre el
-- tablero**, a partir de los cierres, los compromisos vencidos y las solicitudes sin contestar.
-- Borrar una no la quitaría — al recargar vuelve, porque la condición que la produce sigue viva.
--
-- Así que se silencian: se recuerda que ya se leyó, y deja de mostrarse **mientras siga diciendo lo
-- mismo**. Decisión del usuario tras plantearle el caso: se silencia *ese aviso*, no la persona ni
-- el tema. Si «5 compromisos vencidos» pasa a ser 8, **es un aviso distinto y vuelve a aparecer** —
-- que es justo lo que uno querría que pasara.
--
-- LA CLAVE LA ARMA LA PANTALLA, y cada tipo de excepción elige la suya con criterio propio: la del
-- cierre lleva la semana, la de compromisos lleva el número, y la de una solicitud sin contestar
-- lleva el identificador de la solicitud —porque sus horas crecen solas y una clave con las horas
-- reaparecería cada hora—. Guardarla como texto es lo que permite que esa decisión viva donde se
-- entiende, y no en un esquema que habría que migrar cada vez que nace una excepción nueva.
--
-- ES POR PERSONA. Hoy sólo gerencia abre este tablero, así que en la práctica es una sola; pero
-- que uno silencie no debe dejar ciego a otro el día que sean dos.

create table if not exists public.excepciones_silenciadas (
  id             uuid primary key default gen_random_uuid(),
  /** Lo que identifica al aviso. La arma la pantalla; ver el comentario de arriba. */
  clave          text not null,
  silenciada_por uuid not null default auth.uid() references public.perfiles (id),
  silenciada_en  timestamptz not null default now(),

  unique (clave, silenciada_por)
);

comment on table public.excepciones_silenciadas is
  'Excepciones del tablero que alguien ya leyó y no quiere volver a ver. No se borran: se silencian mientras el aviso siga diciendo lo mismo. Si el número cambia, la clave cambia y el aviso vuelve.';

create index if not exists excepciones_silenciadas_por_idx
  on public.excepciones_silenciadas (silenciada_por, clave);

alter table public.excepciones_silenciadas enable row level security;

-- Cada quien ve y escribe lo suyo. No hay nada que compartir: silenciar es un gesto personal de
-- «ya lo leí», y verlo de otro no le sirve a nadie.
create policy "silenciadas_propias"
  on public.excepciones_silenciadas for all to authenticated
  using (silenciada_por = auth.uid())
  with check (silenciada_por = auth.uid());
