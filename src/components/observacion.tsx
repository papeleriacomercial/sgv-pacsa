"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { actualizar } from "@/lib/cola";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

/**
 * La observación de gerencia sobre un reporte semanal.
 *
 * **Es la única parte del reporte que escribe una persona.** Todo lo demás lo
 * arma la tarea del viernes a partir de hechos; esto es el juicio de quien
 * supervisa, y queda guardado con su firma y su fecha para que dentro de seis
 * meses se pueda leer la conversación completa.
 *
 * **Y es texto libre a propósito**, al contrario que todo lo demás del plan
 * diario. La razón es la asimetría: al vendedor se le pide escoger de catálogos
 * porque lo suyo hay que poder contarlo —cuántas visitas, qué motivo—; lo de
 * gerencia no se cuenta, se lee. Un catálogo de observaciones no diría nada.
 */
export function Observacion({
  reporteId,
  observacion,
  firmadaPor,
  firmadaEn,
  puedeEscribir,
}: {
  reporteId: string;
  observacion: string | null;
  firmadaPor: string | null;
  firmadaEn: string | null;
  puedeEscribir: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(observacion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);

  async function guardar() {
    if (guardando || texto.trim() === "") return;
    setGuardando(true);
    setError(null);

    // La firma la pone la base, no esta pantalla: así no hay forma de escribir
    // una observación a nombre de otro.
    const { error: fallo } = await actualizar(
      "reportes_semanales",
      reporteId,
      { observacion: texto.trim() },
      "Tu observación de la semana",
    );

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    setGuardada(true);
    setGuardando(false);
    router.refresh();
  }

  // -------------------------------------------------------------------------
  // Para el vendedor: la lee, no la escribe.
  //
  // **Y si todavía no hay, se dice.** Un espacio en blanco sin explicación deja
  // al vendedor pensando que su reporte no se miró; decirle que está pendiente
  // es la diferencia entre silencio y espera.
  // -------------------------------------------------------------------------
  if (!puedeEscribir) {
    return (
      <Tarjeta className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-texto">Observación de gerencia</h2>
        {observacion ? (
          <>
            <p className="whitespace-pre-wrap text-base text-texto">{observacion}</p>
            {firmadaEn ? (
              <p className="text-xs text-texto-atenuado">
                {firmadaPor ? `${firmadaPor} · ` : ""}
                {new Date(firmadaEn).toLocaleDateString("es-PA", {
                  day: "numeric",
                  month: "long",
                  timeZone: "America/Panama",
                })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-texto-secundario">
            Todavía no la han escrito. Llega después del lunes.
          </p>
        )}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquarePlus size={18} className="text-marca" aria-hidden />
        <h2 className="text-sm font-medium text-texto">
          {observacion ? "Tu observación" : "Escribe tu observación"}
        </h2>
      </div>

      {error ? <MensajeError detalle={error} /> : null}

      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setGuardada(false);
        }}
        rows={5}
        placeholder="Lo que quieres que lea sobre esta semana."
        className="w-full rounded-lg border border-borde bg-superficie p-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />

      <p className="text-xs text-texto-atenuado">
        El vendedor la va a ver en su propia pantalla. Queda guardada con tu
        nombre y la fecha.
      </p>

      <Boton
        onClick={guardar}
        ancho
        disabled={guardando || texto.trim() === "" || texto.trim() === (observacion ?? "")}
      >
        {guardando
          ? "Guardando…"
          : guardada
            ? "Guardada"
            : observacion
              ? "Cambiar la observación"
              : "Guardar"}
      </Boton>

      {observacion && firmadaEn ? (
        <p className="text-xs text-texto-atenuado">
          Escrita el{" "}
          {new Date(firmadaEn).toLocaleDateString("es-PA", {
            day: "numeric",
            month: "long",
            timeZone: "America/Panama",
          })}
          {firmadaPor ? ` por ${firmadaPor}` : ""}.
        </p>
      ) : null}
    </Tarjeta>
  );
}
