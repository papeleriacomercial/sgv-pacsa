"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { TIPOS_SOLICITUD, type TipoSolicitud } from "@/lib/catalogos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";

export type Pedida = {
  id: string;
  cuentaId: string;
  cuenta: string;
  tipo: TipoSolicitud;
  detalle: string;
  monto: number | null;
  cuando: string;
  /** Si nació de un documento, para poder volver a abrir el PDF. */
  documento: { codigo: string; ruta: string | null } | null;
};

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

const FECHA = new Intl.DateTimeFormat("es-PA", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Panama",
});

/**
 * Lo que le has pedido a la oficina. **Un registro, no una bandeja.**
 *
 * **No dice «pendiente» ni «resuelta», y eso es la decisión entera** (D-071). Quien cerraba una
 * solicitud era la oficina desde su bandeja, y la oficina ya no entra al sistema: se entera por
 * correo. Sin nadie que las cierre, un estado «pendiente» no envejecería — se quedaría ahí para
 * siempre, y en dos meses el vendedor tendría cuarenta pendientes de las que treinta y ocho ya le
 * llegaron. **Una lista que miente es peor que no tener lista.**
 *
 * Tampoco se le pide al vendedor que las cierre él. El principio del sistema es que *el vendedor
 * no reporta avance*: pedirle un toque de «ya me llegó» es justamente reportar, y no lo haría.
 *
 * Lo que sí contesta, que es lo único que necesitaba: **¿qué le mandé a la oficina esta semana?**
 * Y desde aquí vuelve a la cuenta o reabre el documento sin escarbar en su correo.
 */
export function RegistroSolicitudes({ pedidas }: { pedidas: Pedida[] }) {
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  async function abrirDocumento(p: Pedida) {
    if (!p.documento?.ruta) return;
    setAbriendo(p.id);
    setFallo(null);

    const { data } = await clienteNavegador()
      .storage.from("cotizaciones")
      .download(p.documento.ruta);

    if (!data) {
      setFallo("No se pudo abrir el documento.");
      setAbriendo(null);
      return;
    }

    window.open(URL.createObjectURL(data), "_blank");
    setAbriendo(null);
  }

  if (pedidas.length === 0) {
    return (
      <Tarjeta>
        <Vacio titulo="No has pedido nada todavía">
          Lo que le mandes a la oficina —cotizaciones, órdenes, muestras o un precio especial—
          queda anotado aquí.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fallo && <p className="text-sm text-aviso">{fallo}</p>}

      {pedidas.map((p) => (
        <Tarjeta key={p.id} className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/cuentas/${p.cuentaId}`}
                className="block truncate text-sm font-medium text-texto"
              >
                {p.cuenta}
              </Link>
              <p className="font-mono text-xs text-texto-atenuado">
                {FECHA.format(new Date(p.cuando))}
              </p>
            </div>
            <Insignia tono="neutro">{TIPOS_SOLICITUD[p.tipo]}</Insignia>
          </div>

          <p className="text-sm text-texto-secundario">{p.detalle}</p>

          <div className="flex items-center justify-between gap-2">
            {p.monto === null ? (
              <span />
            ) : (
              <span className="font-mono text-sm text-texto">
                {DINERO.format(p.monto)}
              </span>
            )}

            {p.documento?.ruta && (
              <button
                type="button"
                onClick={() => abrirDocumento(p)}
                disabled={abriendo === p.id}
                className="min-h-tactil flex items-center gap-2 rounded-lg border border-borde px-3 text-sm text-texto disabled:opacity-50"
              >
                <FileText size={16} aria-hidden />
                {abriendo === p.id ? "Abriendo…" : p.documento.codigo}
              </button>
            )}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}
