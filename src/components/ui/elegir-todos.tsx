"use client";

import { Check, Minus } from "lucide-react";

/**
 * Elegir o quitar de un golpe todo lo que se puede elegir en una pantalla.
 *
 * Lo pidió el usuario el 4 de septiembre de 2026, mirando el buscador del mapa: *«si una búsqueda
 * da como resultado quince potenciales nuevos… en vez de seleccionar cada uno individual, arriba
 * haya una opción de oprimir, seleccionar todos»*.
 *
 * **DICE CUÁNTOS SON, NO «TODOS».** «Seleccionar todos» obliga a mirar la pantalla para saber en
 * qué se está metiendo uno; «Elegir los 15 nuevos» ya lo dijo. Y son quince cuentas que van a nacer
 * en la cartera de alguien: el número antes del gesto es lo que evita el susto después.
 *
 * **TIENE TRES ESTADOS, NO DOS.** Ninguno, todos, y **algunos** — que es donde se pasa la mayor
 * parte del tiempo real: se marcan cuatro a mano y entonces se quiere el resto. Una casilla de dos
 * estados tiene que mentir en ese momento (¿se dibuja marcada o vacía con cuatro elegidos?), y la
 * raya del medio es lo que la deja decir la verdad. Tocarla desde «algunos» elige todo, que es lo
 * que uno espera; el único gesto que quita es tocarla estando ya todo elegido.
 *
 * **`total` es lo que se PUEDE elegir, no lo que hay en pantalla.** En el buscador conviven cuatro
 * situaciones y sólo los nuevos son elegibles: un local de otro vendedor no se puede tomar, y un
 * «elegir todos» que lo incluyera prometería algo que la pantalla no hace.
 */
export function ElegirTodos({
  total,
  elegidos,
  sustantivo,
  onTodos,
  onNinguno,
}: {
  /** Cuántos elementos se pueden elegir. Si es 0 la pieza no se dibuja. */
  total: number;
  /** Cuántos de esos están elegidos ahora. */
  elegidos: number;
  /** Cómo se llaman, en plural: «nuevos», «clientes». Va dentro de la etiqueta. */
  sustantivo: string;
  onTodos: () => void;
  onNinguno: () => void;
}) {
  // Sin nada que elegir no hay control: una casilla que no hace nada es peor que no tenerla.
  if (total === 0) return null;

  const todos = elegidos >= total;
  const algunos = elegidos > 0 && !todos;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={todos ? "true" : algunos ? "mixed" : "false"}
      onClick={todos ? onNinguno : onTodos}
      className={`min-h-tactil flex w-full items-center gap-3 rounded-lg border px-3 text-left ${
        todos ? "border-marca bg-marca/5" : "border-borde bg-superficie"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
          todos || algunos
            ? "border-marca bg-marca text-white"
            : "border-borde bg-fondo"
        }`}
      >
        {todos && <Check size={16} />}
        {algunos && <Minus size={16} />}
      </span>

      <span className="flex-1 text-sm font-medium text-texto">
        {todos ? `Quitar los ${total}` : `Elegir los ${total} ${sustantivo}`}
      </span>

      {/* Sólo cuando hay una selección a medias: con todos o con ninguno, la etiqueta ya lo dijo y
          el número al lado sería la misma cosa escrita dos veces. */}
      {algunos && (
        <span className="shrink-0 font-mono text-xs text-texto-secundario">
          {elegidos} de {total}
        </span>
      )}
    </button>
  );
}
