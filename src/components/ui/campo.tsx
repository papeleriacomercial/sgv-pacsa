"use client";

import type { InputHTMLAttributes } from "react";
import { useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
};

/**
 * Campo único de formulario. Su ausencia en el SGP produjo ocho variantes
 * distintas; aquí solo existe este.
 */
export function Campo({
  etiqueta,
  ayuda,
  error,
  className = "",
  ...props
}: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {etiqueta}
      </label>

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || ayuda ? idAyuda : undefined}
        className={[
          "min-h-tactil px-3 rounded-lg bg-superficie text-base",
          "border outline-none focus:ring-2 focus:ring-marca/30",
          error ? "border-error" : "border-borde focus:border-marca",
          // Va al final para que quien lo pase pueda añadir sin perder la base:
          // los identificadores y las medidas van en monoespaciada (§17).
          className,
        ].join(" ")}
        {...props}
      />

      {(error || ayuda) && (
        <p
          id={idAyuda}
          className={`text-xs ${error ? "text-error" : "text-texto-atenuado"}`}
        >
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}
