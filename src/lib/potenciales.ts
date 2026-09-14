/**
 * Levantar potenciales desde el mapa.
 *
 * **Vive aparte de `listas.ts` porque lo usan pantallas del navegador**, y aquél importa el cliente
 * de servidor —que depende de `next/headers`— para cargar las listas. Juntos, cualquier componente
 * de cliente que tocara una de estas funciones se arrastraba el servidor entero al paquete y la
 * compilación se caía.
 */

/**
 * A dónde lleva «buscar puntos para esta lista».
 *
 * **Vive acá porque son dos pantallas las que ofrecen esa puerta** —el expediente de la lista y el
 * mapa— y estaban armando la dirección cada una por su lado.
 *
 * **Ya no lleva el área escrita, y es a propósito.** La llevaba desde el poblado de la lista, y
 * ese campo se eliminó el 13 de septiembre de 2026: guardaba el nombre del recorrido —«CALIDONIA
 * Y CENTARL»— y no un lugar, así que prellenar la búsqueda con él mandaba al vendedor a buscar un
 * pueblo que no existe (D-067).
 */
export function rutaDeBusqueda(listaId: string): string {
  return `/buscar?lista=${listaId}`;
}

/** Un punto del directorio de Google, listo para volverse potencial. */
export type PuntoElegido = {
  placeId: string;
  nombre: string;
  lat: number;
  lng: number;
};

/**
 * Crear potenciales a partir de puntos del mapa, y meterlos en la lista si hay una.
 *
 * **Vive acá porque son dos pantallas las que lo hacen**: el buscador de potenciales y el mapa de
 * una lista. Escribirlo dos veces es cómo se llega a que una de las dos olvide heredar el poblado, o
 * ponga `tipo` y convierta en prospecto lo que es un potencial.
 *
 * Devuelve el mensaje de error, o `null` si todo entró.
 */
export async function crearPotenciales({
  puntos,
  vendedorId,
  listaId,
}: {
  puntos: PuntoElegido[];
  vendedorId: string;
  listaId: string | null;
}): Promise<string | null> {
  if (puntos.length === 0) return null;

  const { clienteNavegador } = await import("@/lib/supabase/navegador");
  const supabase = clienteNavegador();

  // **AQUÍ SE HEREDABA EL POBLADO DE LA LISTA, Y ERA EL DEFECTO.** Cada punto que entraba desde
  // una lista se llevaba su nombre como ubicación, así que dieciséis cuentas quedaron diciendo
  // que vivían en un pueblo llamado «CALIDONIA Y CENTARL» — repartidas, en la realidad, por diez
  // corregimientos y cuatro provincias.
  //
  // Se eliminó el 13 de septiembre de 2026 (D-067). La ubicación sale del punto marcado en el
  // mapa, que es un hecho, y no del nombre de la lista por la que entró, que es una etiqueta.
  const filas = puntos.map((p) => ({
    id: crypto.randomUUID(),
    nombre: p.nombre,
    place_id: p.placeId,
    lat: p.lat,
    lng: p.lng,
    origen: "busqueda",
    vendedor_id: vendedorId,
    // **Sin `tipo`: entran como potenciales.** Levantarlas en tanda desde el directorio no las
    // convierte en prospectos — un prospecto es un potencial que ya se visitó (D-015).
  }));

  const { error: fallo } = await supabase.from("cuentas").insert(filas);
  if (fallo) return fallo.message;

  // Si venía armando una lista, los recién creados entran ahí. Sin esto los cincuenta puntos del
  // domingo caerían sueltos en la cartera, que es el problema que las listas existen para resolver.
  if (listaId) {
    const { error: falloLista } = await supabase
      .from("listas_cuentas")
      .insert(filas.map((f) => ({ lista_id: listaId, cuenta_id: f.id })));

    if (falloLista) {
      return `Las cuentas quedaron creadas, pero no entraron a la lista: ${falloLista.message}`;
    }
  }

  return null;
}
