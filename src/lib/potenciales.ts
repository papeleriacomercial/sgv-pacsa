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
 * mapa— y estaban armando la dirección cada una por su lado. La del expediente mandaba el poblado
 * en `q`, la del mapa no, así que llegar por el mapa abría la búsqueda **con el campo del área en
 * blanco**: el vendedor tenía que volver a escribir «Aguadulce» para la lista que se llama
 * Aguadulce. Lo reportó el equipo de ventas el 11 de septiembre de 2026.
 *
 * Dos pantallas que construyen la misma dirección por separado se separan; una sola no puede.
 */
export function rutaDeBusqueda(
  listaId: string,
  poblado: string | null | undefined,
): string {
  const base = `/buscar?lista=${listaId}`;
  return poblado ? `${base}&q=${encodeURIComponent(poblado)}` : base;
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

  // **EL POBLADO SE LEE ACÁ Y NO LLEGA COMO PARÁMETRO.** Es un dato de la lista, y que cada
  // pantalla lo traiga por su cuenta es exactamente cómo una de las dos termina creando
  // cuentas sin zona — que fue lo que pasó al abrir el mapa desde una lista.
  const poblado = listaId
    ? ((
        await supabase
          .from("listas")
          .select("poblado")
          .eq("id", listaId)
          .maybeSingle()
      ).data?.poblado ?? null)
    : null;

  const filas = puntos.map((p) => ({
    id: crypto.randomUUID(),
    nombre: p.nombre,
    place_id: p.placeId,
    lat: p.lat,
    lng: p.lng,
    origen: "busqueda",
    vendedor_id: vendedorId,
    // El poblado de la lista se hereda: si no, las cuentas nacen sin zona y los filtros de la
    // cartera por poblado no encuentran nada.
    poblado,
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
