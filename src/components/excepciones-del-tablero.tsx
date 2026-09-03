"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Las excepciones del tablero, con su forma de callarlas — §7.1, el tablero del lunes.
 *
 * **SILENCIAR NO ES BORRAR, Y NO PUEDE SERLO.** Estas excepciones no existen guardadas en ninguna
 * parte: se recalculan cada vez que se abre el tablero, a partir de los cierres, los compromisos
 * vencidos y las solicitudes sin contestar. Borrar una no la quitaría — al recargar vuelve, porque
 * la condición que la produce sigue viva.
 *
 * Lo que se guarda es **que ya se leyó**. Y el aviso vuelve en cuanto deja de decir lo mismo: si
 * «5 compromisos vencidos» pasa a ser 8, su clave cambia y reaparece. Decisión del usuario, 3 de
 * septiembre de 2026: *«se silencia ese aviso, no la persona ni el tema»*.
 */
export type ExcepcionUI = {
  quien: string;
  que: string;
  detalle: string;
  clave: string;
};

export function ExcepcionesDelTablero({
  excepciones,
  silenciadas,
}: {
  excepciones: ExcepcionUI[];
  /** Las claves que este usuario ya calló. Llegan resueltas del servidor. */
  silenciadas: string[];
}) {
  const router = useRouter();
  const [ocultas, setOcultas] = useState<string[]>(silenciadas);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibles = excepciones.filter((e) => !ocultas.includes(e.clave));

  async function silenciar(claves: string[]) {
    if (claves.length === 0) return;
    setGuardando(true);
    setError(null);

    // SE OCULTA ANTES DE GUARDAR. El gesto es de lectura, no de decisión: esperar a la base para
    // que la tarjeta desaparezca hace que se sienta trabada. Si el guardado falla se dice, y al
    // recargar vuelve a estar — que es el estado correcto.
    setOcultas((previas) => [...previas, ...claves]);

    const supabase = clienteNavegador();
    const { data } = await supabase.auth.getUser();
    const { error: fallo } = await supabase
      .from("excepciones_silenciadas")
      .upsert(
        claves.map((clave) => ({ clave, silenciada_por: data.user?.id })),
        // Silenciar dos veces la misma no es un error: es alguien tocando la ✕ otra vez.
        { onConflict: "clave,silenciada_por" },
      );

    if (fallo) {
      setError("No se pudo guardar. Al recargar van a volver a aparecer.");
      setGuardando(false);
      return;
    }

    setGuardando(false);
    router.refresh();
  }

  return (
    <section id="excepciones" className="flex flex-col gap-2 scroll-mt-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-texto">Excepciones</h2>
        <Insignia tono={visibles.length === 0 ? "ok" : "error"}>
          {String(visibles.length)}
        </Insignia>

        {/* AL FINAL DE LA LÍNEA Y EN LETRA PEQUEÑA. Callar siete avisos de una vez es un gesto que
            conviene que cueste un poco más que leerlos. */}
        {visibles.length > 0 && (
          <button
            type="button"
            onClick={() => silenciar(visibles.map((e) => e.clave))}
            disabled={guardando}
            className="ml-auto min-h-tactil text-xs text-texto-atenuado underline underline-offset-2 disabled:opacity-50"
          >
            Borrar todas
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      {visibles.length === 0 && (
        <Tarjeta className="flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0 text-ok" aria-hidden />
          <p className="text-sm text-texto-secundario">
            {excepciones.length === 0
              ? "Nada fuera de lo normal esta semana."
              : // SE DICE QUE HAY AVISOS CALLADOS, no se finge que no hay nada. La diferencia entre
                // «no pasó nada» y «ya lo leí» es justo lo que un tablero no puede confundir.
                "Todo lo de esta semana ya lo leíste. Si algo empeora, vuelve a aparecer."}
          </p>
        </Tarjeta>
      )}

      {visibles.map((e) => (
        <Tarjeta
          key={e.clave}
          className="flex items-start gap-2 border-amber-200 bg-amber-50"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-aviso" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-texto">
              {e.quien} · {e.que}
            </p>
            <p className="text-xs text-texto-secundario">{e.detalle}</p>
          </div>
          <button
            type="button"
            onClick={() => silenciar([e.clave])}
            disabled={guardando}
            aria-label={`Ya leí: ${e.quien}, ${e.que}`}
            title="Ya lo leí"
            className="min-h-tactil -mr-1 -mt-1 flex w-11 shrink-0 items-center justify-center rounded-lg text-texto-atenuado hover:bg-amber-100 hover:text-texto disabled:opacity-50"
          >
            <X size={18} aria-hidden />
          </button>
        </Tarjeta>
      ))}
    </section>
  );
}
