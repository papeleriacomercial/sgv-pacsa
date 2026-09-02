"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { nombreDelArchivo } from "@/lib/comparador-xlsx";

/**
 * Una comparación entregada, en la bitácora de la cuenta — §7.10, etapa 3a.
 *
 * **Contesta la pregunta que el vendedor se hace al volver al local**: qué le ofrecí a éste. Sin
 * esto, la hoja se la llevó el cliente y de nuestro lado no quedó nada — el precio va escrito a
 * mano, así que ni siquiera se puede deducir de una lista.
 */
export type ComparacionGuardada = {
  id: string;
  creada_en: string;
  marca_competencia: string | null;
  nuestro_precio_caja: number;
  nuestro_rollos_caja: number;
  nuestro_metros_rollo: number;
  nuestro_calibre: number | null;
  cliente_precio_caja: number | null;
  cliente_rollos_caja: number | null;
  cliente_metros_rollo: number | null;
  ahorro_por_pedido: number | null;
  diferencia_al_ano: number | null;
  archivo_path: string | null;
};

const dinero = (v: number | null) =>
  v === null
    ? "—"
    : `$${v.toLocaleString("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });

export function ComparacionEnLaFicha({
  c,
  nombreCuenta,
}: {
  c: ComparacionGuardada;
  nombreCuenta: string;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    if (!c.archivo_path) return;
    setTrabajando(true);
    setError(null);
    const { data, error: fallo } = await clienteNavegador()
      .storage.from("comparaciones")
      .download(c.archivo_path);

    if (fallo || !data) {
      setError("No se pudo abrir el archivo.");
      setTrabajando(false);
      return;
    }

    // DENTRO DEL DEPÓSITO EL ARCHIVO SE LLAMA `comparacion.xlsx` — tuvo que ser así porque la ruta
    // no admite tildes—, así que al bajarlo hay que devolverle su nombre. Sin esto caen varios
    // archivos idénticos en la carpeta de descargas y no se distinguen entre clientes.
    const url = URL.createObjectURL(data);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreDelArchivo(nombreCuenta);
    enlace.click();
    URL.revokeObjectURL(url);
    setTrabajando(false);
  }

  return (
    <Tarjeta className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-texto">
          {c.marca_competencia ? `Contra ${c.marca_competencia}` : "Comparación de costo"}
        </span>
        <span className="shrink-0 text-xs text-texto-atenuado">{fecha(c.creada_en)}</span>
      </div>

      {/* LO QUE SE LE OFRECIÓ, que es el dato que nadie recuerda a los tres días. El precio va
          escrito a mano en cada visita, así que no se puede deducir de ninguna lista. */}
      <p className="text-xs text-texto-secundario">
        Le ofrecimos {dinero(c.nuestro_precio_caja)} la caja de {c.nuestro_rollos_caja} rollos de{" "}
        {c.nuestro_metros_rollo} m
        {c.nuestro_calibre ? `, calibre ${c.nuestro_calibre} g/m²` : ""}.
      </p>

      {c.cliente_precio_caja !== null && (
        <p className="text-xs text-texto-secundario">
          Él pagaba {dinero(c.cliente_precio_caja)}
          {c.cliente_rollos_caja !== null && c.cliente_metros_rollo !== null
            ? ` la caja de ${c.cliente_rollos_caja} rollos de ${c.cliente_metros_rollo} m`
            : ""}
          .
        </p>
      )}

      {(c.ahorro_por_pedido !== null || c.diferencia_al_ano !== null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {c.ahorro_por_pedido !== null && (
            <span className="text-texto">
              Ahorro por pedido:{" "}
              <span className="font-semibold tabular-nums">{dinero(c.ahorro_por_pedido)}</span>
            </span>
          )}
          {c.diferencia_al_ano !== null && (
            <span className="text-texto">
              Al año:{" "}
              <span className="font-semibold tabular-nums">{dinero(c.diferencia_al_ano)}</span>
            </span>
          )}
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}

      {c.archivo_path ? (
        <Boton tono="secundario" ancho onClick={abrir} disabled={trabajando}>
          {trabajando ? "Bajando…" : "Bajar la hoja que recibió"}
        </Boton>
      ) : (
        // Se dice, no se calla: la copia puede estar esperando señal en la cola, y quien mire la
        // ficha tiene que saber por qué no hay botón en vez de suponer que se perdió.
        <p className="text-xs text-texto-atenuado">
          La copia del archivo todavía no se ha subido.
        </p>
      )}
    </Tarjeta>
  );
}
