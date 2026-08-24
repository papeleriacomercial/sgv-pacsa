"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { List, MapPin } from "lucide-react";
import {
  aplicar,
  aUrl,
  colorizar,
  desdeUrl,
  DIMENSIONES,
  type Cuenta,
  type Dimension,
  type Filtros,
} from "@/lib/filtros";
import { haceDias } from "@/lib/fechas";
import { PanelFiltros } from "@/components/panel-filtros";
import { FichaPunto } from "@/components/ficha-punto";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, Vacio } from "@/components/ui/estados";

// Sigue siendo dinámico y sin render en servidor: el mapa solo existe en el
// navegador, y así su código no viaja a quien nunca abre la vista de mapa.
const MapaCuentas = dynamic(() => import("@/components/mapa-cuentas"), {
  ssr: false,
  loading: () => <Cargando texto="Cargando mapa" />,
});

/**
 * La cartera, con un solo motor de filtros y dos vistas.
 *
 * Lista y mapa son dos formas de mirar el mismo conjunto filtrado, no dos
 * pantallas distintas. Cambiar de vista no pierde los filtros: es el mismo
 * componente.
 */
export function CuentasConFiltros({
  cuentas,
  vendedores,
  vistaInicial = "lista",
  cuentaDestacada,
}: {
  cuentas: Cuenta[];
  vendedores: { id: string; nombre: string }[];
  vistaInicial?: "lista" | "mapa";
  /** Se abre centrada y con su ventana desplegada. Llega desde el expediente. */
  cuentaDestacada?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();

  // El estado nace de la dirección, no de valores vacíos. Volver atrás desde
  // una cuenta devuelve exactamente la vista que se estaba mirando: sin esto,
  // corregir diez cuentas sin clasificar obliga a rearmar el filtro diez veces.
  const [filtros, setFiltros] = useState<Filtros>(() => desdeUrl(parametros));
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"lista" | "mapa">(
    (parametros.get("vista") as "lista" | "mapa") ?? vistaInicial,
  );
  const [dimension, setDimension] = useState<Dimension>(
    (parametros.get("color") as Dimension) ?? "tipo",
  );

  // Los parámetros que no son filtros los pone la pantalla al entrar y ya no
  // cambian. Se leen una sola vez: si el efecto dependiera del objeto de
  // parámetros, cada `replace` lo volvería a disparar en ciclo.
  const fijos = useRef(parametros);

  // `replace` y no `push`: cada toque de filtro no debe dejar una entrada en el
  // historial, o el botón de atrás tardaría veinte toques en salir.
  useEffect(() => {
    const consulta = aUrl(filtros, dimension, vista, fijos.current);
    router.replace(`${ruta}?${consulta}`, { scroll: false });
  }, [filtros, dimension, vista, ruta, router]);

  const visibles = useMemo(() => aplicar(cuentas, filtros), [cuentas, filtros]);

  // Las opciones salen de los datos, no de una lista fija: si nadie usó una
  // categoría, no tiene sentido ofrecerla como filtro.
  const categorias = useMemo(
    () =>
      [...new Set(cuentas.map((c) => c.tipo_comercio).filter(Boolean))].sort() as string[],
    [cuentas],
  );

  const poblados = useMemo(
    () => [...new Set(cuentas.map((c) => c.poblado).filter(Boolean))].sort() as string[],
    [cuentas],
  );

  const nombreVendedor = (id: string) =>
    vendedores.find((v) => v.id === id)?.nombre ?? "Otro vendedor";

  const { color, leyenda } = useMemo(
    () => colorizar(visibles, dimension, nombreVendedor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibles, dimension, vendedores],
  );

  const conUbicacion = visibles.filter((c) => !c.sin_ubicacion);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <PanelFiltros
        filtros={filtros}
        onCambio={setFiltros}
        abierto={abierto}
        onAbrir={setAbierto}
        categorias={categorias}
        poblados={poblados}
        vendedores={vendedores}
        visibles={visibles.length}
        total={cuentas.length}
        dimension={dimension}
        onDimension={setDimension}
        conColor={vista === "mapa"}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-texto">
          {visibles.length} {visibles.length === 1 ? "cuenta" : "cuentas"}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={vista === "lista"}
            onClick={() => setVista("lista")}
            aria-label="Ver como lista"
            className={`min-h-tactil w-11 rounded-lg border ${
              vista === "lista"
                ? "border-marca bg-marca text-white"
                : "border-borde bg-superficie text-texto"
            }`}
          >
            <List size={16} className="mx-auto" aria-hidden />
          </button>
          <button
            type="button"
            aria-pressed={vista === "mapa"}
            onClick={() => setVista("mapa")}
            aria-label="Ver en el mapa"
            className={`min-h-tactil w-11 rounded-lg border ${
              vista === "mapa"
                ? "border-marca bg-marca text-white"
                : "border-borde bg-superficie text-texto"
            }`}
          >
            <MapPin size={16} className="mx-auto" aria-hidden />
          </button>
        </div>
      </div>

      {/* Obligatoria: sin ella, el mapa incumple §17. Ver D-013. */}
      {vista === "mapa" && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-borde bg-superficie px-3 py-2">
          <span className="text-xs font-medium text-texto">
            {DIMENSIONES[dimension]}:
          </span>
          {leyenda.map(({ color: c, texto }) => (
            <span
              key={texto}
              className="flex items-center gap-1.5 text-xs text-texto-secundario"
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: c }}
              />
              {texto}
            </span>
          ))}
        </div>
      )}

      {visibles.length === 0 && (
        <Tarjeta>
          <Vacio titulo="Ninguna cuenta pasa el filtro">
            Quita algún filtro para volver a verlas.
          </Vacio>
        </Tarjeta>
      )}

      {vista === "mapa" && visibles.length > 0 && (
        <>
          {conUbicacion.length === 0 ? (
            <Tarjeta>
              <Vacio titulo="Ninguna de estas cuentas tiene ubicación">
                Ábrelas y márcalas en el mapa desde su expediente.
              </Vacio>
            </Tarjeta>
          ) : (
            <div className="h-[60vh] w-full overflow-hidden rounded-lg border border-borde">
              <MapaCuentas
                cuentas={conUbicacion}
                color={color}
                destacada={cuentaDestacada}
              />
            </div>
          )}

          {conUbicacion.length < visibles.length && (
            <p className="text-xs text-texto-atenuado">
              {visibles.length - conUbicacion.length} sin ubicación, no se
              dibujan en el mapa.
            </p>
          )}
        </>
      )}

      {vista === "lista" &&
        visibles.map((c) => (
          <FichaPunto
            key={c.id}
            id={c.id}
            nombre={c.nombre}
            tipoComercio={c.tipo_comercio}
            tipo={c.tipo}
            potencial={null}
            ultimaInteraccion={
              c.dias_sin_contacto === null
                ? null
                : haceDias(c.dias_sin_contacto)
            }
          />
        ))}
    </div>
  );
}
