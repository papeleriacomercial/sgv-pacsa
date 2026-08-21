import Link from "next/link";
import { TIPOS_CUENTA, TONO_TIPO, type TipoCuenta } from "@/lib/catalogos";
import { Insignia } from "@/components/ui/insignia";

type Props = {
  id: string;
  nombre: string;
  tipoComercio: string | null;
  tipo: TipoCuenta;
  potencial: number | null;
  ultimaInteraccion: string | null;
  enlazada?: boolean;
};

const FALTA = "text-texto-atenuado";

/**
 * Elemento firma del sistema (§17): un solo componente que representa un
 * cliente o prospecto y se ve **idéntico** en el mapa, en la lista de búsqueda,
 * en el plan del día y en el expediente. Es lo que hace que todo el sistema se
 * sienta uno solo.
 *
 * Las cinco líneas son fijas. Un dato que falta se muestra atenuado, nunca se
 * omite: si la ficha cambiara de alto según los datos, las listas dejarían de
 * poder escanearse de un vistazo.
 */
export function FichaPunto({
  id,
  nombre,
  tipoComercio,
  tipo,
  potencial,
  ultimaInteraccion,
  enlazada = true,
}: Props) {
  const contenido = (
    <div className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-semibold text-texto">{nombre}</p>
        <Insignia tono={TONO_TIPO[tipo]}>{TIPOS_CUENTA[tipo]}</Insignia>
      </div>

      <p className={`text-sm ${tipoComercio ? "text-texto-secundario" : FALTA}`}>
        {tipoComercio ?? "Tipo de comercio sin definir"}
      </p>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={potencial !== null ? "font-mono text-texto" : FALTA}>
          {potencial !== null ? `Potencial ${potencial}/5` : "Sin calificar"}
        </span>
        <span className={ultimaInteraccion ? "text-texto-secundario" : FALTA}>
          {ultimaInteraccion ?? "Sin interacciones"}
        </span>
      </div>
    </div>
  );

  if (!enlazada) return contenido;

  return (
    <Link href={`/cuentas/${id}`} className="block">
      {contenido}
    </Link>
  );
}
