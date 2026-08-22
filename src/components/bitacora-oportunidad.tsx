"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

export type Nota = { id: string; texto: string; created_at: string };

const SELLO = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Panama",
});

/**
 * Bitácora de avance de una oportunidad.
 *
 * Cada nota nace con su fecha y hora y **no se edita**. Un campo de texto
 * único se sobrescribe y pierde la historia; así queda cómo evolucionó la
 * negociación, que es lo que hay que mirar cuando una oportunidad lleva dos
 * meses sin moverse.
 */
export function BitacoraOportunidad({
  oportunidadId,
  notas,
  bloqueada,
}: {
  oportunidadId: string;
  notas: Nota[];
  /** Con la fecha de cierre vencida no se agregan notas: primero se mueve. */
  bloqueada: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase.from("notas_oportunidad").insert({
      id: crypto.randomUUID(),
      oportunidad_id: oportunidadId,
      texto: texto.trim(),
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setTexto("");
    setGuardando(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-texto">Avance</h2>

      {!bloqueada && (
        <Tarjeta className="flex flex-col gap-3">
          <Campo
            etiqueta="Agregar nota"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            ayuda="Se guarda con la fecha y la hora. Las anteriores no se borran."
          />
          {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}
          <Boton onClick={agregar} disabled={guardando || !texto.trim()}>
            {guardando ? "Guardando" : "Agregar"}
          </Boton>
        </Tarjeta>
      )}

      {notas.length === 0 && (
        <p className="text-xs text-texto-atenuado">
          Sin notas todavía. Aquí queda el rastro de cómo avanza la negociación.
        </p>
      )}

      {notas.map((n) => (
        <Tarjeta key={n.id} className="flex flex-col gap-1">
          <span className="font-mono text-xs text-texto-atenuado">
            {SELLO.format(new Date(n.created_at))}
          </span>
          <p className="text-sm text-texto">{n.texto}</p>
        </Tarjeta>
      ))}
    </section>
  );
}
