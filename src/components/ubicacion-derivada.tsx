import { MapPin } from "lucide-react";

/**
 * Dónde queda la cuenta, de solo lectura.
 *
 * **Nadie la escribe, y ése es el punto** (D-067). Sale del punto marcado en el mapa, calculada
 * contra los límites oficiales de Panamá que viven en la base. Antes se tecleaba, y así es como
 * dieciséis cuentas terminaron diciendo que vivían en un pueblo llamado «CALIDONIA Y CENTARL»
 * —el nombre de una lista— estando repartidas en diez corregimientos y cuatro provincias.
 *
 * **Se enseña aunque no se pueda tocar**, y no es decorativo: es lo que le dice al vendedor que
 * marcar el punto sirvió, y lo que le permite darse cuenta si lo marcó en la cuadra equivocada.
 * Un campo derivado que no se ve es un campo en el que nadie confía.
 *
 * Sin punto no dice «desconocido» sino qué hacer. Son 207 cuentas en esa situación, y ninguna se
 * arregla sola.
 */
export function UbicacionDerivada({
  provincia,
  distrito,
  corregimiento,
  tienePunto,
}: {
  provincia: string | null;
  distrito: string | null;
  corregimiento: string | null;
  tienePunto: boolean;
}) {
  return (
    <div className="rounded-lg border border-borde bg-fondo p-3">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="shrink-0 text-texto-atenuado" aria-hidden />
        <p className="text-sm font-medium text-texto">Dónde queda</p>
      </div>

      {distrito ? (
        <>
          <p className="mt-1 text-sm text-texto">
            {corregimiento}
            {corregimiento !== distrito && (
              <span className="text-texto-secundario"> · distrito de {distrito}</span>
            )}
          </p>
          <p className="text-xs text-texto-atenuado">
            Provincia de {provincia} · sale del punto en el mapa, no se escribe
          </p>
        </>
      ) : tienePunto ? (
        // El punto existe pero cae fuera de los límites de Panamá. Es raro y conviene decirlo:
        // casi siempre significa que se marcó mal, no que el negocio esté en otro país.
        <p className="mt-1 text-sm text-texto-secundario">
          El punto marcado no cae dentro de Panamá. Revisa que esté en el sitio correcto.
        </p>
      ) : (
        <p className="mt-1 text-sm text-texto-secundario">
          Marca el punto en el mapa, aquí arriba, y la ubicación aparece sola.
        </p>
      )}
    </div>
  );
}
