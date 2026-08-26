"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Send } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { diasDesde, haceDias } from "@/lib/fechas";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

/**
 * Una cotización ya emitida: verla, reenviarla o anularla.
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
  id,
  codigo,
  total,
  conItbms,
  emitidaEn,
  ruta,
  anulada,
  motivo,
  esMia,
}: {
  id: string;
  codigo: string;
  total: number;
  conItbms: boolean;
  emitidaEn: string | null;
  ruta: string | null;
  anulada: boolean;
  motivo: string | null;
  esMia: boolean;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [razon, setRazon] = useState("");

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

  /**
   * Anular no borra: deja constancia de que se anuló y por qué.
   *
   * El cliente tiene una copia en su correo. Hacer desaparecer el documento de
   * este lado no lo hace desaparecer del suyo — solo deja a quien mire el
   * expediente sin entender por qué hay dos cotizaciones parecidas.
   */
  async function anular() {
    if (razon.trim().length < 3) return;
    setTrabajando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cotizaciones")
      .update({
        estado: "anulada",
        anulada_en: new Date().toISOString(),
        motivo_anulacion: razon.trim(),
      })
      .eq("id", id);

    if (fallo) setError(fallo.message);
    else router.refresh();
    setTrabajando(false);
  }

  const dias = emitidaEn ? diasDesde(emitidaEn) : null;

  return (
    <Tarjeta className={`flex flex-col gap-2 ${anulada ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm text-texto">
            {codigo}
            {anulada && (
              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                Anulada
              </span>
            )}
          </p>
          <p className="text-xs text-texto-atenuado">
            {dias === null ? "" : haceDias(dias)}
            {!conItbms && " · sin ITBMS"}
          </p>
          {anulada && motivo && (
            <p className="mt-1 text-xs text-texto-secundario">{motivo}</p>
          )}
        </div>
        <p
          className={`shrink-0 font-mono text-base ${
            anulada ? "text-texto-atenuado line-through" : "text-texto"
          }`}
        >
          {DINERO.format(total)}
        </p>
      </div>

      {ruta && !anulada && (
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

      {/* Anular es del dueño: quien la prometió es quien la retira. */}
      {esMia && !anulada && !anulando && (
        <button
          type="button"
          onClick={() => setAnulando(true)}
          className="min-h-tactil text-left text-xs text-texto-atenuado"
        >
          El precio estaba mal — anular esta cotización
        </button>
      )}

      {anulando && (
        <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-3">
          <p className="text-xs text-texto-secundario">
            No se borra: queda a la vista como anulada. El cliente tiene una
            copia en su correo, y hacerla desaparecer de aquí solo dejaría a
            quien mire el expediente sin entender qué pasó.
          </p>
          <Campo
            etiqueta="Por qué se anula"
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            placeholder="El precio del rollo estaba desactualizado"
          />
          <div className="grid grid-cols-2 gap-2">
            <Boton tono="secundario" onClick={() => setAnulando(false)}>
              Dejarla
            </Boton>
            <Boton
              tono="destructivo"
              onClick={anular}
              disabled={trabajando || razon.trim().length < 3}
            >
              Anular
            </Boton>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </Tarjeta>
  );
}
