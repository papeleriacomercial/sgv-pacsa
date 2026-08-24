"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  LINEAS_PRODUCTO,
  TIPOS_CUENTA,
  VOLUMENES,
  type LineaProducto,
  type TipoCuenta,
  type Volumen,
} from "@/lib/catalogos";
import {
  contarActivos,
  DIMENSIONES,
  FILTROS_VACIOS,
  type Dimension,
  type Filtros,
} from "@/lib/filtros";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";

/** Alterna un valor dentro de una lista, que es lo que hacen casi todos los filtros. */
function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor)
    ? lista.filter((v) => v !== valor)
    : [...lista, valor];
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-texto">{titulo}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pastilla({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-tactil rounded-lg border px-3 text-sm ${
        activo
          ? "border-marca bg-marca text-white"
          : "border-borde bg-superficie text-texto"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Panel de filtros de la cartera.
 *
 * El mismo para la lista y para el mapa: dos vistas del mismo conjunto, no dos
 * conjuntos distintos.
 */
export function PanelFiltros({
  filtros,
  onCambio,
  abierto,
  onAbrir,
  categorias,
  poblados,
  vendedores,
  visibles,
  total,
  dimension,
  onDimension,
  conColor,
}: {
  filtros: Filtros;
  onCambio: (f: Filtros) => void;
  abierto: boolean;
  onAbrir: (v: boolean) => void;
  categorias: string[];
  poblados: string[];
  /** Solo llega con contenido si el usuario ve a más de una persona. */
  vendedores: { id: string; nombre: string }[];
  visibles: number;
  total: number;
  dimension: Dimension;
  onDimension: (d: Dimension) => void;
  /** La colorización solo existe en el mapa. */
  conColor: boolean;
}) {
  const [pestana, setPestana] = useState<"filtrar" | "colorear">("filtrar");
  const activos = contarActivos(filtros);
  const set = (parcial: Partial<Filtros>) =>
    onCambio({ ...filtros, ...parcial });

  // Filtrar y colorear son dos cosas distintas y no se mezclan en la misma
  // vista: una decide qué se ve, la otra cómo se ve. Van en pestañas, con el
  // mismo vocabulario de variables en las dos.
  const enColor = conColor && pestana === "colorear";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onAbrir(!abierto)}
        className="min-h-tactil flex items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <span className="flex items-center gap-2">
          <Filter size={16} aria-hidden />
          {conColor ? "Filtrar y colorear" : "Filtros"}
        </span>
        <span className="text-texto-secundario">
          {activos > 0
            ? `${visibles} de ${total} · ${activos} filtro${activos > 1 ? "s" : ""}`
            : `${total} cuentas`}
        </span>
      </button>

      {abierto && (
        <Tarjeta className="flex flex-col gap-4">
          {conColor && (
            <div className="grid grid-cols-2 gap-2">
              {(["filtrar", "colorear"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={pestana === p}
                  onClick={() => setPestana(p)}
                  className={`min-h-tactil rounded-lg border text-sm capitalize ${
                    pestana === p
                      ? "border-marca bg-marca text-white"
                      : "border-borde bg-superficie text-texto"
                  }`}
                >
                  {p === "filtrar" ? "Qué se ve" : "Cómo se colorea"}
                </button>
              ))}
            </div>
          )}

          {enColor && (
            <Grupo titulo="Colorear los pines por">
              {(Object.keys(DIMENSIONES) as Dimension[])
                .filter((d) => d !== "vendedor" || vendedores.length > 1)
                .map((d) => (
                  <Pastilla
                    key={d}
                    activo={dimension === d}
                    onClick={() => onDimension(d)}
                  >
                    {DIMENSIONES[d]}
                  </Pastilla>
                ))}
            </Grupo>
          )}

          {!enColor && (
            <>
              <Campo
                etiqueta="Buscar por nombre"
                value={filtros.texto}
                onChange={(e) => set({ texto: e.target.value })}
              />

              {/* "Sin clasificar" es la cola de trabajo: cuentas puestas en el
              mapa desde la oficina que nadie ha ido a ver todavía. Aparece
              primero porque es lo que hay que vaciar. */}
              <Grupo titulo="Tipo de cuenta">
                {(Object.keys(TIPOS_CUENTA) as TipoCuenta[]).map((t) => (
                  <Pastilla
                    key={t}
                    activo={filtros.tipos.includes(t)}
                    onClick={() => set({ tipos: alternar(filtros.tipos, t) })}
                  >
                    {TIPOS_CUENTA[t]}
                  </Pastilla>
                ))}
              </Grupo>

              <Grupo titulo="Volumen">
                {(Object.keys(VOLUMENES) as Volumen[]).map((v) => (
                  <Pastilla
                    key={v}
                    activo={filtros.volumenes.includes(v)}
                    onClick={() =>
                      set({ volumenes: alternar(filtros.volumenes, v) })
                    }
                  >
                    {VOLUMENES[v]}
                  </Pastilla>
                ))}
              </Grupo>

              <Grupo titulo="Producto de interés">
                {(Object.keys(LINEAS_PRODUCTO) as LineaProducto[]).map((p) => (
                  <Pastilla
                    key={p}
                    activo={filtros.productos.includes(p)}
                    onClick={() =>
                      set({ productos: alternar(filtros.productos, p) })
                    }
                  >
                    {LINEAS_PRODUCTO[p]}
                  </Pastilla>
                ))}
              </Grupo>

              <Grupo titulo="Tipo de comercio">
                {categorias.length > 0 ? (
                  categorias.map((c) => (
                    <Pastilla
                      key={c}
                      activo={filtros.categorias.includes(c)}
                      onClick={() =>
                        set({ categorias: alternar(filtros.categorias, c) })
                      }
                    >
                      {c}
                    </Pastilla>
                  ))
                ) : (
                  <p className="text-xs text-texto-atenuado">
                    Ninguna cuenta tiene tipo de comercio todavía. Se llena al
                    crear la cuenta o en Editar datos.
                  </p>
                )}
              </Grupo>

              {/* El poblado se muestra siempre, aunque esté vacío. Esconderlo
              cuando ninguna cuenta lo tiene hace que el filtro parezca no
              existir, y el vendedor no descubre que puede llenarlo. */}
              <Grupo titulo="Poblado">
                {poblados.length > 0 ? (
                  poblados.map((p) => (
                    <Pastilla
                      key={p}
                      activo={filtros.poblados.includes(p)}
                      onClick={() =>
                        set({ poblados: alternar(filtros.poblados, p) })
                      }
                    >
                      {p}
                    </Pastilla>
                  ))
                ) : (
                  <p className="text-xs text-texto-atenuado">
                    Ninguna cuenta tiene poblado todavía. Se llena en Editar
                    datos, y a partir de ahí se puede filtrar por zona.
                  </p>
                )}
              </Grupo>

              {/* Solo aparece para quien ve a más de una persona: líder y gerencia.
              A un vendedor filtrar por sí mismo no le dice nada. */}
              {vendedores.length > 1 && (
                <Grupo titulo="Vendedor">
                  {vendedores.map((v) => (
                    <Pastilla
                      key={v.id}
                      activo={filtros.vendedores.includes(v.id)}
                      onClick={() =>
                        set({ vendedores: alternar(filtros.vendedores, v.id) })
                      }
                    >
                      {v.nombre}
                    </Pastilla>
                  ))}
                </Grupo>
              )}

              <Grupo titulo="Sin contacto hace más de">
                {[15, 30, 60, 90].map((d) => (
                  <Pastilla
                    key={d}
                    activo={filtros.sinContactoDesde === d}
                    onClick={() =>
                      set({
                        sinContactoDesde:
                          filtros.sinContactoDesde === d ? null : d,
                      })
                    }
                  >
                    {`${d} días`}
                  </Pastilla>
                ))}
              </Grupo>

              <Grupo titulo="Con compromiso en los próximos">
                {[0, 3, 7, 30].map((d) => (
                  <Pastilla
                    key={d}
                    activo={filtros.compromisoEnDias === d}
                    onClick={() =>
                      set({
                        compromisoEnDias:
                          filtros.compromisoEnDias === d ? null : d,
                      })
                    }
                  >
                    {d === 0 ? "Vencidos y hoy" : `${d} días`}
                  </Pastilla>
                ))}
              </Grupo>

              <Grupo titulo="Atajos">
                <Pastilla
                  activo={filtros.soloFueraDeCadencia}
                  onClick={() =>
                    set({ soloFueraDeCadencia: !filtros.soloFueraDeCadencia })
                  }
                >
                  Fuera de cadencia
                </Pastilla>
                {/* No confundir con el tipo de cuenta "sin clasificar": esto
                es la cuenta a la que le falta el tipo de comercio. */}
                <Pastilla
                  activo={filtros.soloSinCategoria}
                  onClick={() =>
                    set({ soloSinCategoria: !filtros.soloSinCategoria })
                  }
                >
                  Sin categoría
                </Pastilla>
                <Pastilla
                  activo={filtros.soloSinUbicacion}
                  onClick={() =>
                    set({ soloSinUbicacion: !filtros.soloSinUbicacion })
                  }
                >
                  Sin ubicación
                </Pastilla>
                {/* Las descartadas no se borran, se esconden. Este es el
                interruptor que las trae de vuelta cuando hace falta revisar
                qué se fue a ver y por qué no sirvió. */}
                <Pastilla
                  activo={filtros.incluirDescartadas}
                  onClick={() =>
                    set({ incluirDescartadas: !filtros.incluirDescartadas })
                  }
                >
                  Mostrar descartadas
                </Pastilla>
                {/* Los leads viven en sus listas. Aquí se traen solo cuando
                    hace falta buscar uno por nombre. */}
                <Pastilla
                  activo={filtros.incluirSinClasificar}
                  onClick={() =>
                    set({ incluirSinClasificar: !filtros.incluirSinClasificar })
                  }
                >
                  Mostrar leads
                </Pastilla>
              </Grupo>

              {activos > 0 && (
                <button
                  type="button"
                  onClick={() => onCambio(FILTROS_VACIOS)}
                  className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde text-sm text-texto-secundario"
                >
                  <X size={16} aria-hidden />
                  Quitar todos los filtros
                </button>
              )}
            </>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
