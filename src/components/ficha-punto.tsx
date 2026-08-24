import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { TIPOS_CUENTA, TONO_TIPO, type TipoCuenta } from "@/lib/catalogos";
import { Insignia } from "@/components/ui/insignia";
import { esperaEnLista, ESPERA_LARGA } from "@/lib/fechas";

type Props = {
  id: string;
  nombre: string;
  tipoComercio: string | null;
  tipo: TipoCuenta;
  ultimaInteraccion: string | null;
  enlazada?: boolean;
  /**
   * Días que lleva el punto en su lista sin que nadie lo toque.
   *
   * Ocupa el mismo hueco que la última interacción, que en un potencial sin tocar
   * está vacío. Un potencial sin fecha es indistinguible de otro: no se sabe si se
   * levantó anteayer o si lleva dos meses ahí.
   */
  esperaDias?: number | null;
  /** Poblado o zona. Con la cartera mezclada es lo primero que se busca. */
  zona?: string | null;
  /**
   * Lista a la que pertenece.
   *
   * Para el líder es la identificación que manda: «Bancos y financieras» dice
   * qué es esa cuenta mucho mejor que el poblado de la sucursal.
   */
  lista?: string | null;
  /** De quién es. Solo cuando se está viendo la cartera de varios a la vez. */
  vendedor?: string | null;
  /**
   * Color de la dimensión que se esté usando para agrupar —vendedor, tipo,
   * zona—. Es el **mismo** que pinta el pin en el mapa: cambiar de vista no
   * cambia de código de colores.
   *
   * Nunca va solo (§17). Lo que el color agrupa está escrito en la propia
   * ficha —el vendedor en la línea de abajo, el tipo en la insignia— y la
   * leyenda de arriba lo nombra. El punto solo hace que se vea de un golpe
   * dónde termina una cartera y empieza la otra.
   */
  color?: string | null;
  /**
   * Qué datos faltan por averiguar. Ocupa el lugar de la zona.
   *
   * Un objetivo del líder no tiene zona —no está en el mapa hasta que se
   * sepa a qué oficina ir— y en cambio sí tiene una tarea pendiente:
   * conseguir el contacto, el teléfono, el correo. Eso es lo que hay que
   * leer en su tarjeta.
   */
  falta?: string | null;
};

const FALTA = "text-texto-atenuado";

/**
 * Elemento firma del sistema (§17): un solo componente que representa un
 * cliente o prospecto y se ve **idéntico** en el mapa, en la lista de búsqueda,
 * en el plan del día y en el expediente. Es lo que hace que todo el sistema se
 * sienta uno solo.
 *
 * Las tres líneas son fijas. Un dato que falta se muestra atenuado, nunca se
 * omite: si la ficha cambiara de alto según los datos, las listas dejarían de
 * poder escanearse de un vistazo.
 *
 * **Dónde queda cada cosa y por qué:**
 *
 * - Arriba, qué es —nombre y en qué punto del ciclo está—.
 * - En medio, de qué tipo de comercio y a qué lista pertenece.
 * - Abajo, **dónde queda y de quién es**, contra cuándo se le habló.
 *
 * La línea de abajo llevaba el puntaje 1–5 de §7.5, que se calcula desde la
 * facturación de Zoho y no está construido. Como el campo nunca llegó a la
 * base, todas las fichas decían «Sin calificar»: un tercio de la tarjeta
 * gastado en no decir nada, mientras la cartera se mezclaba sin que se
 * supiera si una cuenta era de Aguadulce o de Chitré.
 *
 * Ojo al volver a ponerlo: **«potencial» ya no es el nombre de ese puntaje**
 * sino el de una cuenta que nadie ha tocado (D-025). El puntaje se llama
 * puntaje.
 */
export function FichaPunto({
  id,
  nombre,
  tipoComercio,
  tipo,
  ultimaInteraccion,
  enlazada = true,
  esperaDias = null,
  zona = null,
  lista = null,
  vendedor = null,
  falta = null,
  color = null,
}: Props) {
  // La espera solo se muestra cuando no hay interacción: si ya lo tocaron, lo
  // que importa es cuándo, no cuánto esperó.
  const espera =
    ultimaInteraccion === null && esperaDias !== null ? esperaDias : null;

  // Regla del ámbar (§17): en los datos significa riesgo o dormido. Aquí es lo
  // segundo, y el umbral es el mismo con que `listas_resumen` cuenta los que
  // llevan mucho — si no, la lista diría «3 viejos» y ninguna ficha se vería
  // vieja.
  const dormido = espera !== null && espera >= ESPERA_LARGA;

  const contenido = (
    <div className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-baseline gap-2 text-base font-semibold text-texto">
          {color && (
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="truncate">{nombre}</span>
        </p>
        <Insignia tono={TONO_TIPO[tipo]}>{TIPOS_CUENTA[tipo]}</Insignia>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p
          className={`truncate text-sm ${tipoComercio ? "text-texto-secundario" : FALTA}`}
        >
          {tipoComercio ?? "Tipo de comercio sin definir"}
        </p>
        {lista && (
          <span className="max-w-[45%] shrink-0 truncate rounded-lg bg-fondo px-2 py-0.5 text-xs text-texto-secundario">
            {lista}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={`flex min-w-0 items-center gap-1 ${
            falta || !zona ? FALTA : "text-texto-secundario"
          }`}
        >
          {falta ? (
            <Search size={12} className="shrink-0" aria-hidden />
          ) : (
            <MapPin size={12} className="shrink-0" aria-hidden />
          )}
          <span className="truncate">
            {falta ?? zona ?? "Sin zona"}
            {!falta && vendedor && ` · ${vendedor}`}
          </span>
        </span>

        <span
          className={`shrink-0 ${
            dormido
              ? "font-medium text-aviso"
              : ultimaInteraccion || espera !== null
                ? "text-texto-secundario"
                : FALTA
          }`}
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
