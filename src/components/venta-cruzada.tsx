import { Layers } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";
import { haceDias } from "@/lib/fechas";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export type Cruce = {
  linea: string;
  laCompra: boolean;
  gastoMensual: number;
  diasSinPedirla: number | null;
  paresCompran: number;
  paresTotales: number;
  gastoTipico: number | null;
  suficiente: boolean;
};

/**
 * Cuántos de cada diez comercios iguales compran la línea para que valga la
 * pena mencionarla.
 *
 * **La proporción es lo que separa una oportunidad de un capricho.** Que una
 * panadería no compre tubos de cartón no dice nada si ninguna panadería los
 * compra; que no compre rollos cuando ocho de cada diez sí, es una visita.
 *
 * Por debajo de la mitad la línea sigue apareciendo pero apagada: puede que el
 * vendedor sepa algo que la estadística no, y esconderla se lo impediría.
 */
const FUERTE = 0.5;

function etiqueta(linea: string): string {
  return LINEAS_PRODUCTO[linea as LineaProducto] ?? linea;
}

/** «8 de cada 10», que es como se dice en la calle. */
function deCada10(compran: number, total: number): number {
  return Math.round((compran / total) * 10);
}

/**
 * Qué le falta comprar a este cliente, contra lo que compran los de su tipo.
 *
 * **Es la conversación de venta más barata que existe**: un cliente que ya te
 * conoce, ya te compra y ya te paga, al que le estás vendiendo una sola de las
 * cuatro cosas que fabricas.
 *
 * Sustituyó a la tarjeta que decía cuánto gasta al mes un comercio parecido.
 * Aquel número era cierto y no servía para nada: decía el tamaño del cliente,
 * no qué hacer el martes por la mañana.
 *
 * En una cuenta sin compras —un prospecto— la misma tarjeta contesta la otra
 * pregunta: qué compra la gente de este rubro, que es con lo que se prepara la
 * primera visita.
 */
export function VentaCruzada({ cruce }: { cruce: Cruce[] }) {
  // Sin pares suficientes no hay proporción que enseñar, y una tarjeta que
  // dice «0 de cada 0» es peor que no estar.
  const util = cruce.filter((c) => c.suficiente && c.paresTotales > 0);
  if (util.length === 0) return null;

  const compra = util.filter((c) => c.laCompra);
  // Solo se ofrece lo que algún par compra: proponer una línea que no compra
  // nadie del rubro es mandar al vendedor a perder el viaje.
  const falta = util.filter((c) => !c.laCompra && c.paresCompran > 0);

  if (falta.length === 0 && compra.length === 0) return null;

  const nuevo = compra.length === 0;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-texto">
        <Layers size={16} aria-hidden />
        {nuevo ? "Qué compran los de su tipo" : "Lo que no te compra"}
      </h2>

      {falta.length > 0 && (
        <Tarjeta className="flex flex-col gap-3">
          {falta.map((c) => {
            const cuantos = deCada10(c.paresCompran, c.paresTotales);
            const fuerte = c.paresCompran / c.paresTotales >= FUERTE;

            return (
              <div
                key={c.linea}
                className={`flex flex-col gap-1 ${fuerte ? "" : "opacity-60"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`text-sm ${fuerte ? "font-medium text-texto" : "text-texto-secundario"}`}
                  >
                    {etiqueta(c.linea)}
                  </p>
                  {c.gastoTipico !== null && c.gastoTipico > 0 && (
                    <p className="shrink-0 font-mono text-sm text-texto-secundario">
                      ~{DINERO.format(c.gastoTipico)}/mes
                    </p>
                  )}
                </div>

                {/* La barra dice de un vistazo si es una oportunidad de verdad
                    o una casualidad. El número solo obliga a comparar de
                    cabeza contra los otros tres renglones. */}
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-fondo"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full ${fuerte ? "bg-ok" : "bg-borde"}`}
                    style={{ width: `${(c.paresCompran / c.paresTotales) * 100}%` }}
                  />
                </div>

                <p className="text-xs text-texto-atenuado">
                  {cuantos} de cada 10 lo compran
                  {c.gastoTipico !== null && c.gastoTipico > 0 && (
                    <> y gastan eso al mes</>
                  )}
                  .
                </p>
              </div>
            );
          })}
        </Tarjeta>
      )}

      {compra.length > 0 && (
        <Tarjeta className="flex flex-col gap-2">
          <p className="text-xs font-medium text-texto-secundario">
            Ya te compra
          </p>
          {compra.map((c) => (
            <div key={c.linea} className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-texto">
                {etiqueta(c.linea)}
              </p>
              <p className="shrink-0 font-mono text-sm text-texto">
                {DINERO.format(c.gastoMensual)}/mes
              </p>
            </div>
          ))}
          {/* Una línea que dejó de pedirse es la otra mitad de la venta
              cruzada: recuperar lo que ya compraba cuesta menos que abrir algo
              nuevo. */}
          {compra
            .filter((c) => c.diasSinPedirla !== null && c.diasSinPedirla > 90)
            .map((c) => (
              <p key={`${c.linea}-viejo`} className="text-xs text-aviso">
                {etiqueta(c.linea)}: no lo pide desde{" "}
                {haceDias(c.diasSinPedirla!).toLowerCase()}.
              </p>
            ))}
        </Tarjeta>
      )}

      <p className="text-xs text-texto-atenuado">
        Comparado con los {util[0].paresTotales} clientes del mismo tipo de
        comercio que compran algo.
      </p>
    </section>
  );
}
