"use client";

import { useRouter } from "next/navigation";

/**
 * Volver a donde se venía, no a un destino fijo.
 *
 * Un enlace duro a `/` rompe el trabajo en tanda: quien está corrigiendo
 * cuentas desde el mapa filtrado espera regresar al mapa filtrado, no a la
 * lista completa. Como los filtros viven en la dirección, el historial los
 * trae de vuelta intactos.
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
      className="min-h-tactil text-sm text-texto-secundario"
    >
      Volver
    </button>
  );
}
