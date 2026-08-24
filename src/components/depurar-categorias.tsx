"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, GitMerge, Pencil, TriangleAlert } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { parecidos } from "@/lib/texto";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError, Vacio } from "@/components/ui/estados";

export type Categoria = {
  id: string;
  nombre: string;
  cuentas: number;
};

type Accion =
  | { tipo: "renombrar"; categoria: Categoria }
  | { tipo: "fusionar"; categoria: Categoria }
  | { tipo: "desactivar"; categoria: Categoria };

/**
 * Depuración del catálogo de tipos de comercio (D-012).
 *
 * Tres operaciones, y ninguna toca solo el catálogo:
 *
 * - **Renombrar** arrastra las cuentas. Corregir «mimisuper» dejando las
 *   cuentas diciendo «mimisuper» sería peor que no corregir.
 * - **Fusionar** mueve las cuentas de la que sobra a la que queda.
 * - **Desactivar** la saca de las sugerencias sin tocar las cuentas: para
 *   categorías que fueron reales y ya no se usan.
 *
 * El número de cuentas va siempre a la vista porque es lo que decide cuál de
 * las dos grafías sobrevive, y sin él habría que elegir a ciegas.
 */
export function DepurarCategorias({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [texto, setTexto] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  // Se calculan aquí y no en la base: es una comparación de todos contra todos
  // sobre una lista que nunca va a pasar de unas decenas.
  const sospechosas = useMemo(() => parecidos(categorias), [categorias]);

  function cerrar() {
    setAccion(null);
    setTexto("");
    setDestino("");
    setError(null);
  }

  async function ejecutar() {
    if (!accion) return;
    setTrabajando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { categoria } = accion;

    try {
      if (accion.tipo === "renombrar") {
        const { data, error: fallo } = await supabase.rpc(
          "renombrar_categoria",
          { p_id: categoria.id, p_nombre: texto },
        );
        if (fallo) throw fallo;
        setAviso(
          `«${categoria.nombre}» ahora es «${texto.trim()}». ${data ?? 0} cuentas actualizadas.`,
        );
      }

      if (accion.tipo === "fusionar") {
        const { data, error: fallo } = await supabase.rpc(
          "fusionar_categoria",
          { p_origen: categoria.id, p_destino: destino },
        );
        if (fallo) throw fallo;
        const nombre = categorias.find((c) => c.id === destino)?.nombre ?? "";
        setAviso(
          `«${categoria.nombre}» se unió a «${nombre}». ${data ?? 0} cuentas movidas.`,
        );
      }

      if (accion.tipo === "desactivar") {
        const { error: fallo } = await supabase
          .from("categorias_comercio")
          .update({ activa: false })
          .eq("id", categoria.id);
        if (fallo) throw fallo;
        setAviso(`«${categoria.nombre}» ya no se sugiere al crear cuentas.`);
      }

      cerrar();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo hacer el cambio.");
    } finally {
      setTrabajando(false);
    }
  }

  if (categorias.length === 0) {
    return (
      <Tarjeta>
        <Vacio titulo="El catálogo está vacío">
          Se llena solo: cada tipo de comercio que un vendedor escriba al crear
          una cuenta aparece aquí.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <Tarjeta className="border-ok/40 bg-ok/5 text-sm text-texto">
          {aviso}
        </Tarjeta>
      )}

      {sospechosas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-texto">
            <TriangleAlert size={16} className="text-aviso" aria-hidden />
            Se parecen · {sospechosas.length}
          </h2>
          <p className="text-xs text-texto-atenuado">
            Puede ser la misma escrita de dos formas. Revisa antes de unir: hay
            parecidos que son de verdad distintos.
          </p>

          {sospechosas.map(([a, b]) => {
            // Sobrevive la más usada: mover pocas cuentas se equivoca menos.
            const [queda, sobra] = a.cuentas >= b.cuentas ? [a, b] : [b, a];
            return (
              <Tarjeta
                key={`${a.id}-${b.id}`}
                className="flex flex-col gap-2 border-aviso/30"
              >
                <p className="text-sm text-texto">
                  <strong>{sobra.nombre}</strong>{" "}
                  <span className="font-mono text-xs text-texto-atenuado">
                    {sobra.cuentas}
                  </span>{" "}
                  → <strong>{queda.nombre}</strong>{" "}
                  <span className="font-mono text-xs text-texto-atenuado">
                    {queda.cuentas}
                  </span>
                </p>
                <Boton
                  tono="secundario"
                  onClick={() => {
                    setAccion({ tipo: "fusionar", categoria: sobra });
                    setDestino(queda.id);
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <GitMerge size={16} aria-hidden />
                    Unir en «{queda.nombre}»
                  </span>
                </Boton>
              </Tarjeta>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-texto">
          Todas · {categorias.length}
        </h2>

        {categorias.map((c) => (
          <Tarjeta key={c.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-texto">{c.nombre}</p>
              <Insignia tono={c.cuentas > 0 ? "info" : "neutro"}>
                {c.cuentas === 1 ? "1 cuenta" : `${c.cuentas} cuentas`}
              </Insignia>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccion({ tipo: "renombrar", categoria: c });
                  setTexto(c.nombre);
                }}
                className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto"
              >
                <Pencil size={14} aria-hidden />
                Corregir
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccion({ tipo: "fusionar", categoria: c });
                  setDestino("");
                }}
                className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto"
              >
                <GitMerge size={14} aria-hidden />
                Unir
              </button>
              <button
                type="button"
                onClick={() => setAccion({ tipo: "desactivar", categoria: c })}
                className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto"
              >
                <EyeOff size={14} aria-hidden />
                Ocultar
              </button>
            </div>
          </Tarjeta>
        ))}
      </section>

      {accion && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4">
          <Tarjeta className="flex w-full flex-col gap-3">
            {accion.tipo === "renombrar" && (
              <>
                <p className="text-base font-semibold text-texto">
                  Corregir «{accion.categoria.nombre}»
                </p>
                <Campo
                  etiqueta="Cómo debe escribirse"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  ayuda={`Las ${accion.categoria.cuentas} cuentas que la usan pasan a decir lo mismo.`}
                />
              </>
            )}

            {accion.tipo === "fusionar" && (
              <>
                <p className="text-base font-semibold text-texto">
                  Unir «{accion.categoria.nombre}» con otra
                </p>
                <p className="text-sm text-texto-secundario">
                  Sus {accion.categoria.cuentas} cuentas pasan a la que elijas, y
                  «{accion.categoria.nombre}» desaparece del catálogo.
                </p>
                <div className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-borde">
                  {categorias
                    .filter((o) => o.id !== accion.categoria.id)
                    .map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setDestino(o.id)}
                        aria-pressed={destino === o.id}
                        className={`min-h-tactil flex items-center justify-between gap-2 border-b border-borde px-3 text-left text-sm last:border-b-0 ${
                          destino === o.id
                            ? "bg-marca text-white"
                            : "bg-superficie text-texto"
                        }`}
                      >
                        {o.nombre}
                        <span className="font-mono text-xs opacity-70">
                          {o.cuentas}
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}

            {accion.tipo === "desactivar" && (
              <>
                <p className="text-base font-semibold text-texto">
                  Ocultar «{accion.categoria.nombre}»
                </p>
                <p className="text-sm text-texto-secundario">
                  Deja de sugerirse al crear cuentas. Las{" "}
                  {accion.categoria.cuentas} que ya la usan no cambian: sigue
                  siendo cierto que ese comercio es de ese tipo.
                </p>
              </>
            )}

            {error && <MensajeError titulo="No se pudo" detalle={error} />}

            <div className="grid grid-cols-2 gap-2">
              <Boton tono="secundario" onClick={cerrar} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton
                onClick={ejecutar}
                disabled={
                  trabajando ||
                  (accion.tipo === "renombrar" && texto.trim().length < 3) ||
                  (accion.tipo === "fusionar" && !destino)
                }
              >
                {trabajando ? "Guardando" : "Confirmar"}
              </Boton>
            </div>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
