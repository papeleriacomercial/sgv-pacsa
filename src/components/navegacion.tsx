"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Gauge,
  Inbox,
  Radar,
  List,
  Map,
  Store,
  TrendingUp,
} from "lucide-react";

// Buscar sale de la barra: es la misma acción que el mapa —encontrar puntos
// nuevos— con otra forma de hacerla, y se llega desde ahí y desde una lista.
// El lugar que libera lo toma Listas, que es donde el vendedor planifica.
type Rol = "gerente" | "lider" | "vendedor" | "administracion";

type Ruta = { href: string; etiqueta: string; Icono: typeof Store };

/**
 * La barra cambia según el rol, porque los tres oficios no son el mismo.
 *
 * El vendedor de ruta casi nunca abre Oportunidades —vende en una o dos
 * visitas, y eso es un pedido, no una negociación— así que no se gana un lugar
 * permanente en su barra. Al líder sí: las ventas que tardan meses son su
 * trabajo principal.
 *
 * Administración solo atiende su bandeja y el maestro de clientes.
 */
const POR_ROL: Record<Rol, Ruta[]> = {
  vendedor: [
    { href: "/", etiqueta: "Agenda", Icono: CalendarDays },
    { href: "/listas", etiqueta: "Listas", Icono: List },
    { href: "/cuentas", etiqueta: "Cuentas", Icono: Store },
    { href: "/solicitudes", etiqueta: "Solicitudes", Icono: Inbox },
    { href: "/mapa", etiqueta: "Mapa", Icono: Map },
  ],
  // Mercado no entra a su barra: lo mira una vez al mes y le quitaría el Mapa,
  // que es donde arma sus listas de zona. Se llega desde Agenda · Mi semana.
  lider: [
    { href: "/", etiqueta: "Agenda", Icono: CalendarDays },
    { href: "/listas", etiqueta: "Listas", Icono: List },
    { href: "/oportunidades", etiqueta: "Ventas", Icono: TrendingUp },
    { href: "/cuentas", etiqueta: "Cuentas", Icono: Store },
    { href: "/mapa", etiqueta: "Mapa", Icono: Map },
  ],
  // Gerencia no registra nada: es el único rol que solo lee y decide. Su
  // pantalla es el tablero, y arranca ahí.
  gerente: [
    { href: "/tablero", etiqueta: "Tablero", Icono: Gauge },
    { href: "/solicitudes", etiqueta: "Solicitudes", Icono: Inbox },
    { href: "/mercado", etiqueta: "Mercado", Icono: Radar },
    { href: "/oportunidades", etiqueta: "Ventas", Icono: TrendingUp },
    { href: "/cuentas", etiqueta: "Cuentas", Icono: Store },
  ],
  administracion: [
    { href: "/solicitudes", etiqueta: "Solicitudes", Icono: Inbox },
    { href: "/cuentas", etiqueta: "Cuentas", Icono: Store },
    { href: "/mapa", etiqueta: "Mapa", Icono: Map },
  ],
};

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
export function Navegacion({ rol }: { rol?: Rol }) {
  const ruta = usePathname();

  // La pantalla de entrada no tiene a dónde navegar.
  if (ruta === "/entrar") return null;

  const rutas = POR_ROL[rol ?? "vendedor"];

  return (
    <nav
      className="sticky bottom-0 mt-auto grid border-t border-borde bg-superficie"
      style={{ gridTemplateColumns: `repeat(${rutas.length}, minmax(0, 1fr))` }}
    >
      {rutas.map(({ href, etiqueta, Icono }) => {
        // La Agenda es la raíz, así que solo se marca en la raíz exacta; si no
        // se encendería en todas las pantallas.
        const activo = href === "/" ? ruta === "/" : ruta.startsWith(href);

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
