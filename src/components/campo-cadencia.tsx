"use client";

import { useState } from "react";
import { CADENCIA_MAXIMA, CADENCIA_MINIMA, CADENCIAS } from "@/lib/catalogos";

type Props = {
  /** Días, como texto. Vacío significa sin cadencia. */
  valor: string;
  onCambio: (valor: string) => void;
};

const PRESELECCIONADAS = new Set(CADENCIAS.map((c) => String(c.dias)));

/** «Cada 240 días» no se entiende; «unos 8 meses» sí. */
function enMeses(dias: number): string {
  if (dias < 45) return `${dias} días`;
  const meses = Math.round(dias / 30);
  return meses === 1 ? "un mes" : `unos ${meses} meses`;
}

/**
 * Cada cuánto hay que volver a esta cuenta.
 *
 * Es contra qué se mide «días sin contacto»: sin cadencia ese número es solo
 * un número —20 días es alarma en un restaurante y normal en una oficina—.
 *
 * **Una cadencia es un ritmo que se repite, no una fecha.** Para «volver el 15
 * de marzo» está el próximo paso, que además queda en la agenda y se cumple o
 * no; una fecha guardada aquí dejaría de significar nada al día siguiente de
 * pasar. Por eso el escape es un número de días y no un calendario.
 */
export function CampoCadencia({ valor, onCambio }: Props) {
  const suelta = valor !== "" && !PRESELECCIONADAS.has(valor);
  const [otra, setOtra] = useState(suelta);

  const dias = Number(valor);
  const fueraDeRango =
    valor !== "" &&
    (!Number.isInteger(dias) ||
      dias < CADENCIA_MINIMA ||
      dias > CADENCIA_MAXIMA);

  return (
    <div>
      <p className="text-sm font-medium text-texto">Cada cuánto contactarla</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {CADENCIAS.map((c) => {
          const puesta = !otra && valor === String(c.dias);
          return (
            <button
              key={c.dias}
              type="button"
              aria-pressed={puesta}
              onClick={() => {
                setOtra(false);
                onCambio(puesta ? "" : String(c.dias));
              }}
              className={`min-h-tactil rounded-lg border px-3 text-sm ${
                puesta
                  ? "border-marca bg-marca text-white"
                  : "border-borde bg-superficie text-texto"
              }`}
            >
              {c.etiqueta}
            </button>
          );
        })}

        {/* El caso raro de verdad: quien pide dos veces al año, o el colegio
            que compra por trimestre escolar y no por trimestre calendario. */}
        <button
          type="button"
          aria-pressed={otra}
          onClick={() => {
            const abriendo = !otra;
            setOtra(abriendo);
            if (!abriendo) onCambio("");
          }}
          className={`min-h-tactil rounded-lg border px-3 text-sm ${
            otra
              ? "border-marca bg-marca text-white"
              : "border-borde bg-superficie text-texto"
          }`}
        >
          Otra
        </button>
      </div>

      {otra && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={CADENCIA_MINIMA}
            max={CADENCIA_MAXIMA}
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
            placeholder="240"
            aria-label="Cada cuántos días"
            className="min-h-tactil w-28 rounded-lg border border-borde bg-superficie px-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
          />
          <span className="text-sm text-texto-secundario">
            días
            {valor !== "" && !fueraDeRango && ` · ${enMeses(dias)}`}
          </span>
        </div>
      )}

      {fueraDeRango ? (
        <p className="mt-1 text-xs text-aviso">
          Entre {CADENCIA_MINIMA} y {CADENCIA_MAXIMA} días. Más de un año no es
          una cadencia: esa cuenta se dejó de atender.
        </p>
      ) : (
        <p className="mt-1 text-xs text-texto-atenuado">
          Opcional. Si la defines, el sistema te avisa cuando se pase. Para una
          fecha puntual usa el próximo paso, no esto.
        </p>
      )}
    </div>
  );
}
