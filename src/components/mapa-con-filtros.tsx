"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Filter } from "lucide-react";
import { ETAPAS, LINEAS_PRODUCTO, type Etapa, type LineaProducto } from "@/lib/catalogos";
import type { Punto } from "@/components/mapa-puntos";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Tarjeta } from "@/components/ui/tarjeta";

// Leaflet toca `window` al cargarse, así que el mapa no puede renderizarse en
// el servidor.
const MapaPuntos = dynamic(() => import("@/components/mapa-puntos"), {
  ssr: false,
  loading: () => <Cargando texto="Cargando mapa" />,
});

type PuntoConProductos = Punto & { productos: LineaProducto[] };

export function MapaConFiltros({ puntos }: { puntos: PuntoConProductos[] }) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [productos, setProductos] = useState<LineaProducto[]>([]);
  const [abierto, setAbierto] = useState(false);

  const visibles = useMemo(
    () =>
      puntos.filter((p) => {
        if (etapas.length > 0 && !etapas.includes(p.etapa)) return false;
        if (
          productos.length > 0 &&
          !productos.some((linea) => p.productos.includes(linea))
        ) {
          return false;
        }
        return true;
      }),
    [puntos, etapas, productos],
  );

  function alternar<T>(lista: T[], valor: T): T[] {
    return lista.includes(valor)
      ? lista.filter((v) => v !== valor)
      : [...lista, valor];
  }

  const filtrosActivos = etapas.length + productos.length;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="min-h-tactil flex items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <span className="flex items-center gap-2">
          <Filter size={16} aria-hidden />
          Filtros
        </span>
        <span className="text-texto-secundario">
          {filtrosActivos > 0
            ? `${filtrosActivos} activo${filtrosActivos > 1 ? "s" : ""}`
            : `${visibles.length} en el mapa`}
        </span>
      </button>

      {abierto && (
        <Tarjeta className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-texto">Etapa</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(ETAPAS) as Etapa[]).map((etapa) => {
                const activo = etapas.includes(etapa);
                return (
                  <button
                    key={etapa}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setEtapas((a) => alternar(a, etapa))}
                    className={`min-h-tactil rounded-lg border px-3 text-sm ${
                      activo
                        ? "border-marca bg-marca text-white"
                        : "border-borde bg-superficie text-texto"
                    }`}
                  >
                    {ETAPAS[etapa]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-texto">Producto de interés</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(LINEAS_PRODUCTO) as LineaProducto[]).map((linea) => {
                const activo = productos.includes(linea);
                return (
                  <button
                    key={linea}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setProductos((a) => alternar(a, linea))}
                    className={`min-h-tactil rounded-lg border px-3 text-sm ${
                      activo
                        ? "border-marca bg-marca text-white"
                        : "border-borde bg-superficie text-texto"
                    }`}
                  >
                    {LINEAS_PRODUCTO[linea]}
                  </button>
                );
              })}
            </div>
          </div>

          {filtrosActivos > 0 && (
            <button
              type="button"
              onClick={() => {
                setEtapas([]);
                setProductos([]);
              }}
              className="min-h-tactil rounded-lg border border-borde text-sm text-texto-secundario"
            >
              Quitar filtros
            </button>
          )}
        </Tarjeta>
      )}

      {puntos.length === 0 ? (
        <Tarjeta>
          <Vacio titulo="Ningún prospecto tiene ubicación todavía">
            Los prospectos aparecen en el mapa cuando se crean con GPS activo.
          </Vacio>
        </Tarjeta>
      ) : (
        <div className="h-[65vh] w-full overflow-hidden rounded-lg border border-borde">
          <MapaPuntos puntos={visibles} />
        </div>
      )}

      {puntos.length > 0 && visibles.length === 0 && (
        <Tarjeta>
          <Vacio titulo="Ningún punto pasa el filtro">
            Quita algún filtro para volver a verlos.
          </Vacio>
        </Tarjeta>
      )}
    </div>
  );
}
