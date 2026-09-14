"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { actualizar } from "@/lib/cola";
import {
  AYUDA_CLASE,
  CLASES_VENTA,
  TIPOS_LISTA,
  type ClaseVenta,
  type TipoLista,
} from "@/lib/catalogos";
import { Campo } from "@/components/ui/campo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * Corregir el nombre de una lista y lo que se espera de ella.
 *
 * **Faltaba desde que existen las listas**, y lo notó el usuario: una vez creada, el nombre
 * quedaba fijo para siempre. No es un detalle cosmético — **el nombre de la lista es el
 * recorrido**: «Chilibre–La Cabima» dice por dónde pasa el vendedor ese día. Un error de dedo al
 * crearla se queda ahí, y de hecho quedó: una lista se llama `CALIDONIA Y CENTRAL` y su campo
 * interno decía `CENTARL`.
 *
 * **El tipo no se edita.** Una lista de zona y una de objetivo se trabajan con pantallas
 * distintas —la de objetivo agrega cuentas a mano, la de zona sale a buscar al mapa— y cambiarlo
 * con puntos adentro dejaría la lista a medio camino entre las dos. Si se creó del tipo
 * equivocado, sale más barato archivarla y hacer la correcta.
 *
 * La clase sí, porque es una apuesta: **se escribe antes de saber**, y cuando se sabe hay que
 * poder corregirla. Puede quedar sin escoger, como al crearla.
 */
export function EditarLista({
  id,
  nombre,
  tipo,
  clase,
}: {
  id: string;
  nombre: string;
  tipo: TipoLista;
  clase: ClaseVenta | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState(nombre);
  const [nuevaClase, setNuevaClase] = useState<ClaseVenta | null>(clase);

  function cancelar() {
    setNuevoNombre(nombre);
    setNuevaClase(clase);
    setError(null);
    setAbierto(false);
  }

  async function guardar() {
    const limpio = nuevoNombre.trim();
    if (!limpio) {
      setError("La lista necesita un nombre.");
      return;
    }

    // Nada que guardar no es un error: se cierra y ya.
    if (limpio === nombre && nuevaClase === clase) {
      setAbierto(false);
      return;
    }

    setGuardando(true);
    setError(null);

    const { error: fallo } = await actualizar(
      "listas",
      id,
      { nombre: limpio, clase: nuevaClase },
      `Cambio de ${nombre}`,
    );

    setGuardando(false);

    if (fallo) {
      setError(fallo);
      return;
    }

    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <Tarjeta className="flex flex-wrap items-center gap-2">
        <Insignia tono="neutro">{TIPOS_LISTA[tipo]}</Insignia>
        {clase && (
          <Insignia tono={clase === "grande" ? "info" : "neutro"}>
            {CLASES_VENTA[clase]}
          </Insignia>
        )}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-tactil ml-auto flex items-center gap-2 rounded-lg border border-borde px-3 text-sm text-texto"
        >
          <Pencil size={16} aria-hidden />
          Cambiar
        </button>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      <Campo
        etiqueta="Nombre de la lista"
        value={nuevoNombre}
        onChange={(e) => setNuevoNombre(e.target.value)}
        ayuda="Es el recorrido: «San Francisco–Betania», «Aguadulce», «Cadena de farmacias»."
        autoFocus
      />

      <div>
        <p className="text-sm font-medium text-texto">Qué esperas de esta lista</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(CLASES_VENTA) as ClaseVenta[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={nuevaClase === c}
              onClick={() => setNuevaClase(nuevaClase === c ? null : c)}
              className={`min-h-tactil flex flex-col items-start justify-center rounded-lg border px-3 py-1 text-left ${
                nuevaClase === c
                  ? "border-marca bg-marca text-white"
                  : "border-borde bg-superficie text-texto"
              }`}
            >
              <span className="text-sm">{CLASES_VENTA[c]}</span>
              <span
                className={`text-xs ${nuevaClase === c ? "text-white/80" : "text-texto-atenuado"}`}
              >
                {AYUDA_CLASE[c]}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-texto-atenuado">
          Puede quedar sin escoger. Lo real sale de la fecha de cierre de cada venta.
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <Boton ancho onClick={guardar} disabled={guardando}>
          <Check size={18} aria-hidden />
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
        <button
          type="button"
          onClick={cancelar}
          disabled={guardando}
          className="min-h-tactil flex items-center gap-2 rounded-lg border border-borde px-4 text-base text-texto"
        >
          <X size={18} aria-hidden />
          Cancelar
        </button>
      </div>
    </Tarjeta>
  );
}
