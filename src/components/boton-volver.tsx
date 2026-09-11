"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const ASPECTO =
  "min-h-tactil -ml-1 flex shrink-0 items-center gap-0.5 pr-1 text-sm text-texto-secundario";

/**
 * Volver.
 *
 * **Dos comportamientos, y elegir mal el que toca produce el defecto que reportó el usuario el 11
 * de septiembre de 2026.**
 *
 * Con `href`, **vuelve siempre al mismo sitio**. Es lo correcto cuando la pantalla tiene un padre
 * que no cambia: el padre de una lista es la lista de listas, siempre. Sin él, el botón «vuelve a
 * donde venías», y al dar una vuelta —entrar a la lista, ir a buscar puntos, regresar a la lista—
 * lo de atrás ya no es la pantalla de listas sino el buscador: *«la opción de volver que está al
 * lado del nombre Aguadulce me lleva de vuelta a la pantalla de buscar potenciales»*.
 *
 * Sin `href`, usa el historial. **Y eso también es correcto donde lo es:** quien corrige cuentas
 * desde un mapa filtrado espera volver al mapa filtrado, no a la lista completa — los filtros viven
 * en la dirección y el historial los trae intactos. Ahí un enlace duro rompería el trabajo en tanda.
 *
 * **LLEVA FLECHA.** Era sólo la palabra «Volver» en gris al lado del título, y el usuario entró a
 * una lista y no encontró cómo salir. El botón estaba: un texto gris a la izquierda de un título no
 * se lee como un control, se lee como parte del encabezado.
 */
export function BotonVolver({
  alterno = "/",
  href,
}: {
  /** A dónde caer cuando no hay historial —entró por enlace directo— y no se dio `href`. */
  alterno?: string;
  /** Destino fijo. Con esto puesto, el historial no se mira. */
  href?: string;
}) {
  const router = useRouter();

  if (href) {
    return (
      <Link href={href} className={ASPECTO}>
        <ChevronLeft size={20} aria-hidden />
        Volver
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        // Sin historial —entró por enlace directo— se cae al destino alterno en vez de dejar al
        // usuario encerrado.
        if (window.history.length > 1) router.back();
        else router.push(alterno);
      }}
      className={ASPECTO}
    >
      <ChevronLeft size={20} aria-hidden />
      Volver
    </button>
  );
}
