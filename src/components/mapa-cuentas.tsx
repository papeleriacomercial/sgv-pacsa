"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const ruta = usePathname();

  // **Dónde quedó el mapa se guarda aparte de la dirección, a propósito.**
  //
  // Los filtros sí viven en la dirección (D-014) y el panel la reescribe
  // cada vez que se toca uno. Si el encuadre viviera ahí también, los dos
  // se pisarían: mover el mapa borraría un filtro o al revés. Y una
  // dirección que cambia cada vez que el dedo roza el mapa no sirve para
  // compartir nada.
  //
  // Se guarda por pantalla y dura lo que dure la pestaña, que es
  // exactamente lo que hace falta: volver de una cuenta al sitio donde se
  // estaba mirando.
  const clave = `sgv:mapa:${ruta}`;
  const guardado =
    typeof window === "undefined" ? null : sessionStorage.getItem(clave);
  const yaEncuadro = useRef(false);

  useEffect(() => {
    if (!mapa || yaEncuadro.current) return;
    yaEncuadro.current = true;

    // **Volver tiene que devolver al mismo sitio.** Sin esto, abrir un pin
    // y regresar reencuadraba toda la cartera: quien estaba sondeando San
    // Francisco terminaba viendo Panamá y Puerto Rico otra vez, y perdía
    // el punto donde iba. Es el mismo principio que los filtros: lo que
    // el usuario ajustó vive en la dirección, y el historial lo devuelve.
    if (guardado) {
      const [lat, lng, z] = guardado.split(",").map(Number);
      if ([lat, lng, z].every(Number.isFinite)) {
        mapa.setCenter({ lat, lng });
        mapa.setZoom(z);
        return;
      }
    }

    // Si se llega desde una cuenta concreta, el mapa se centra en ella en vez
    // de encuadrar toda la cartera.
    const punto = cuentas.find((c) => c.id === destacada);
    if (punto) {
      mapa.panTo({ lat: punto.lat!, lng: punto.lng! });
      mapa.setZoom(17);
      return;
    }

    if (cuentas.length === 0) return;

    // **Se encuadra el grueso, no los extremos.** Un solo cliente en Puerto
    // Rico obligaba a abrir el mapa a escala de medio Caribe, con las 200
    // cuentas de Panamá apretadas en un punto. Se recortan los extremos por
    // percentil: el que queda fuera sigue ahí, solo hay que alejarse.
    const lats = cuentas.map((c) => c.lat!).sort((a, b) => a - b);
    const lngs = cuentas.map((c) => c.lng!).sort((a, b) => a - b);
    const corte = (v: number[], p: number) =>
      v[Math.min(v.length - 1, Math.max(0, Math.floor(v.length * p)))];

    const limites = new google.maps.LatLngBounds();
    limites.extend({ lat: corte(lats, 0.05), lng: corte(lngs, 0.05) });
    limites.extend({ lat: corte(lats, 0.95), lng: corte(lngs, 0.95) });

    mapa.fitBounds(limites, 48);
    const zoom = mapa.getZoom();
    if (zoom !== undefined && zoom > 17) mapa.setZoom(17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, cuentas, destacada]);

  // Se anota cuando el mapa se queda quieto, no mientras se arrastra.
  useEffect(() => {
    if (!mapa) return;

    const oyente = mapa.addListener("idle", () => {
      const centro = mapa.getCenter();
      const z = mapa.getZoom();
      if (!centro || z === undefined) return;
      sessionStorage.setItem(
        clave,
        `${centro.lat().toFixed(5)},${centro.lng().toFixed(5)},${z}`,
      );
    });

    return () => oyente.remove();
  }, [mapa, clave]);

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
