"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { MensajeError } from "@/components/ui/estados";

/**
 * Borrar una cuenta que se creó por equivocación.
 *
 * **Solo aparece cuando de verdad fue un error**, y eso son dos cosas a la vez:
 * la creó quien la está mirando, y nadie la ha tocado —ni visita, ni
 * oportunidad, ni cotización, ni factura—.
 *
 * La segunda condición sola no alcanzaría: de las 521 cuentas de la cartera,
 * 286 no tienen ninguna historia, porque son prospectos que trajo Badger y
 * nadie ha visitado todavía. Con esa regla sola se podría borrar media cartera.
 *
 * **Si alguien la evaluó, eso pasó**, y lo que corresponde es descartarla con su
 * motivo: así queda dicho por qué no sirve y nadie repite el viaje. Borrarla
 * haría que otro la escogiera del mapa dentro de tres meses.
 *
 * La regla la impone la base, no esta pantalla. Aquí solo se decide si el botón
 * se ve, para no ofrecer algo que va a rebotar.
 */
export function BorrarCuenta({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrar() {
    setBorrando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cuentas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setBorrando(false);
      return;
    }

    router.replace("/cuentas");
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center justify-center text-sm text-texto-atenuado"
      >
        La creé por error — borrarla
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borde bg-fondo p-3">
      <p className="text-xs text-texto-secundario">
        <strong>{nombre}</strong> desaparece de tu cartera y del mapa. Como nadie
        la ha tocado todavía, no se pierde ningún trabajo.
      </p>
      {/* La distinción que importa, dicha donde se decide. */}
      <p className="text-xs text-texto-atenuado">
        Si fuiste y no sirve, no la borres: descártala con su motivo. Así queda
        dicho por qué, y ni vos ni nadie vuelve a hacer el viaje.
      </p>

      {error && <MensajeError titulo="No se pudo borrar" detalle={error} />}

      <div className="grid grid-cols-2 gap-2">
        <Boton tono="secundario" ancho onClick={() => setAbierto(false)}>
          Dejarla
        </Boton>
        <Boton tono="destructivo" ancho disabled={borrando} onClick={borrar}>
          <span className="flex items-center justify-center gap-2">
            <Trash2 size={16} aria-hidden />
            {borrando ? "Borrando" : "Borrarla"}
          </span>
        </Boton>
      </div>
    </div>
  );
}
