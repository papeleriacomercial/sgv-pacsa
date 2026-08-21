"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { ETAPAS, type Etapa } from "@/lib/catalogos";
import { MensajeError } from "@/components/ui/estados";

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
 * importa quién dibuja las calles. Ver D-008 en docs/06-decisiones.md.
 */

const CENTRO_POR_OMISION = { lat: 8.9824, lng: -79.5199 };

const COLOR_ETAPA: Record<Etapa, string> = {
  nuevo: "#90a1b9",
  contactado: "#155dfc",
  cotizado: "#155dfc",
  negociacion: "#fe9a00",
  ganado: "#00a63e",
  perdido: "#e7000b",
};

/** Ícono dibujado como SVG en línea, para no depender de los globales de Google. */
function icono(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="${color}" stroke="white" stroke-width="2.5"/></svg>`;
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

/** Encuadra el mapa sobre los puntos visibles cada vez que cambia el filtro. */
function Encuadrar({ puntos }: { puntos: Punto[] }) {
  const mapa = useMap();

  useEffect(() => {
    if (!mapa || puntos.length === 0) return;
    const limites = new google.maps.LatLngBounds();
    puntos.forEach((p) => limites.extend({ lat: p.lat, lng: p.lng }));
    mapa.fitBounds(limites, 48);
    // Con un solo punto, fitBounds acerca al máximo. Se limita el acercamiento.
    const zoom = mapa.getZoom();
    if (zoom !== undefined && zoom > 17) mapa.setZoom(17);
  }, [mapa, puntos]);

  return null;
}

type Candidato = {
  placeId: string;
  nombre: string;
  lat: number;
  lng: number;
};

/**
 * Lo que el vendedor pidió: ve un local de tercero en el mapa, lo toca, y lo
 * agrega a su lista.
 *
 * De Google solo se guarda el `place_id` y la ubicación. El nombre viaja como
 * sugerencia en el formulario y se vuelve dato propio cuando el vendedor lo
 * confirma en la visita, que es lo que permiten los términos de Maps y lo que
 * describe §7.4.
 */
function Contenido({
  puntos,
  onError,
}: {
  puntos: Punto[];
  onError: (mensaje: string) => void;
}) {
  const router = useRouter();
  const places = useMapsLibrary("places");
  const [propio, setPropio] = useState<Punto | null>(null);
  const [candidato, setCandidato] = useState<Candidato | null>(null);

  const tocarMapa = useCallback(
    async (evento: MapMouseEvent) => {
      setPropio(null);
      setCandidato(null);

      const placeId = evento.detail.placeId;
      if (!placeId || !places) return;

      // Evita que Google abra su propia ventana sobre la nuestra.
      evento.stop?.();

      try {
        const lugar = new places.Place({ id: placeId });
        await lugar.fetchFields({ fields: ["displayName", "location"] });
        if (!lugar.location) return;

        setCandidato({
          placeId,
          nombre: lugar.displayName ?? "",
          lat: lugar.location.lat(),
          lng: lugar.location.lng(),
        });
      } catch {
        onError("No se pudo leer ese local. Intenta de nuevo.");
      }
    },
    [places, onError],
  );

  function agregar(c: Candidato) {
    const parametros = new URLSearchParams({
      place_id: c.placeId,
      lat: String(c.lat),
      lng: String(c.lng),
      nombre: c.nombre,
    });
    router.push(`/prospectos/nuevo?${parametros}`);
  }

  return (
    <Map
      defaultCenter={CENTRO_POR_OMISION}
      defaultZoom={12}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      clickableIcons
      onClick={tocarMapa}
      style={{ height: "100%", width: "100%" }}
    >
      <Encuadrar puntos={puntos} />

      {puntos.map((p) => (
        <Marker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          icon={icono(COLOR_ETAPA[p.etapa])}
          onClick={() => {
            setCandidato(null);
            setPropio(p);
          }}
        />
      ))}

      {propio && (
        <InfoWindow
          position={{ lat: propio.lat, lng: propio.lng }}
          onCloseClick={() => setPropio(null)}
        >
          {/* El color del punto nunca va solo: al abrirlo, la etapa se lee
              escrita. Es la regla de §17 aplicada al mapa. */}
          <span className="block text-sm font-semibold">{propio.nombre}</span>
          <span className="block text-xs">
            {propio.tipoComercio ?? "Tipo sin definir"} · {ETAPAS[propio.etapa]}
          </span>
          <Link
            href={`/prospectos/${propio.id}`}
            className="mt-1 block text-xs underline"
          >
            Abrir expediente
          </Link>
        </InfoWindow>
      )}

      {candidato && (
        <InfoWindow
          position={{ lat: candidato.lat, lng: candidato.lng }}
          onCloseClick={() => setCandidato(null)}
        >
          <span className="block text-sm font-semibold">
            {candidato.nombre || "Este local"}
          </span>
          <span className="block text-xs">Todavía no es prospecto tuyo</span>
          <button
            type="button"
            onClick={() => agregar(candidato)}
            className="mt-1 text-xs font-medium underline"
          >
            Agregar como prospecto
          </button>
        </InfoWindow>
      )}
    </Map>
  );
}

export default function MapaPuntos({ puntos }: { puntos: Punto[] }) {
  const [error, setError] = useState<string | null>(null);
  const llave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!llave) {
    return (
      <div className="p-4">
        <MensajeError
          titulo="Falta la llave del mapa"
          detalle="No está configurada NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en este entorno."
        />
      </div>
    );
  }

  return (
    <APIProvider apiKey={llave} libraries={["places"]}>
      {error && (
        <div className="p-2">
          <MensajeError titulo={error} />
        </div>
      )}
      <Contenido puntos={puntos} onError={setError} />
    </APIProvider>
  );
}
