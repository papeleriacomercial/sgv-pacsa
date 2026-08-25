"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { MensajeError } from "@/components/ui/estados";

/**
 * Adoptar como cadencia el ritmo con que este cliente compra de verdad.
 *
 * **Se propone, no se impone.** El sistema calcula la mediana de los días entre
 * compras y la ofrece; el vendedor decide. Si se escribiera sola sobre lo que
 * él puso, dejaría de ponerla — y lo que él sabe del cliente («este pide más
 * seguido en temporada escolar») no está en ninguna factura.
 *
 * Un toque, y desaparece: cuando la cadencia guardada coincide con la
 * observada, ya no hay nada que ofrecer.
 */
export function AdoptarCadencia({
  cuentaId,
  dias,
  actual,
}: {
  cuentaId: string;
  /** La calculada de su historial de compra. */
  dias: number;
  /** La que el vendedor tenga puesta, si tiene alguna. */
  actual: number | null;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (actual === dias) return null;

  async function adoptar() {
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cuentas")
      .update({ dias_cadencia: dias })
      .eq("id", cuentaId);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={adoptar}
        disabled={guardando}
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm font-medium text-texto disabled:opacity-50"
      >
        <Check size={16} aria-hidden />
        {actual === null
          ? `Usar cada ${dias} días como su cadencia`
          : `Cambiar su cadencia de ${actual} a ${dias} días`}
      </button>
      {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}
    </div>
  );
}
