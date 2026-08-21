"use client";

import { Check } from "lucide-react";

type Props<T extends string> = {
  etiqueta: string;
  opciones: Record<T, string>;
  valor: T | T[] | null;
  onCambio: (valor: T) => void;
  multiple?: boolean;
  ayuda?: string;
};

/**
 * Lista de opciones tocables, de una o de varias.
 *
 * No es un `<select>` a propósito: el desplegable nativo obliga a abrir, mirar
 * y elegir, que son tres gestos. Aquí las opciones están a la vista y se
 * resuelven con un toque, que es lo que exige el objetivo de 30 segundos.
 */
export function Opciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  multiple = false,
  ayuda,
}: Props<T>) {
  const seleccionados = Array.isArray(valor) ? valor : valor ? [valor] : [];

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-texto">{etiqueta}</legend>
      {ayuda && <p className="text-xs text-texto-atenuado">{ayuda}</p>}

      <div className="mt-1 flex flex-col gap-2">
        {(Object.keys(opciones) as T[]).map((clave) => {
          const activo = seleccionados.includes(clave);
          return (
            <button
              key={clave}
              type="button"
              aria-pressed={activo}
              onClick={() => onCambio(clave)}
              className={[
                "min-h-tactil flex items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm",
                activo
                  ? "border-marca bg-marca text-white"
                  : "border-borde bg-superficie text-texto",
              ].join(" ")}
            >
              <span>{opciones[clave]}</span>
              {activo && <Check size={16} className="shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>

      {multiple && (
        <p className="text-xs text-texto-atenuado">Puedes elegir varias.</p>
      )}
    </fieldset>
  );
}
