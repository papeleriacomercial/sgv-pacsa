import Link from "next/link";
import { TIPOS_CUENTA, TONO_TIPO, type TipoCuenta } from "@/lib/catalogos";
import { Insignia } from "@/components/ui/insignia";
import { esperaEnLista, ESPERA_LARGA } from "@/lib/fechas";

type Props = {
  id: string;
  nombre: string;
  tipoComercio: string | null;
  tipo: TipoCuenta;
  potencial: number | null;
  ultimaInteraccion: string | null;
  enlazada?: boolean;
  /**
   * Días que lleva el punto en su lista sin que nadie lo toque.
   *
   * Ocupa el mismo hueco que la última interacción, que en un lead sin tocar
   * está vacío. Un lead sin fecha es indistinguible de otro: no se sabe si se
   * levantó anteayer o si lleva dos meses ahí.
   */
  esperaDias?: number | null;
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
  esperaDias = null,
}: Props) {
  // La espera solo se muestra cuando no hay interacción: si ya lo tocaron,
  // lo que importa es cuándo, no cuánto esperó.
  const espera =
    ultimaInteraccion === null && esperaDias !== null ? esperaDias : null;

  // Regla del ámbar (§17): en los datos significa riesgo o dormido. Aquí es
  // lo segundo, y el umbral es el mismo con que `listas_resumen` cuenta los
  // que llevan mucho — si no, la lista diría «3 viejos» y ninguna ficha se
  // vería vieja.
  const dormido = espera !== null && espera >= ESPERA_LARGA;
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
        <span
          className={
            dormido
              ? "font-medium text-aviso"
              : ultimaInteraccion || espera !== null
                ? "text-texto-secundario"
                : FALTA
          }
        >
          {ultimaInteraccion ??
            (espera !== null ? esperaEnLista(espera) : "Sin interacciones")}
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
