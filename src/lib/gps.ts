export type Ubicacion = {
  lat: number;
  lng: number;
  precisionM: number;
};

/**
 * Lee la ubicación del dispositivo.
 *
 * Devuelve `null` si el GPS no engancha, en vez de lanzar. Es deliberado: el
 * GPS falla a diario —adentro de un local con techo de zinc, en un centro
 * comercial, con el celular recién encendido— y bloquear el guardado por eso
 * convierte una falla de señal en trabajo perdido. El registro se guarda
 * marcado como `sin_gps`, visible para gerencia.
 *
 * La precisión se devuelve siempre: una lectura de 2.000 metros no es lo mismo
 * que una de 8, y sin ese número las dos se ven idénticas en el mapa (§10).
 */
export function obtenerUbicacion(esperaMs = 8000): Promise<Ubicacion | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition(
      (posicion) =>
        resolver({
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
          precisionM: Math.round(posicion.coords.accuracy),
        }),
      () => resolver(null),
      {
        enableHighAccuracy: true,
        timeout: esperaMs,
        maximumAge: 30000,
      },
    );
  });
}

/** Qué tan confiable es la lectura, para mostrarla sin hablar de metros. */
export function calidadUbicacion(precisionM: number): {
  tono: "ok" | "aviso" | "error";
  texto: string;
} {
  if (precisionM <= 20) return { tono: "ok", texto: "Ubicación precisa" };
  if (precisionM <= 100)
    return { tono: "aviso", texto: `Ubicación aproximada (${precisionM} m)` };
  return { tono: "error", texto: `Ubicación imprecisa (${precisionM} m)` };
}
