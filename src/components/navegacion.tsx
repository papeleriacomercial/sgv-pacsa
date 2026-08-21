"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Map, Search, Store, TrendingUp } from "lucide-react";

const RUTAS = [
  { href: "/agenda", etiqueta: "Agenda", Icono: CalendarClock },
  { href: "/", etiqueta: "Prospectos", Icono: Store },
  { href: "/buscar", etiqueta: "Buscar", Icono: Search },
  { href: "/mapa", etiqueta: "Mapa", Icono: Map },
  { href: "/pipeline", etiqueta: "Pipeline", Icono: TrendingUp },
];

/**
 * Barra de navegación de la app de campo.
 *
 * Abajo y no arriba: se usa con una mano, y el pulgar llega al borde inferior
 * de la pantalla, no a la cabecera.
 *
 * El ámbar del ítem activo es la regla de §17 en su otro significado: en el
 * cromo indica **identidad**, no riesgo. Es el único lugar de la aplicación
 * donde el ámbar no quiere decir "cuidado".
 */
export function Navegacion() {
  const ruta = usePathname();

  // La pantalla de entrada no tiene a dónde navegar.
  if (ruta === "/entrar") return null;

  return (
    <nav className="sticky bottom-0 mt-auto grid grid-cols-5 border-t border-borde bg-superficie">
      {RUTAS.map(({ href, etiqueta, Icono }) => {
        const activo =
          href === "/" ? ruta === "/" || ruta.startsWith("/prospectos") : ruta.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={[
              "min-h-tactil flex flex-col items-center justify-center gap-0.5 border-t-2 py-2 text-xs",
              activo
                ? "border-t-aviso text-marca font-medium"
                : "border-t-transparent text-texto-atenuado",
            ].join(" ")}
          >
            <Icono size={18} aria-hidden />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
