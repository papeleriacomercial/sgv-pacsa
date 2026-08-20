import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

/**
 * Los cuatro estados obligatorios de toda pantalla (§17): cargando, vacío,
 * error y sin conexión. Este archivo tiene los tres primeros; el de sin
 * conexión vive en aviso-sin-conexion.tsx porque necesita el navegador.
 *
 * Ninguna pantalla se da por terminada sin los cuatro.
 */

export function Cargando({ texto = "Cargando" }: { texto?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-10 text-texto-secundario"
    >
      <Loader2 size={18} className="animate-spin" aria-hidden />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function Vacio({
  titulo,
  children,
}: {
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox size={24} className="text-texto-atenuado" aria-hidden />
      <p className="text-sm font-medium text-texto">{titulo}</p>
      {/* Un estado vacío dice qué hacer a continuación, no solo "sin resultados". */}
      {children && (
        <div className="text-sm text-texto-secundario">{children}</div>
      )}
    </div>
  );
}

export function MensajeError({
  titulo = "Algo salió mal",
  detalle,
}: {
  titulo?: string;
  detalle?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-error" aria-hidden />
      <div>
        <p className="text-sm font-medium text-red-700">{titulo}</p>
        {detalle && <p className="text-xs text-red-700">{detalle}</p>}
      </div>
    </div>
  );
}
