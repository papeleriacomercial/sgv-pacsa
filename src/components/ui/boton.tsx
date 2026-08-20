import type { ButtonHTMLAttributes } from "react";

type Tono = "primario" | "secundario" | "destructivo";

const TONOS: Record<Tono, string> = {
  // El ámbar nunca es botón de acción: esa función la toma la marca (§17).
  primario: "bg-marca text-white hover:bg-marca-suave",
  secundario: "bg-superficie text-texto border border-borde hover:bg-fondo",
  destructivo: "bg-error text-white hover:opacity-90",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tono?: Tono;
  ancho?: boolean;
};

export function Boton({
  tono = "primario",
  ancho = false,
  className = "",
  ...props
}: Props) {
  return (
    <button
      className={[
        "min-h-tactil px-4 rounded-lg text-base font-medium",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        TONOS[tono],
        ancho ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
