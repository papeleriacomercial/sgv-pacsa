"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, WifiOff } from "lucide-react";
import { pendientes, sincronizar } from "@/lib/cola";

/**
 * Cuarto estado obligatorio (§17). El más olvidado y el más importante: el
 * vendedor necesita saber que su trabajo no se perdió.
 *
 * Muestra dos cosas distintas y por eso no se puede resumir en una sola línea:
 * **que no hay señal ahora** —lo que va a registrar se guarda igual— y **que
 * hay cosas esperando** —lo que ya registró todavía no llegó—. La segunda
 * sobrevive a que vuelva la conexión, y es la que de verdad importa.
 *
 * Sincroniza sola al recuperar la señal y al abrir la aplicación. El botón
 * existe para el caso en que el navegador dice que hay red y no la hay.
 */
export function AvisoSinConexion() {
  const router = useRouter();
  const [enLinea, setEnLinea] = useState(true);
  const [cuantas, setCuantas] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const refrescar = useCallback(() => setCuantas(pendientes().length), []);

  const vaciar = useCallback(async () => {
    setEnviando(true);
    const { enviadas } = await sincronizar();
    setEnviando(false);
    refrescar();
    // Si algo entró, la pantalla que se está mirando probablemente cambió.
    if (enviadas > 0) router.refresh();
  }, [refrescar, router]);

  useEffect(() => {
    const actualizar = () => {
      setEnLinea(navigator.onLine);
      refrescar();
      if (navigator.onLine) void vaciar();
    };

    actualizar();

    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    window.addEventListener("sgv:cola", refrescar);

    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
      window.removeEventListener("sgv:cola", refrescar);
    };
  }, [refrescar, vaciar]);

  if (enLinea && cuantas === 0) return null;

  const texto =
    cuantas > 0
      ? `${cuantas} ${cuantas === 1 ? "registro esperando" : "registros esperando"} señal.`
      : "Lo que registres se guarda y se envía al recuperar la señal.";

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-700"
    >
      {enLinea ? (
        <CloudUpload size={16} className="shrink-0" aria-hidden />
      ) : (
        <WifiOff size={16} className="shrink-0" aria-hidden />
      )}

      <p className="flex-1 text-xs">
        {enLinea ? "" : "Sin conexión. "}
        {texto}
      </p>

      {cuantas > 0 && enLinea && (
        <button
          type="button"
          onClick={vaciar}
          disabled={enviando}
          className="shrink-0 text-xs font-medium underline"
        >
          {enviando ? "Enviando" : "Enviar ahora"}
        </button>
      )}
    </div>
  );
}
