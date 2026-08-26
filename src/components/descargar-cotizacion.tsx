"use client";

import { useState } from "react";
import { FileText, Send } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Tarjeta } from "@/components/ui/tarjeta";
import { diasDesde, haceDias } from "@/lib/fechas";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

/**
 * Una cotización ya emitida, con su PDF a un toque.
 *
 * **El archivo se descarga, no se rehace.** Una cotización es un documento que
 * alguien recibió: si se regenerara con los precios de hoy, el papel que tiene
 * el cliente y el que ve la oficina dejarían de coincidir.
 *
 * Reenviar usa la hoja de compartir del teléfono —correo, WhatsApp, lo que
 * tenga— porque el cliente que pide «mándamela otra vez» casi nunca la pide
 * por donde llegó la primera.
 */
export function DescargarCotizacion({
  codigo,
  total,
  conItbms,
  emitidaEn,
  ruta,
}: {
  codigo: string;
  total: number;
  conItbms: boolean;
  emitidaEn: string | null;
  ruta: string | null;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function traer(): Promise<File | null> {
    if (!ruta) return null;
    const supabase = clienteNavegador();
    const { data, error: fallo } = await supabase.storage
      .from("cotizaciones")
      .download(ruta);

    if (fallo || !data) {
      setError("No se pudo abrir el archivo.");
      return null;
    }
    return new File([data], `${codigo}.pdf`, { type: "application/pdf" });
  }

  async function abrir() {
    setTrabajando(true);
    setError(null);
    const archivo = await traer();
    if (archivo) window.open(URL.createObjectURL(archivo), "_blank");
    setTrabajando(false);
  }

  async function reenviar() {
    setTrabajando(true);
    setError(null);
    const archivo = await traer();

    if (archivo) {
      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: `Cotización ${codigo}` });
        } catch {
          // Cancelar no es un error.
        }
      } else {
        // Sin hoja de compartir —escritorio— se abre y desde ahí se guarda.
        window.open(URL.createObjectURL(archivo), "_blank");
      }
    }
    setTrabajando(false);
  }

  const dias = emitidaEn ? diasDesde(emitidaEn) : null;

  return (
    <Tarjeta className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm text-texto">{codigo}</p>
          <p className="text-xs text-texto-atenuado">
            {dias === null ? "" : haceDias(dias)}
            {!conItbms && " · sin ITBMS"}
          </p>
        </div>
        <p className="shrink-0 font-mono text-base text-texto">
          {DINERO.format(total)}
        </p>
      </div>

      {ruta && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={abrir}
            disabled={trabajando}
            className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto disabled:opacity-50"
          >
            <FileText size={16} aria-hidden />
            Ver
          </button>
          <button
            type="button"
            onClick={reenviar}
            disabled={trabajando}
            className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto disabled:opacity-50"
          >
            <Send size={16} aria-hidden />
            Reenviar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </Tarjeta>
  );
}
