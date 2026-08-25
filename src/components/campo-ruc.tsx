"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Campo } from "@/components/ui/campo";

/**
 * El RUC, pedido en el momento en que hace falta.
 *
 * **No se pide al crear la cuenta, y es a propósito.** Ahí el vendedor está
 * frente al mostrador, con una mano y con prisa, y el RUC no le sirve para
 * nada todavía. Se pide cuando la cuenta va a comprar: es el momento en que el
 * dato existe —el cliente lo tiene a la mano— y en que la oficina lo va a
 * necesitar para facturar.
 *
 * **Por qué importa tanto.** El nombre con que el vendedor conoce el comercio
 * —el del rótulo— casi nunca es la razón social con que se emite la factura.
 * Cuando esa factura vuelva desde Zoho, el RUC es lo único que permite saber
 * que «Comercial Rodríguez y Asociados, S.A.» es el «Minisuper La Esquina» que
 * él visita. Sin él hay que adivinar por nombre, que es justo lo que costó
 * tanto en la migración.
 *
 * **Con salida honesta.** Se puede marcar «no me lo dieron» y seguir.
 * Obligarlo sin escape no consigue el RUC: consigue números inventados, y un
 * RUC falso engancha con la cuenta equivocada, que es peor que no tener
 * ninguno.
 */
export function CampoRuc({
  valor,
  onCambio,
  sinRuc,
  onSinRuc,
  motivo,
}: {
  valor: string;
  onCambio: (v: string) => void;
  sinRuc: boolean;
  onSinRuc: (v: boolean) => void;
  /** Por qué se está pidiendo, en las palabras de esta pantalla. */
  motivo: string;
}) {
  const [tocado, setTocado] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-texto">
        <FileText size={16} aria-hidden />
        Falta el RUC
      </p>
      <p className="text-xs text-texto-secundario">{motivo}</p>

      {!sinRuc && (
        <Campo
          etiqueta="RUC"
          value={valor}
          onChange={(e) => {
            onCambio(e.target.value);
            setTocado(true);
          }}
          inputMode="text"
          placeholder="155123456-2-2017 o 8-123-456"
          ayuda={
            tocado && valor.trim().length > 0 && valor.replace(/\D/g, "").length < 5
              ? "Un RUC lleva al menos cinco dígitos."
              : "Como venga en la cédula o el aviso de operación. El DV se puede incluir o no."
          }
        />
      )}

      <label className="flex min-h-tactil items-center gap-2 text-sm text-texto">
        <input
          type="checkbox"
          checked={sinRuc}
          onChange={(e) => {
            onSinRuc(e.target.checked);
            if (e.target.checked) onCambio("");
          }}
          className="h-5 w-5 rounded border-borde"
        />
        No me lo dieron
      </label>
    </div>
  );
}
