/**
 * Barras para comparar magnitudes, sin librería de gráficos.
 *
 * **Una librería de gráficos para esto sería medio megabyte** para dibujar
 * rectángulos que el navegador ya sabe dibujar. Y traería su propia paleta,
 * sus propias tipografías y su propio idioma para las cifras — tres cosas que
 * este sistema ya decidió (§17).
 *
 * Las barras nunca van solas: al lado siempre está el número. La barra es para
 * ver de un golpe quién está lejos de quién; el número es el dato.
 */

type Tono = "marca" | "ok" | "aviso" | "atenuado";

const FONDO: Record<Tono, string> = {
  marca: "bg-marca",
  ok: "bg-ok",
  aviso: "bg-aviso",
  atenuado: "bg-borde",
};

export type Parte = { valor: number; tono: Tono };

/**
 * Una barra, que puede llevar varios tramos apilados.
 *
 * `techo` es contra qué se mide — normalmente el mayor de la serie— para que
 * todas las barras de una lista sean comparables entre sí. Sin un techo común,
 * cada barra estaría llena y no se compararía nada.
 */
export function Barra({
  partes,
  techo,
  atenuada = false,
}: {
  partes: Parte[];
  techo: number;
  /** Para un dato incompleto, como el mes en curso. */
  atenuada?: boolean;
}) {
  const base = Math.max(techo, 1);

  return (
    <div
      className={`flex h-2 overflow-hidden rounded-full bg-fondo ${atenuada ? "opacity-50" : ""}`}
      aria-hidden
    >
      {partes.map((p, i) => (
        <div
          key={i}
          className={FONDO[p.tono]}
          style={{ width: `${Math.min(100, (p.valor / base) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Un reparto que suma cien: dos o tres partes de un mismo todo.
 *
 * Lleva su propia leyenda porque **el color nunca va solo** (§17): abajo se
 * escribe qué es cada tramo, con su monto y su porcentaje.
 */
export function Comparativa({
  partes,
}: {
  partes: { etiqueta: string; valor: number; tono: Tono }[];
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-fondo" aria-hidden>
        {partes.map((p) => (
          <div
            key={p.etiqueta}
            className={FONDO[p.tono]}
            style={{ width: `${(p.valor / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {partes.map((p) => (
          <div
            key={p.etiqueta}
            className="flex items-baseline justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-texto-secundario">
              <span
                aria-hidden
                className={`inline-block size-2.5 shrink-0 rounded-full ${FONDO[p.tono]}`}
              />
              {p.etiqueta}
            </span>
            <span className="font-mono text-texto">
              {new Intl.NumberFormat("es-PA", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(p.valor)}{" "}
              · {Math.round((p.valor / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
