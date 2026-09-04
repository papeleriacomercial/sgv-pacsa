"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError } from "@/components/ui/estados";
import { ElegirTodos } from "@/components/ui/elegir-todos";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";

export type Candidato = {
  id: string;
  nombre: string;
  tipoComercio: string | null;
  poblado: string | null;
  /** Lo que ya te compra al mes. Ordena la lista: el que más compra, primero. */
  compraAlMes: number;
  faltan: { linea: string; deCada10: number; gastoTipico: number }[];
};

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Escoger qué clientes entran a la lista para ofrecerles lo que no compran.
 *
 * **Se marcan varios y se agregan de un golpe.** Agregar uno por uno con un
 * viaje a la base cada vez es lo que hace que nadie arme la ruta completa: a
 * la quinta el vendedor se cansa y sale con cinco.
 *
 * No hay tope. El compromiso de la semana es dónde se decide cuántos se
 * trabajan; la lista es dónde se guarda a quién hay que ir.
 */
export function ElegirParaCruzar({
  listaId,
  candidatos,
}: {
  listaId: string;
  candidatos: Candidato[];
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function agregar() {
    if (marcados.length === 0) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("listas_cuentas")
      .insert(marcados.map((cuenta_id) => ({ lista_id: listaId, cuenta_id })));

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.push(`/listas/${listaId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto-secundario">
        Clientes de esta zona que ya te compran una línea y no otra que sí
        compra la mitad o más de los comercios de su tipo. Marca los que vas a
        visitar.
      </p>

      {/* **Acá se eligen casi siempre todos, y ese es el punto.** La pantalla ya viene filtrada:
          son los clientes de la zona a los que les falta una línea que compra la mitad de su
          gremio. Marcarlos uno por uno es cobrarle al vendedor por un cruce que ya hizo la
          consulta. */}
      <ElegirTodos
        total={candidatos.length}
        elegidos={marcados.length}
        sustantivo="clientes"
        onTodos={() => setMarcados(candidatos.map((c) => c.id))}
        onNinguno={() => setMarcados([])}
      />

      {candidatos.map((c) => {
        const marcado = marcados.includes(c.id);
        return (
          <Tarjeta
            key={c.id}
            className={`flex items-start gap-3 ${marcado ? "border-marca/40 bg-fondo" : ""}`}
          >
            <input
              type="checkbox"
              checked={marcado}
              onChange={() => alternar(c.id)}
              aria-label={`Agregar ${c.nombre}`}
              className="mt-1 size-5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                  {c.nombre}
                </p>
                {c.compraAlMes > 0 && (
                  <span className="shrink-0 font-mono text-xs text-texto-secundario">
                    {DINERO.format(c.compraAlMes)}/mes
                  </span>
                )}
              </div>

              <p className="truncate text-xs text-texto-atenuado">
                {c.tipoComercio}
                {c.poblado && ` · ${c.poblado}`}
              </p>

              {/* Qué ofrecerle, con la fuerza del argumento al lado. Sin eso el
                  vendedor llega sabiendo que «algo le falta» y no qué decir. */}
              <div className="mt-1.5 flex flex-col gap-1">
                {c.faltan.map((f) => (
                  <p key={f.linea} className="flex items-center gap-1.5 text-xs">
                    <Insignia tono="aviso">
                      {LINEAS_PRODUCTO[f.linea as LineaProducto] ?? f.linea}
                    </Insignia>
                    <span className="text-texto-atenuado">
                      {f.deCada10} de cada 10 lo compran
                      {f.gastoTipico > 0 && ` · ~${DINERO.format(f.gastoTipico)}/mes`}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </Tarjeta>
        );
      })}

      {error && (
        <MensajeError
          titulo="No se pudieron agregar"
          detalle={error}
        />
      )}

      {/* Pegado abajo: la lista es larga y el botón tiene que estar donde el
          pulgar lo alcance sin volver arriba. */}
      <div className="sticky bottom-0 -mx-4 border-t border-borde bg-superficie p-4">
        <Boton onClick={agregar} disabled={guardando || marcados.length === 0}>
          <span className="flex items-center justify-center gap-2">
            <ListPlus size={18} aria-hidden />
            {marcados.length === 0
              ? "Marca a quién vas a visitar"
              : `Agregar ${marcados.length} a la lista`}
          </span>
        </Boton>
      </div>
    </div>
  );
}
