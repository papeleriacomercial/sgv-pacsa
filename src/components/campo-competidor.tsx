"use client";

import { useEffect, useId, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Quién le vende hoy, con catálogo que se alimenta solo.
 *
 * `proveedor_actual` era texto libre, y ahí estaba el problema: "el chino",
 * "chino de la esquina", "Distribuidora Wang" y "wang" son cuatro filas que no
 * se pueden sumar. **Sobre texto libre no se construye inteligencia de
 * competencia.**
 *
 * Mismo patrón que las categorías de comercio (D-012): se escribe libremente y
 * a la vez se sugiere lo que ya existe. La sugerencia empuja a que todos
 * escriban igual, que es lo único que hace falta para poder agregar después.
 */
export function CampoCompetidor({
  valor,
  onCambio,
}: {
  valor: string;
  onCambio: (valor: string) => void;
}) {
  const id = useId();
  const [competidores, setCompetidores] = useState<string[]>([]);

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("competidores")
      .select("nombre")
      .eq("activo", true)
      .is("deleted_at", null)
      .order("nombre")
      .then(({ data }) => setCompetidores((data ?? []).map((c) => c.nombre)));
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        ¿Quién se lo vende hoy?
      </label>

      <input
        id={id}
        list={`${id}-catalogo`}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        autoComplete="off"
        placeholder="Escribe o elige de la lista"
        className="min-h-tactil rounded-lg border border-borde bg-superficie px-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />

      <datalist id={`${id}-catalogo`}>
        {competidores.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <p className="text-xs text-texto-atenuado">
        Si es uno nuevo, escríbelo: queda para todo el equipo.
      </p>
    </div>
  );
}

/**
 * Suma el competidor al catálogo compartido si todavía no está.
 *
 * Se llama al guardar, no mientras escribe: si no, el catálogo se llenaría de
 * las mitades de cada palabra.
 */
export async function registrarCompetidor(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) return;

  const supabase = clienteNavegador();
  const { data } = await supabase
    .from("competidores")
    .select("id")
    .ilike("nombre", limpio)
    .is("deleted_at", null)
    .maybeSingle();

  if (data) return;

  await supabase
    .from("competidores")
    .insert({ id: crypto.randomUUID(), nombre: limpio });
}
