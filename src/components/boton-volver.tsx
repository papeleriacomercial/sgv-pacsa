"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Volver a donde se venía, no a un destino fijo.
 *
 * Un enlace duro a `/` rompe el trabajo en tanda: quien está corrigiendo
 * cuentas desde el mapa filtrado espera regresar al mapa filtrado, no a la
 * lista completa. Como los filtros viven en la dirección, el historial los
 * trae de vuelta intactos.
 *
 * **LLEVA FLECHA DESDE EL 11 DE SEPTIEMBRE DE 2026.** Era sólo la palabra «Volver» en gris pequeño
 * al lado del título, y el usuario entró a una lista y no encontró cómo salir: *«no tiene botón de
 * regreso a la pantalla principal de listas»*. El botón estaba — pero un texto gris a la izquierda
 * de un título no se lee como un control, se lee como parte del encabezado. La flecha es lo que lo
 * convierte en algo que se toca.
 */
export function BotonVolver({ alterno = "/" }: { alterno?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // Si no hay historial —entró por enlace directo— se cae al destino
        // alterno en vez de dejar al usuario encerrado.
        if (window.history.length > 1) router.back();
        else router.push(alterno);
      }}
      className="min-h-tactil -ml-1 flex shrink-0 items-center gap-0.5 pr-1 text-sm text-texto-secundario"
    >
      <ChevronLeft size={20} aria-hidden />
      Volver
    </button>
  );
}
