"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ETAPAS, type Etapa } from "@/lib/catalogos";

export type Punto = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  etapa: Etapa;
  tipoComercio: string | null;
};

/**
 * Toda la dependencia del proveedor de mapas vive en este archivo.
 *
 * Al resto de la aplicación le entran puntos y le salen toques; no sabe ni le
 * importa quién dibuja las calles. Cambiar OpenStreetMap por Google más
 * adelante es reemplazar este componente, no tocar las pantallas. Ver
 * docs/06-decisiones.md.
 */

// Centro de la Ciudad de Panamá, para cuando no hay ningún punto que encuadrar.
const CENTRO_POR_OMISION: [number, number] = [8.9824, -79.5199];

// Los colores salen de las mismas variables del sistema de diseño. Leaflet
// dibuja HTML suelto, así que se referencian con var() en vez de con clases.
const COLOR_ETAPA: Record<Etapa, string> = {
  nuevo: "var(--color-texto-atenuado)",
  contactado: "var(--color-info)",
  cotizado: "var(--color-info)",
  negociacion: "var(--color-aviso)",
  ganado: "var(--color-ok)",
  perdido: "var(--color-error)",
};

function icono(etapa: Etapa) {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:16px;height:16px;border-radius:9999px;
      background:${COLOR_ETAPA[etapa]};
      border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Encuadra el mapa sobre los puntos visibles cada vez que cambia el filtro. */
function Encuadrar({ puntos }: { puntos: Punto[] }) {
  const mapa = useMap();

  useEffect(() => {
    if (puntos.length === 0) return;
    const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 16 });
  }, [puntos, mapa]);

  return null;
}

export default function MapaPuntos({ puntos }: { puntos: Punto[] }) {
  return (
    <MapContainer
      center={CENTRO_POR_OMISION}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <Encuadrar puntos={puntos} />

      {puntos.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icono(p.etapa)}>
          <Popup>
            {/* El color del punto nunca va solo: al abrirlo, la etapa se lee
                escrita. Es la regla de §17 aplicada al mapa. */}
            <span className="block text-sm font-semibold">{p.nombre}</span>
            <span className="block text-xs">
              {p.tipoComercio ?? "Tipo sin definir"} · {ETAPAS[p.etapa]}
            </span>
            <Link
              href={`/prospectos/${p.id}`}
              className="mt-1 block text-xs underline"
            >
              Abrir expediente
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
