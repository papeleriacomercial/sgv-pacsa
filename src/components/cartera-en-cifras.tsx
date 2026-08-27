import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { Barra } from "@/components/barras";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export type ClienteRanking = {
  contactoId: string;
  nombre: string;
  cuentaId: string | null;
  total: number;
  porCobrar: number;
  documentos: number;
  ultimaCompra: string;
};

export type LineaVendida = {
  linea: string;
  total: number;
  clientes: number;
};

/** Por encima de esto, un solo cliente sostiene demasiado de la cartera. */
const CONCENTRADO = 0.3;

/**
 * La cartera de un vendedor en cifras: quién le compra y qué le compra.
 *
 * **Es la misma pregunta que se hace gerencia, hecha a la escala del vendedor.**
 * A gerencia le dice de quién depende la empresa; a él le dice a quién tiene que
 * cuidar, y qué rubro no está desarrollando.
 *
 * Doce meses móviles y no año calendario, a propósito: al vendedor el ejercicio
 * fiscal le da igual — lo que quiere saber es cómo viene su último año de
 * trabajo, hoy.
 *
 * Las dos cifras que de verdad cambian una conducta:
 *
 * - **Cuánto pesa su cliente más grande.** Si uno solo es el 40 %, ese cliente
 *   no es un cliente: es la mitad de su sueldo, y perderlo no se compensa con
 *   diez pequeños.
 * - **Qué línea no vende.** Un vendedor que mueve rollos y bolsas y nunca tubos
 *   no es que tenga mala suerte: es que no los ofrece.
 */
export function CarteraEnCifras({
  clientes,
  lineas,
  deQuien,
}: {
  clientes: ClienteRanking[];
  lineas: LineaVendida[];
  /** Null cuando es la propia. Con nombre cuando el líder mira a alguien. */
  deQuien: string | null;
}) {
  const total = clientes.reduce((s, c) => s + c.total, 0);

  if (clientes.length === 0) {
    return (
      <Tarjeta>
        <Vacio titulo="Todavía no hay facturación">
          Aparece sola cuando la oficina factura o despacha. Si acabas de
          empezar, tarda un mes en decir algo.
        </Vacio>
      </Tarjeta>
    );
  }

  const primeros = clientes.slice(0, 10);
  const cincoPrimeros = clientes.slice(0, 5).reduce((s, c) => s + c.total, 0);
  const mayor = clientes[0];
  const concentrado = mayor.total / total >= CONCENTRADO;

  const totalLineas = lineas.reduce((s, l) => s + l.total, 0);
  const faltan = total - totalLineas;
  const conVenta = lineas.filter((l) => l.linea !== "otros" && l.total > 0);
  const sinVender = (Object.keys(LINEAS_PRODUCTO) as LineaProducto[]).filter(
    (l) => l !== "otros" && !conVenta.some((x) => x.linea === l),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* --- De quién depende --- */}
      <Tarjeta className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <p className="text-sm text-texto-secundario">
              {deQuien ? `Cartera de ${deQuien}` : "Tu cartera"} · 12 meses
            </p>
            <p className="text-xs text-texto-atenuado">sin ITBMS</p>
          </div>
          <p className="font-mono text-2xl text-texto">{DINERO.format(total)}</p>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-3 text-sm">
          <span className="text-texto-secundario">Clientes que compraron</span>
          <span className="font-mono text-texto">{clientes.length}</span>
        </div>

        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-texto-secundario">Los cinco primeros pesan</span>
          <span className="font-mono text-texto">
            {Math.round((cincoPrimeros / total) * 100)}%
          </span>
        </div>

        {/* No es un regaño: es un hecho que cambia a quién se visita el lunes. */}
        {concentrado && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            <strong>{mayor.nombre}</strong> es el{" "}
            {Math.round((mayor.total / total) * 100)}% de tu facturación. Es el
            cliente que más cuidado necesita, y el que más duele perder.
          </p>
        )}
      </Tarjeta>

      {/* --- Quién compra --- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-texto">
          Quién te compra más
        </h2>
        {primeros.map((c) => {
          const cuerpo = (
            <Tarjeta className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-texto">
                  {c.nombre}
                </p>
                <p className="shrink-0 font-mono text-sm text-texto">
                  {DINERO.format(c.total)}
                </p>
              </div>
              <Barra
                partes={[{ valor: c.total, tono: "marca" }]}
                techo={mayor.total}
              />
              <div className="flex items-baseline justify-between gap-2 text-xs text-texto-atenuado">
                <span>
                  {c.documentos} {c.documentos === 1 ? "compra" : "compras"}
                  {c.porCobrar > 0 &&
                    ` · ${DINERO.format(c.porCobrar)} por cobrar`}
                </span>
                <span className="font-mono">
                  {Math.round((c.total / total) * 100)}%
                </span>
              </div>
            </Tarjeta>
          );

          return c.cuentaId ? (
            <Link key={c.contactoId} href={`/cuentas/${c.cuentaId}`} className="block">
              {cuerpo}
            </Link>
          ) : (
            <div key={c.contactoId}>{cuerpo}</div>
          );
        })}
      </section>

      {/* --- Qué compra --- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-texto">Qué le vendes</h2>
        <Tarjeta className="flex flex-col gap-2">
          {conVenta.map((l) => (
            <div key={l.linea} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-texto">
                  {LINEAS_PRODUCTO[l.linea as LineaProducto] ?? l.linea}
                </span>
                <span className="font-mono text-texto">
                  {DINERO.format(l.total)} ·{" "}
                  {Math.round((l.total / totalLineas) * 100)}%
                </span>
              </div>
              <Barra
                partes={[{ valor: l.total, tono: "marca" }]}
                techo={conVenta[0].total}
              />
              <p className="text-xs text-texto-atenuado">
                {l.clientes} {l.clientes === 1 ? "cliente" : "clientes"}
              </p>
            </div>
          ))}

          <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-2 text-sm">
            <span className="text-texto-secundario">Total</span>
            <span className="font-mono text-texto">
              {DINERO.format(totalLineas)}
            </span>
          </div>

          {/* **La línea que falta dice más que las que están.** Un vendedor que
              mueve rollos y bolsas y nunca tubos no tiene mala suerte: no los
              ofrece. */}
          {sinVender.length > 0 && (
            <p className="rounded-lg bg-fondo p-2 text-xs text-texto-secundario">
              No has vendido{" "}
              <strong>
                {sinVender
                  .map((l) => LINEAS_PRODUCTO[l].toLowerCase())
                  .join(" ni ")}
              </strong>{" "}
              en todo el año.
            </p>
          )}

          {/* **Este total nunca va a ser igual al de arriba, y hay que
              decirlo.** Arriba está lo que se cobró, con el ITBMS adentro;
              aquí lo que se vendió, sin él. Callarlo hace que la primera
              reacción sea que la pantalla suma mal — y quien piensa eso una
              vez deja de creerle a la pantalla entera.

              Cuando además falta detalle por cargar, la diferencia se
              dispara muy por encima del 7 % del impuesto, y entonces se
              dicen las dos cosas. */}
          {/* **Las dos cifras están ahora en la misma unidad** —las dos sin
              ITBMS— así que tienen que cuadrar. Si no cuadran es que falta
              detalle por traer de Zoho, y eso sí hay que decirlo. */}
          {faltan > total * 0.05 && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              Faltan {DINERO.format(faltan)} de los{" "}
              {DINERO.format(total)} de arriba: es detalle de compra que
              todavía no se ha traído de Zoho. Se completa solo.
            </p>
          )}
        </Tarjeta>

      </section>
    </div>
  );
}
