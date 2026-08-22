"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  APIProvider,
  Map as MapaGoogle,
  Marker,
} from "@vis.gl/react-google-maps";
import { Crosshair } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { obtenerUbicacion } from "@/lib/gps";
import { COLOR, iconoPin } from "@/lib/marcadores";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

const CENTRO_POR_OMISION = { lat: 8.9824, lng: -79.5199 };

/**
 * Ubicar una cuenta a mano.
 *
 * Una cuenta creada sin señal queda sin coordenadas y desaparece del mapa.
 * Hasta ahora no había forma de arreglarlo: el GPS solo se capturaba al crear.
 *
 * Aquí el vendedor toca el punto en el mapa y lo guarda. Sirve también para
 * corregir una lectura mala, de esas de 2.000 metros de precisión.
 */
export default function UbicarCuenta() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [centro, setCentro] = useState(CENTRO_POR_OMISION);

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("cuentas")
      .select("nombre, lat, lng")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(async ({ data, error: fallo }) => {
        if (fallo) setError(fallo.message);
        if (data) {
          setNombre(data.nombre ?? "");
          if (data.lat && data.lng) {
            const actual = { lat: Number(data.lat), lng: Number(data.lng) };
            setPunto(actual);
            setCentro(actual);
          } else {
            // Sin coordenadas guardadas, el mapa abre donde está el vendedor:
            // lo más probable es que la cuenta esté cerca de él.
            const mia = await obtenerUbicacion();
            if (mia) setCentro({ lat: mia.lat, lng: mia.lng });
          }
        }
        setCargando(false);
      });
  }, [id]);

  async function guardar() {
    if (!punto) return;
    setGuardando(true);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cuentas")
      .update({ lat: punto.lat, lng: punto.lng })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/cuentas/${id}`);
    router.refresh();
  }

  const llave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/`} />
        <h1 className="text-lg font-semibold text-marca">Ubicar en el mapa</h1>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-4">
        {cargando && <Cargando />}
        {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

        {!cargando && !llave && (
          <MensajeError
            titulo="Falta la llave del mapa"
            detalle="No está configurada NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en este entorno."
          />
        )}

        {!cargando && llave && (
          <>
            <Tarjeta className="flex items-start gap-2">
              <Crosshair size={18} className="mt-0.5 shrink-0 text-marca" aria-hidden />
              <div>
                <p className="text-sm font-medium text-texto">{nombre}</p>
                <p className="text-xs text-texto-secundario">
                  Toca el mapa sobre la puerta del local. Puedes tocar de nuevo
                  para corregir.
                </p>
              </div>
            </Tarjeta>

            <div className="h-[55vh] w-full overflow-hidden rounded-lg border border-borde">
              {/* Mismo juego de librerías que el resto de la aplicación. Pedirle
                  el script a Google dos veces con parámetros distintos hace
                  que el segundo mapa no arranque. */}
              <APIProvider apiKey={llave} libraries={["places"]}>
                <MapaGoogle
                  defaultCenter={centro}
                  defaultZoom={punto ? 17 : 15}
                  gestureHandling="greedy"
                  disableDefaultUI
                  zoomControl
                  onClick={(evento) => {
                    const p = evento.detail.latLng;
                    if (p) setPunto({ lat: p.lat, lng: p.lng });
                  }}
                  style={{ height: "100%", width: "100%" }}
                >
                  {punto && (
                    <Marker position={punto} icon={iconoPin(COLOR.marca)} />
                  )}
                </MapaGoogle>
              </APIProvider>
            </div>

            <Boton ancho onClick={guardar} disabled={!punto || guardando}>
              {guardando
                ? "Guardando"
                : punto
                  ? "Guardar esta ubicación"
                  : "Toca el mapa para marcar el punto"}
            </Boton>
          </>
        )}
      </main>
    </>
  );
}
