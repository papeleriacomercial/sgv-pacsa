"use client";

import Link from "next/link";
import { useState } from "react";
import { Crosshair, MapPinned } from "lucide-react";
import { obtenerUbicacion, calidadUbicacion } from "@/lib/gps";
import { Campo } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";

/**
 * Las coordenadas de la cuenta, como dato de la cuenta.
 *
 * Antes solo se capturaban al crear, y el check-in de la visita era lo único
 * que volvía a tocar el GPS. Eso confundía dos cosas distintas: **dónde queda
 * el local** —un dato de la cuenta, que se corrige— y **dónde estaba el
 * vendedor cuando registró la visita** —un hecho de la bitácora, que no se
 * toca—. Una cuenta creada sin señal quedaba fuera del mapa para siempre.
 *
 * Tres caminos, porque los tres pasan de verdad: escribirlas a mano cuando
 * vienen de otro lado, tomarlas del celular estando en la puerta, o tocarlas
 * en el mapa desde la oficina.
 */
export function CampoCoordenadas({
  cuentaId,
  lat,
  lng,
  onCambio,
}: {
  cuentaId: string;
  lat: string;
  lng: string;
  onCambio: (lat: string, lng: string) => void;
}) {
  const [leyendo, setLeyendo] = useState(false);
  const [precision, setPrecision] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);

  async function tomarDelCelular() {
    setLeyendo(true);
    setFallo(false);

    const leida = await obtenerUbicacion();
    if (leida) {
      onCambio(leida.lat.toFixed(6), leida.lng.toFixed(6));
      setPrecision(leida.precisionM);
    } else {
      setFallo(true);
    }

    setLeyendo(false);
  }

  const calidad = precision !== null ? calidadUbicacion(precision) : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-texto">Coordenadas</p>
        <p className="text-xs text-texto-atenuado">
          Dónde queda el local. Es lo que lo pone en el mapa. Sin esto la cuenta
          existe pero no aparece.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Campo
          etiqueta="Latitud"
          inputMode="decimal"
          className="font-mono"
          value={lat}
          onChange={(e) => onCambio(e.target.value, lng)}
        />
        <Campo
          etiqueta="Longitud"
          inputMode="decimal"
          className="font-mono"
          value={lng}
          onChange={(e) => onCambio(lat, e.target.value)}
        />
      </div>

      {calidad && <Insignia tono={calidad.tono}>{calidad.texto}</Insignia>}

      {fallo && (
        <p className="text-xs text-aviso">
          El celular no dio ubicación. Puedes marcarla en el mapa.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={tomarDelCelular}
          disabled={leyendo}
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto disabled:opacity-50"
        >
          <Crosshair size={16} aria-hidden />
          {leyendo ? "Leyendo" : "Estoy aquí"}
        </button>

        {/* Sale del formulario, así que va como enlace y no como botón: lo que
            esté escrito sin guardar se pierde, y el mapa guarda por su cuenta. */}
        <Link
          href={`/cuentas/${cuentaId}/ubicar`}
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
        >
          <MapPinned size={16} aria-hidden />
          Marcar en el mapa
        </Link>
      </div>
    </div>
  );
}
