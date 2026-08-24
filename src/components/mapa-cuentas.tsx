"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  APIProvider,
  InfoWindow,
  Map as MapaGoogle,
  Marker,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { TIPOS_CUENTA, VOLUMENES } from "@/lib/catalogos";
import { iconoPin } from "@/lib/marcadores";
import { haceDias } from "@/lib/fechas";
import type { Cuenta } from "@/lib/filtros";
import { MensajeError } from "@/components/ui/estados";

const CENTRO_POR_OMISION = { lat: 8.9824, lng: -79.5199 };

function Encuadrar({
  cuentas,
  destacada,
}: {
  cuentas: Cuenta[];
  destacada?: string;
}) {
  const mapa = useMap();

  useEffect(() => {
    if (!mapa) return;

    // Si se llega desde una cuenta concreta, el mapa se centra en ella en vez
    // de encuadrar toda la cartera.
    const punto = cuentas.find((c) => c.id === destacada);
    if (punto) {
      mapa.panTo({ lat: punto.lat!, lng: punto.lng! });
      mapa.setZoom(17);
      return;
    }

    if (cuentas.length === 0) return;
    const limites = new google.maps.LatLngBounds();
    cuentas.forEach((c) => limites.extend({ lat: c.lat!, lng: c.lng! }));
    mapa.fitBounds(limites, 48);
    const zoom = mapa.getZoom();
    if (zoom !== undefined && zoom > 17) mapa.setZoom(17);
  }, [mapa, cuentas, destacada]);

  return null;
}

/**
 * El mapa de la cartera, con el color decidido por quien lo mira.
 *
 * Recibe la función de color ya resuelta: este componente no sabe por qué
 * dimensión se está coloreando, solo la dibuja. Toda la lógica de colores vive
 * en `lib/filtros.ts`, junto con la leyenda que la explica.
 */
function Contenido({
  cuentas,
  color,
  destacada,
}: {
  cuentas: Cuenta[];
  color: (c: Cuenta) => string;
  destacada?: string;
}) {
  const router = useRouter();
  // Cuando se llega desde una lista, los puntos que escoja entran ahí.
  const listaId = useSearchParams().get("lista");
  const places = useMapsLibrary("places");
  // `core` trae Size y Point, que usa el ícono del marcador. Sin esperarla, el
  // primer render los construye antes de que existan y revienta el mapa entero.
  const core = useMapsLibrary("core");
  const [abierta, setAbierta] = useState<Cuenta | null>(
    () => cuentas.find((c) => c.id === destacada) ?? null,
  );
  const [candidato, setCandidato] = useState<{
    placeId: string;
    nombre: string;
    lat: number;
    lng: number;
  } | null>(null);

  /**
   * Tocar un local de tercero en el mapa y agregarlo.
   *
   * De Google solo se guarda el `place_id` y la ubicación. El nombre viaja
   * como sugerencia y se vuelve dato propio cuando el vendedor lo confirma
   * (§7.4).
   */
  const tocarMapa = useCallback(
    async (evento: MapMouseEvent) => {
      setAbierta(null);
      setCandidato(null);

      const placeId = evento.detail.placeId;
      if (!placeId || !places) return;
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
        // Un local que no se puede leer simplemente no abre nada.
      }
    },
    [places],
  );

  return (
    <MapaGoogle
      defaultCenter={CENTRO_POR_OMISION}
      defaultZoom={12}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      clickableIcons
      onClick={tocarMapa}
      style={{ height: "100%", width: "100%" }}
    >
      <Encuadrar cuentas={cuentas} destacada={destacada} />

      {core &&
        cuentas.map((c) => (
          <Marker
            key={c.id}
            position={{ lat: c.lat!, lng: c.lng! }}
            icon={iconoPin(color(c))}
            onClick={() => setAbierta(c)}
          />
        ))}

      {abierta && (
        <InfoWindow
          position={{ lat: abierta.lat!, lng: abierta.lng! }}
          onCloseClick={() => setAbierta(null)}
        >
          {/* El color va acompañado siempre del dato escrito: es lo que
              mantiene la regla de §17 dentro de la excepción de D-013. */}
          <span className="block text-sm font-semibold">{abierta.nombre}</span>
          <span className="block text-xs">
            {TIPOS_CUENTA[abierta.tipo]}
            {abierta.volumen && ` · Volumen ${VOLUMENES[abierta.volumen]}`}
          </span>
          <span className="block text-xs">
            {abierta.dias_sin_contacto === null
              ? "Nunca contactada"
              : `${haceDias(abierta.dias_sin_contacto)} sin contacto`}
          </span>
          <Link
            href={`/cuentas/${abierta.id}`}
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
          <span className="block text-xs">Todavía no es cuenta tuya</span>
          <button
            type="button"
            onClick={() => {
              const p = new URLSearchParams({
                place_id: candidato.placeId,
                lat: String(candidato.lat),
                lng: String(candidato.lng),
                nombre: candidato.nombre,
              });
              // Si se está armando una lista, la cuenta entra ahí al crearse.
              if (listaId) p.set("lista", listaId);
              router.push(`/cuentas/nuevo?${p}`);
            }}
            className="mt-1 text-xs font-medium underline"
          >
            Agregar como cuenta
          </button>
        </InfoWindow>
      )}
    </MapaGoogle>
  );
}

export default function MapaCuentas({
  cuentas,
  color,
  destacada,
}: {
  cuentas: Cuenta[];
  color: (c: Cuenta) => string;
  destacada?: string;
}) {
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
      <Contenido cuentas={cuentas} color={color} destacada={destacada} />
    </APIProvider>
  );
}
