"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { MensajeError } from "@/components/ui/estados";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

/**
 * Mover un compromiso a otra fecha.
 *
 * Tiene que existir: si hoy no va a alcanzar, moverlo es más honesto que
 * dejarlo pudrirse como vencido — y si no puede moverlo, aprende a ignorar la
 * agenda entera.
 *
 * **Pero deja rastro.** Si reprogramar fuera gratis, todo se empujaría para
 * siempre y "vencido" dejaría de significar algo. El contador lo lleva un
 * trigger, no esta pantalla.
 *
 * A partir de la cuarta vez la pantalla pregunta si la cuenta sigue viva. No es
 * un castigo: uno movido cuatro veces es señal de que o la cuenta no es real, o
 * el plan no lo era.
 */
export function ReprogramarCompromiso({
  id,
  vecesMovido,
}: {
  id: string;
  vecesMovido: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mover() {
    if (!fecha) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("compromisos")
      .update({ fecha_compromiso: fecha })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setAbierto(false);
    setFecha("");
    setGuardando(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center gap-1.5 text-xs text-texto-secundario underline"
      >
        <CalendarClock size={14} aria-hidden />
        Reprogramar
        {vecesMovido > 0 && (
          <span className="font-mono">
            · movido {vecesMovido} {vecesMovido === 1 ? "vez" : "veces"}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {vecesMovido >= 3 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Este ya lo has movido {vecesMovido} veces. ¿Sigue siendo real esta
          cuenta, o vale más descartarla con su motivo?
        </p>
      )}

      <Campo
        etiqueta="Nueva fecha"
        type="date"
        min={hoyEnPanama()}
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
      />

      {error && <MensajeError titulo="No se pudo mover" detalle={error} />}

      <div className="grid grid-cols-2 gap-2">
        <Boton tono="secundario" ancho onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
        <Boton ancho disabled={guardando || !fecha} onClick={mover}>
          {guardando ? "Moviendo" : "Mover"}
        </Boton>
      </div>
    </div>
  );
}
