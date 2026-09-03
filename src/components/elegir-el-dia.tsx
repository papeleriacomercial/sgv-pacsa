"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { correrDias } from "@/lib/fechas";


/**
 * Moverse de día en día, con el calendario a mano.
 *
 * **Las flechas son el gesto real** — se mira ayer, anteayer, el lunes pasado— y el calendario está
 * para el salto largo. Al revés (sólo calendario) se necesitan tres toques para ver ayer, y ver
 * ayer es lo que se hace todas las mañanas.
 *
 * Hacia adelante se topa en hoy: un día que todavía no pasó no tiene actividad que reportar, y
 * dejarlo abierto sólo produce pantallas vacías que parecen un defecto.
 */
export function ElegirElDia({ dia, hoy }: { dia: string; hoy: string }) {
  const router = useRouter();
  const ir = (d: string) => router.push(`/tablero/actividad?dia=${d}`);
  const hayManana = dia < hoy;

  return (
    <div className="flex items-center gap-2 border-b border-borde bg-superficie px-4 py-2">
      <button
        type="button"
        onClick={() => ir(correrDias(dia, -1))}
        aria-label="Día anterior"
        className="min-h-tactil flex w-11 shrink-0 items-center justify-center rounded-lg border border-borde text-texto"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>

      <input
        type="date"
        value={dia}
        max={hoy}
        onChange={(e) => e.target.value && ir(e.target.value)}
        aria-label="Día del reporte"
        className="min-h-tactil w-full rounded-lg border border-borde bg-fondo px-3 text-center font-mono text-base text-texto"
      />

      <button
        type="button"
        onClick={() => hayManana && ir(correrDias(dia, 1))}
        disabled={!hayManana}
        aria-label="Día siguiente"
        className="min-h-tactil flex w-11 shrink-0 items-center justify-center rounded-lg border border-borde text-texto disabled:opacity-40"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
