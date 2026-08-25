import { ShoppingBasket } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { AdoptarCadencia } from "@/components/adoptar-cadencia";
import { haceDias } from "@/lib/fechas";

export type Linea = {
  producto: string;
  veces: number;
  total: number;
  ultima_vez: string;
  dias_sin_pedirlo: number;
};

type Props = {
  cuentaId: string;
  ultimaCompra: string | null;
  diasSinComprar: number | null;
  compras12m: number | null;
  total12m: number | null;
  cadenciaObservada: number | null;
  cadenciaPuesta: number | null;
  dejoDeComprar: boolean | null;
  lineas: Linea[];
};

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Lo que la contabilidad sabe de esta cuenta, en la pantalla donde se decide
 * la visita.
 *
 * **Es la mitad que le faltaba al SGV.** La bitácora dice a quién se visitó;
 * esto dice quién compró. Un vendedor podía estar al día en visitas y
 * perdiendo al cliente sin que nada lo delatara.
 *
 * Lo que más vale es lo de abajo: **qué línea dejó de pedir**. «Le vendes
 * rollos y bolsas hace un año; las bolsas se las dejó de comprar en marzo» es
 * una conversación de venta concreta, y hasta ahora no la tenía nadie.
 */
export function QueCompra({
  cuentaId,
  ultimaCompra,
  diasSinComprar,
  compras12m,
  total12m,
  cadenciaObservada,
  cadenciaPuesta,
  dejoDeComprar,
  lineas,
}: Props) {
  // Sin una sola compra no hay nada que contar, y una tarjeta vacía diciendo
  // «—» tres veces es peor que no estar.
  if (!ultimaCompra) return null;

  // Cuánto lleva sin pedir cada línea, comparado contra el ritmo del cliente.
  // Sin ese contraste, «60 días» no dice nada: es normal en quien compra cada
  // dos meses y alarmante en quien compra cada semana.
  const umbral = (cadenciaObservada ?? 60) * 2;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-texto">
        <ShoppingBasket size={16} aria-hidden />
        Qué compra
      </h2>

      <Tarjeta
        className={`flex flex-col gap-3 ${dejoDeComprar ? "border-aviso/40" : ""}`}
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-texto-secundario">Última compra</p>
            <p
              className={`font-mono text-xl ${dejoDeComprar ? "text-aviso" : "text-texto"}`}
            >
              {diasSinComprar ?? "—"}
            </p>
            <p className="text-xs text-texto-atenuado">
              {diasSinComprar === null ? "" : "días"}
            </p>
          </div>
          <div>
            <p className="text-xs text-texto-secundario">Compras del año</p>
            <p className="font-mono text-xl text-texto">{compras12m ?? "—"}</p>
            <p className="text-xs text-texto-atenuado">
              {cadenciaObservada ? `cada ${cadenciaObservada} días` : "sin ritmo"}
            </p>
          </div>
          <div>
            <p className="text-xs text-texto-secundario">Vendido</p>
            <p className="font-mono text-xl text-texto">
              {total12m === null ? "—" : DINERO.format(total12m)}
            </p>
            <p className="text-xs text-texto-atenuado">12 meses</p>
          </div>
        </div>

        {/* No es lo mismo que «fuera de cadencia»: aquel mide si el vendedor lo
            visitó, este si el cliente compró. Se puede estar al día en visitas
            y perdiendo la cuenta. */}
        {dejoDeComprar && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Lleva más de lo que suele tardar en volver a comprar.
          </p>
        )}

        {cadenciaObservada !== null && (
          <AdoptarCadencia
            cuentaId={cuentaId}
            dias={cadenciaObservada}
            actual={cadenciaPuesta}
          />
        )}
      </Tarjeta>

      {lineas.length > 0 && (
        <Tarjeta className="flex flex-col gap-2">
          <p className="text-xs text-texto-secundario">
            Lo que le vendes, y cuándo fue la última vez
          </p>

          <ul className="flex flex-col divide-y divide-borde">
            {lineas.map((l) => {
              const abandonada = l.dias_sin_pedirlo > umbral;
              return (
                <li
                  key={l.producto}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-texto">
                      {l.producto}
                    </span>
                    <span className="text-xs text-texto-atenuado">
                      {l.veces} {l.veces === 1 ? "vez" : "veces"} ·{" "}
                      {DINERO.format(l.total)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      abandonada ? "font-medium text-aviso" : "text-texto-secundario"
                    }`}
                  >
                    {haceDias(l.dias_sin_pedirlo)}
                  </span>
                </li>
              );
            })}
          </ul>

          {lineas.some((l) => l.dias_sin_pedirlo > umbral) && (
            <p className="text-xs text-texto-atenuado">
              En ámbar, lo que lleva sin pedir mucho más de lo habitual en él.
            </p>
          )}
        </Tarjeta>
      )}
    </section>
  );
}
