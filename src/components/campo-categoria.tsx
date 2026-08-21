"use client";

import { useEffect, useId, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";

type Props = {
  valor: string;
  onCambio: (valor: string) => void;
};

/**
 * Campo de categoría de comercio con catálogo que se alimenta solo.
 *
 * El vendedor escribe una categoría nueva y queda disponible para todo el
 * equipo la próxima vez. Es la excepción a D-004 —que fijó los catálogos como
 * enums cerrados— porque nadie puede enumerar por adelantado los tipos de
 * comercio de un país, y la lista crece con cada zona que se abre.
 *
 * Se usa `datalist` y no un desplegable cerrado: deja escribir libremente y a
 * la vez sugiere lo que ya existe. Un desplegable puro obligaría a una segunda
 * pantalla para "agregar categoría", que es un gesto más frente al mostrador.
 */
export function CampoCategoria({ valor, onCambio }: Props) {
  const id = useId();
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("categorias_comercio")
      .select("nombre")
      .eq("activa", true)
      .is("deleted_at", null)
      .order("nombre")
      .then(({ data }) => setCategorias((data ?? []).map((c) => c.nombre)));
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        Tipo de comercio
      </label>

      <input
        id={id}
        list={`${id}-catalogo`}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        autoComplete="off"
        className="min-h-tactil rounded-lg border border-borde bg-superficie px-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />

      <datalist id={`${id}-catalogo`}>
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <p className="text-xs text-texto-atenuado">
        {categorias.length > 0
          ? `${categorias.length} categorías guardadas. Escribe una nueva y queda para todos.`
          : "Escribe la primera categoría y queda guardada para todo el equipo."}
      </p>
    </div>
  );
}

/**
 * Guarda la categoría en el catálogo si todavía no existe.
 *
 * Se llama al guardar la cuenta, no al escribir: si se guardara con cada
 * tecla, el catálogo se llenaría de "f", "fa", "far", "farm".
 *
 * Un choque con el índice único significa que otro vendedor la agregó primero,
 * que es exactamente lo que debe pasar. No es un error que mostrar.
 */
export async function registrarCategoria(nombre: string) {
  const limpio = nombre.trim();
  if (limpio.length < 3) return;

  const supabase = clienteNavegador();
  await supabase
    .from("categorias_comercio")
    .insert({ id: crypto.randomUUID(), nombre: limpio });
}
