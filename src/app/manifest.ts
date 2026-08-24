import type { MetadataRoute } from "next";

/**
 * Para cuando se instale en el teléfono del vendedor.
 *
 * `standalone` la abre sin barra de direcciones: en la calle, con una mano, el
 * cromo del navegador roba dos centímetros de pantalla y no aporta nada.
 *
 * El nombre corto es «SGV» porque es lo que cabe debajo del ícono; el largo
 * lleva el dueño, que es lo que se lee en la lista de aplicaciones.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SGV · Papelería Comercial",
    short_name: "SGV",
    description: "Sistema de Gestión de Ventas",
    lang: "es-PA",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#1d293d",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
