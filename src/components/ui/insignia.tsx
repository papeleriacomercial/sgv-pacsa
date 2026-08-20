import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from "lucide-react";

type Tono = "ok" | "aviso" | "error" | "info" | "neutro";

/**
 * Los estados nunca dependen solo del color: cada tono trae su ícono, y la
 * etiqueta siempre se escribe. Es requisito de legibilidad bajo sol antes que
 * de accesibilidad (§17).
 */
const TONOS: Record<Tono, { clases: string; icono: LucideIcon }> = {
  ok: { clases: "bg-green-100 text-green-800", icono: CheckCircle2 },
  aviso: { clases: "bg-amber-100 text-amber-800", icono: AlertTriangle },
  error: { clases: "bg-red-100 text-red-800", icono: XCircle },
  info: { clases: "bg-blue-100 text-blue-800", icono: Info },
  neutro: { clases: "bg-slate-100 text-slate-700", icono: Circle },
};

type Props = {
  tono: Tono;
  children: string;
};

export function Insignia({ tono, children }: Props) {
  const { clases, icono: Icono } = TONOS[tono];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${clases}`}
    >
      <Icono size={14} aria-hidden />
      {children}
    </span>
  );
}
