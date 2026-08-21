/**
 * Marcadores del mapa.
 *
 * Un círculo pequeño se pierde entre los íconos que Google dibuja en sus
 * propios comercios. El marcador propio tiene que ganarle a ese ruido: por eso
 * es una gota grande, con borde blanco grueso y sombra.
 */

const ANCHO = 34;
const ALTO = 44;

function svgPin(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 34 44">
    <path d="M17 42.5C17 42.5 32.5 24.8 32.5 16.5A15.5 15.5 0 1 0 1.5 16.5C1.5 24.8 17 42.5 17 42.5Z"
      fill="${color}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="17" cy="16.5" r="5.5" fill="#ffffff"/>
  </svg>`;
}

export type IconoMarcador = {
  url: string;
  scaledSize?: google.maps.Size;
  anchor?: google.maps.Point;
};

/**
 * Devuelve el ícono para un marcador de Google Maps.
 *
 * El ancla va en la punta de la gota, no en su centro: el punto que señala es
 * la esquina del local, no el globo que flota encima.
 */
export function iconoPin(color: string): IconoMarcador {
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svgPin(color))}`;

  // `google` solo existe después de que cargue la librería. Los marcadores se
  // dibujan siempre dentro del mapa, así que a esa altura ya está, pero la
  // comprobación evita que un render temprano rompa la pantalla.
  if (typeof google === "undefined" || !google.maps) return { url };

  return {
    url,
    scaledSize: new google.maps.Size(ANCHO, ALTO),
    anchor: new google.maps.Point(ANCHO / 2, ALTO),
  };
}

/** Colores de estado, tomados de los mismos tokens del sistema de diseño. */
export const COLOR = {
  marca: "#1d293d",
  atenuado: "#90a1b9",
  info: "#155dfc",
  aviso: "#fe9a00",
  ok: "#00a63e",
  error: "#e7000b",
} as const;
