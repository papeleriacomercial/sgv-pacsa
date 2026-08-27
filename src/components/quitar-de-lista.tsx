"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Sacar un punto de la lista sin tocar la cuenta.
 *
 * **Es lo que más falta y lo que menos riesgo tiene.** El vendedor mete veinte
 * puntos del mapa, cinco no le sirven, y sin esto se quedan ahí para siempre
 * ensuciando el conteo de «sin tocar» con el que se arma el compromiso de la
 * semana. Un contador que cuenta trabajo que nadie va a hacer deja de servir
 * para prometer.
 *
 * **No borra la cuenta ni la descarta.** El punto vuelve a estar disponible en
 * el mapa, y si mañana el vendedor cambia de idea lo agrega otra vez.
 *
 * Pide confirmación aunque sea barato de deshacer: en un teléfono, la equis va
 * al lado del nombre y el pulgar es gordo.
 */
export function QuitarDeLista({
  listaId,
  cuentaId,
  nombre,
}: {
  listaId: string;
  cuentaId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState(false);

  async function quitar() {
    setQuitando(true);
    setError(false);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("listas_cuentas")
      .delete()
      .eq("lista_id", listaId)
      .eq("cuenta_id", cuentaId);

    if (fallo) {
      setError(true);
      setQuitando(false);
      return;
    }

    router.refresh();
  }

  if (confirmando) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-3">
        <p className="text-xs text-texto-secundario">
          Sale de esta lista. La cuenta no se borra ni se descarta: vuelve a
          estar disponible en el mapa.
        </p>
        {error && (
          <p className="text-xs text-error">No se pudo. Vuelve a intentar.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="min-h-tactil rounded-lg border border-borde bg-superficie text-sm text-texto"
          >
            Dejarlo
          </button>
          <button
            type="button"
            onClick={quitar}
            disabled={quitando}
            className="min-h-tactil rounded-lg bg-marca text-sm text-white disabled:opacity-50"
          >
            {quitando ? "Quitando" : "Quitar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      aria-label={`Quitar ${nombre} de la lista`}
      className="min-h-tactil flex w-11 shrink-0 items-center justify-center rounded-lg text-texto-atenuado"
    >
      <X size={18} aria-hidden />
    </button>
  );
}
