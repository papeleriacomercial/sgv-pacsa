"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Cuarto estado obligatorio (§17). El más olvidado y el más importante: el
 * vendedor necesita saber que su trabajo no se perdió.
 *
 * `pendientes` es cuántos registros quedan en la cola local esperando
 * sincronizar. Mientras la cola no exista (llega en el Tramo 3), el aviso solo
 * informa que no hay conexión.
 */
export function AvisoSinConexion({ pendientes = 0 }: { pendientes?: number }) {
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  if (enLinea) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-700"
    >
      <WifiOff size={16} className="shrink-0" aria-hidden />
      <p className="text-xs">
        Sin conexión.{" "}
        {pendientes > 0
          ? `${pendientes} ${pendientes === 1 ? "registro pendiente" : "registros pendientes"} de sincronizar.`
          : "Lo que registres se guardará y se enviará al recuperar la señal."}
      </p>
    </div>
  );
}
