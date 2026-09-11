import { Eye } from "lucide-react";

/**
 * Abrir Street View en Google Maps, parado frente al local.
 *
 * Lo pidió el usuario el 11 de septiembre de 2026, después de comparar las tres formas posibles.
 * Ganó ésta y por dos razones que conviene dejar escritas, porque el día que alguien quiera
 * "mejorarla" metiendo el mapa adentro va a estar deshaciendo una decisión, no arreglando un
 * descuido:
 *
 * **ES EL STREET VIEW COMPLETO, no una foto.** El vendedor camina la cuadra, gira, se acerca — y
 * en la aplicación que ya sabe usar. Meter un panorama dentro del SGV daría lo mismo y costaría
 * $14 por cada mil aperturas pasadas las diez mil gratis del mes.
 *
 * **Y NO SE FACTURA NADA, NUNCA.** Estas direcciones de Google Maps son públicas: no llevan llave
 * ni pasan por la cuenta de la empresa. No hay cuota que gastar ni consumo que vigilar.
 *
 * **`target="_blank"` NO ES UN DETALLE.** Sin eso, el SGV se descarga para dar paso a Google Maps y
 * al volver el vendedor pierde lo que llevaba marcado — quince puntos de una lista a medio armar.
 * Con la pestaña aparte, la pantalla del SGV queda intacta esperándolo.
 */
export function VerLaFachada({
  lat,
  lng,
  className = "mt-1 flex items-center gap-1 text-xs font-medium underline",
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  return (
    <a
      href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <Eye size={14} aria-hidden />
      Ver la fachada
    </a>
  );
}
