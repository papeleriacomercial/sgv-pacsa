import Link from "next/link";

export type Vendedor = { id: string; nombre: string };

/**
 * De quién es lo que se está mirando.
 *
 * **Es la primera pregunta de quien ve más de una cartera**, y por eso va
 * arriba de todo y no escondida en un panel: el líder que abre Ventas y ve
 * cuarenta oportunidades sin saber de quién son no está mirando datos, está
 * mirando una mezcla.
 *
 * El propio va primero y dice «(tú)». No es cortesía: el líder también vende, y
 * confundir su cartera con la del equipo es el error que esta pantalla existe
 * para evitar.
 *
 * Se resuelve con enlaces y no con estado porque la elección tiene que
 * sobrevivir a recargar, a compartir la dirección y al botón de volver.
 */
export function FiltroVendedor({
  vendedores,
  elegido,
  yo,
  href,
}: {
  vendedores: Vendedor[];
  /** Id del vendedor elegido, o "todos". */
  elegido: string;
  yo: string;
  href: (valor: string) => string;
}) {
  if (vendedores.length < 2) return null;

  // El propio de primero, el resto por nombre.
  const orden = [...vendedores].sort((a, b) =>
    a.id === yo ? -1 : b.id === yo ? 1 : a.nombre.localeCompare(b.nombre, "es"),
  );

  const opciones = [
    ...orden.map((v) => ({
      valor: v.id,
      // Solo el nombre de pila: en una fila de chips, «Christopher Guerra»
      // empuja a los demás fuera de la pantalla.
      etiqueta: v.id === yo ? "Mis ventas" : v.nombre.split(" ")[0],
    })),
    { valor: "todos", etiqueta: "Todo el equipo" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-borde bg-superficie px-4 py-2">
      {opciones.map(({ valor, etiqueta }) => {
        const activo = valor === elegido;
        return (
          <Link
            key={valor}
            href={href(valor)}
            aria-current={activo ? "true" : undefined}
            className={`min-h-tactil flex shrink-0 items-center rounded-lg border px-3 text-sm ${
              activo
                ? "border-marca bg-marca text-white"
                : "border-borde text-texto"
            }`}
          >
            {etiqueta}
          </Link>
        );
      })}
    </div>
  );
}
