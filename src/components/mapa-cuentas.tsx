"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
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
import { COLOR, iconoPin } from "@/lib/marcadores";
import { haceDias } from "@/lib/fechas";
import type { Cuenta } from "@/lib/filtros";
import { MensajeError } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { crearPotenciales, type PuntoElegido } from "@/lib/potenciales";
import { clienteNavegador } from "@/lib/supabase/navegador";

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
   * Los comercios del mapa que se van marcando para esta lista.
   *
   * **ANTES ESTO NO EXISTÍA: el botón decía «Agregar como cuenta» y se iba a la pantalla de**
   * **Cuentas**, de la que la aplicación no volvía a Listas. Lo reportó el equipo de ventas el
   * 11 de septiembre de 2026: *«esto está bien si estuviera en el menú de CUENTAS, pero al
   * estar en el menú de LISTAS ha creado confusión»*.
   *
   * Ahora se marcan varios y se confirman de un golpe, igual que en el buscador de potenciales.
   * Que las dos pantallas se comporten igual es lo que permite ir de una a otra sin reaprender.
   */
  const [elegidos, setElegidos] = useState<PuntoElegido[]>([]);
  const [guardando, setGuardando] = useState(false);

  /**
   * Calle o satélite.
   *
   * **`hybrid` y no `satellite`:** el satélite puro no trae nombres de calle ni rótulos, y un
   * vendedor mirando techos sin saber en qué calle está no puede planificar nada.
   */
  const [tipoMapa, setTipoMapa] = useState<"roadmap" | "hybrid">("roadmap");
  const [error, setError] = useState<string | null>(null);

  /** Crear de un golpe todo lo marcado, y meterlo en la lista. */
  async function agregarALaLista() {
    if (!listaId || elegidos.length === 0) return;
    setGuardando(true);
    setError(null);

    const {
      data: { user },
    } = await clienteNavegador().auth.getUser();

    if (!user) {
      setError("Se cerró la sesión. Vuelve a entrar.");
      setGuardando(false);
      return;
    }

    // **LA MISMA FUNCIÓN QUE USA EL BUSCADOR.** Acá se hereda el poblado de la lista, el origen
    // y el que entren sin `tipo` —o sea como potenciales— sin tener que acordarse de nada.
    const fallo = await crearPotenciales({
      puntos: elegidos,
      vendedorId: user.id,
      listaId,
    });

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    setElegidos([]);
    setGuardando(false);
    router.push(`/listas/${listaId}`);
    router.refresh();
  }

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
    <div className="relative h-full w-full">
      <MapaGoogle
        defaultCenter={CENTRO_POR_OMISION}
        defaultZoom={12}
        gestureHandling="greedy"
        // Controlado: cambia cuando se toca el botón de capas.
        mapTypeId={tipoMapa}
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

        {/* Los marcados llevan pin propio: sin esto, el vendedor pierde la cuenta de cuáles ya
            tocó en cuanto el mapa tiene veinte rótulos. */}
        {core &&
          elegidos.map((p) => (
            <Marker
              key={p.placeId}
              position={{ lat: p.lat, lng: p.lng }}
              icon={iconoPin(COLOR.marca)}
              onClick={() => setCandidato(p)}
            />
          ))}

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
                if (!listaId) {
                  // Fuera de una lista sigue siendo lo de siempre: se abre la ficha y se llena.
                  const p = new URLSearchParams({
                    place_id: candidato.placeId,
                    lat: String(candidato.lat),
                    lng: String(candidato.lng),
                    nombre: candidato.nombre,
                  });
                  router.push(`/cuentas/nuevo?${p}`);
                  return;
                }

                // **MARCA Y SE CIERRA.** Barrer una zona es tocar un comercio tras otro; llevarlo
                // a otra pantalla en cada uno es lo que hacía imposible armar una lista desde acá.
                setElegidos((a) =>
                  a.some((x) => x.placeId === candidato.placeId)
                    ? a.filter((x) => x.placeId !== candidato.placeId)
                    : [...a, candidato],
                );
                setCandidato(null);
              }}
              className="mt-1 text-xs font-medium underline"
            >
              {!listaId
                ? "Agregar como cuenta"
                : elegidos.some((x) => x.placeId === candidato.placeId)
                  ? "Quitar de mi lista"
                  : "Agregar a mi lista"}
            </button>
          </InfoWindow>
        )}
        </MapaGoogle>

      {/* **FLOTA SOBRE EL MAPA.** Esta pantalla no tiene barra de herramientas donde ponerlo, y
          crear una le quitaría al mapa el alto que se le acaba de dar. */}
      <button
        type="button"
        aria-pressed={tipoMapa === "hybrid"}
        onClick={() => setTipoMapa((a) => (a === "hybrid" ? "roadmap" : "hybrid"))}
        className={`min-h-tactil absolute right-3 top-3 z-10 w-11 rounded-lg border shadow-sm ${
          tipoMapa === "hybrid"
            ? "border-marca bg-marca text-white"
            : "border-borde bg-superficie text-texto"
        }`}
        aria-label={tipoMapa === "hybrid" ? "Ver el mapa de calles" : "Ver satélite"}
      >
        <Layers size={16} className="mx-auto" aria-hidden />
      </button>

      {/* **FLOTANTE SOBRE EL MAPA, NO DEBAJO.** Debajo obligaría a encoger el mapa para dejarle
          sitio, y sólo aparece cuando hay algo que agregar: el resto del tiempo no ocupa nada. */}
      {listaId && elegidos.length > 0 && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
          {error && (
            <div className="pointer-events-auto">
              <MensajeError titulo="No se pudo agregar" detalle={error} />
            </div>
          )}
          <div className="pointer-events-auto">
            <Boton ancho onClick={agregarALaLista} disabled={guardando}>
              {guardando
                ? "Agregando"
                : `Agregar ${elegidos.length} ${
                    elegidos.length === 1 ? "potencial" : "potenciales"
                  } a la lista`}
            </Boton>
          </div>
        </div>
      )}
    </div>
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
