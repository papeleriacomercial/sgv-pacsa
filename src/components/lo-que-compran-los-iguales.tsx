import { Users } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export type Gemelos = {
  tipo: string;
  clientes: number;
  mensualBajo: number;
  mensualTipico: number;
  mensualAlto: number;
  cadenciaTipica: number | null;
};

/**
 * El modelo de gemelos de §7.5, en la pantalla donde se decide la visita.
 *
 * **Es lo que convierte un punto del mapa en una expectativa.** Una panadería
 * de pueblo y un minisúper de cinco cajas se ven idénticos en un mapa; esto
 * dice cuánto compra un comercio de ese tipo, y de dónde sale el número.
 *
 * Sirve para dos preguntas distintas según la cuenta:
 *
 * - **Sin historia de compra** —un prospecto— contesta *cuánto podría comprar*.
 *   Es el caso para el que se construyó.
 * - **Con historia** contesta *si está comprando lo que le toca*. Un cliente que
 *   compra por debajo de todos sus iguales no es un cliente pequeño: puede ser
 *   una venta a medio hacer.
 *
 * **Dice un rango y no una cifra**, y esa es la decisión que sostiene todo lo
 * demás. Entre el cuartil de abajo y el de arriba hay de tres a veintisiete
 * veces según el tipo: no son datos sucios, es que los comercios del mismo
 * rubro de verdad compran cantidades muy distintas. Una sola cifra daría por
 * típico lo que no lo es, y el vendedor que entra a la panadería de $75 y el
 * que entra a la de $7 recibirían el mismo número sin reconocerlo ninguno.
 *
 * El porqué del rango, de la mediana y del piso de cinco clientes está en
 * docs/05-modulos/7.5-calificacion-de-prospectos.md.
 */
export function LoQueCompranLosIguales({
  gemelos,
  mensualPropio,
}: {
  gemelos: Gemelos | null;
  /** Lo que compra esta cuenta al mes. Nulo si nunca compró. */
  mensualPropio: number | null;
}) {
  if (!gemelos) return null;

  // Se nombra el tipo como etiqueta y no dentro de la frase —«la mitad de los
  // panaderia»— porque las categorías las escriben los vendedores y vienen en
  // cualquier género y número. Concordar con eso no se puede; esquivarlo, sí.
  const dentro =
    mensualPropio !== null &&
    mensualPropio >= gemelos.mensualBajo &&
    mensualPropio <= gemelos.mensualAlto;

  const debajo = mensualPropio !== null && mensualPropio < gemelos.mensualBajo;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-texto">
        <Users size={16} aria-hidden />
        Lo que compran los de su tipo
      </h2>

      <Tarjeta className="flex flex-col gap-2">
        <p className="text-sm text-texto">
          <strong>{gemelos.tipo}</strong> — la mitad compra entre{" "}
          <strong className="font-mono">
            {DINERO.format(gemelos.mensualBajo)}
          </strong>{" "}
          y{" "}
          <strong className="font-mono">
            {DINERO.format(gemelos.mensualAlto)}
          </strong>{" "}
          al mes
          {gemelos.cadenciaTipica !== null && (
            <>
              , cada{" "}
              <strong className="font-mono">{gemelos.cadenciaTipica}</strong>{" "}
              días
            </>
          )}
          .
        </p>

        {mensualPropio !== null && (
          <p className={`text-sm ${debajo ? "text-aviso" : "text-texto-secundario"}`}>
            {/* No se dice «está mal»: se dice el hecho y se deja la lectura a
                quien conoce el local. Un minisúper de esquina que compra poco
                puede estar comprando todo lo que puede. */}
            Este compra{" "}
            <span className="font-mono">{DINERO.format(mensualPropio)}</span>
            {dentro
              ? " — dentro de lo normal para su tipo."
              : debajo
                ? " — por debajo de sus iguales."
                : " — por encima de sus iguales."}
          </p>
        )}

        {/* De dónde sale el número. Sin esto es una afirmación; con esto es un
            dato que se puede discutir — y un dato que no se puede discutir
            termina por no creerse. */}
        <p className="text-xs text-texto-atenuado">
          Sale de {gemelos.clientes} clientes de este tipo que compraron en los
          últimos doce meses. Es un rango y no una cifra porque entre el que
          menos compra y el que más hay mucha diferencia.
        </p>
      </Tarjeta>
    </section>
  );
}
