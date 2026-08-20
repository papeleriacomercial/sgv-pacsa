import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function Tarjeta({ children, className = "" }: Props) {
  return (
    <div
      className={`bg-superficie border border-borde rounded-lg p-4 ${className}`}
    >
      {children}
    </div>
  );
}
