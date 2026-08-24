"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { contiene, normalizar } from "@/lib/texto";

type Props = {
  valor: string;
  onCambio: (valor: string) => void;
};

/** Cuántas sugerencias caben sin tapar el resto del formulario. */
const MAXIMO = 6;

/**
 * Campo de categoría de comercio con catálogo que se alimenta solo.
 *
 * El vendedor escribe una categoría nueva y queda disponible para todo el
 * equipo la próxima vez. Es la excepción a D-004 —que fijó los catálogos como
 * enums cerrados— porque nadie puede enumerar por adelantado los tipos de
 * comercio de un país, y la lista crece con cada zona que se abre.
 *
 * **Antes era un `datalist` y no servía.** El navegador decide solo cuándo
 * mostrarlo, en el celular a veces no aparece, y —lo que rompió el catálogo—
 * compara letra por letra: escribiendo «panaderia» no ofrecía «Panadería», así
 * que el vendedor creía que no existía y escribía la suya. Ahora las
 * sugerencias son parte de la pantalla, salen desde la primera letra y
 * comparan sin acentos ni mayúsculas.
 */
export function CampoCategoria({ valor, onCambio }: Props) {
  const id = useId();
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tocado, setTocado] = useState(false);

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

  const escrito = valor.trim();

  // Sin escribir nada se ofrece el catálogo entero (recortado): es la forma de
  // descubrir qué existe sin tener que adivinar la primera letra.
  const sugerencias = useMemo(() => {
    if (!escrito) return categorias.slice(0, MAXIMO);
    return categorias.filter((c) => contiene(c, escrito)).slice(0, MAXIMO);
  }, [categorias, escrito]);

  // Coincidencia exacta ignorando acentos y mayúsculas: si la hay, lo escrito
  // ya es del catálogo aunque no se vea igual.
  const yaExiste = categorias.some((c) => normalizar(c) === normalizar(escrito));
  const elegida = categorias.find((c) => c === escrito);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        Tipo de comercio
      </label>

      <input
        id={id}
        value={valor}
        onChange={(e) => {
          onCambio(e.target.value);
          setTocado(true);
        }}
        onFocus={() => setTocado(true)}
        autoComplete="off"
        autoCapitalize="words"
        placeholder="Panadería, minisuper, ferretería…"
        className="min-h-tactil rounded-lg border border-borde bg-superficie px-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />

      {tocado && sugerencias.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-borde bg-superficie">
          {sugerencias.map((c) => {
            const puesta = c === elegida;
            return (
              <li key={c} className="border-b border-borde last:border-b-0">
                <button
                  type="button"
                  onClick={() => onCambio(c)}
                  className="min-h-tactil flex w-full items-center justify-between gap-2 px-3 text-left text-base text-texto"
                >
                  {c}
                  {puesta && (
                    <Check size={16} className="shrink-0 text-ok" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Decir en voz alta que se está creando algo nuevo es la única defensa
          que queda contra el dedazo: «mimisuper» entró así. */}
      {tocado && escrito.length >= 3 && !yaExiste && (
        <p className="flex items-center gap-1.5 text-xs text-aviso">
          <Plus size={14} className="shrink-0" aria-hidden />
          «{escrito}» es nueva. Va a quedar en el catálogo para todo el equipo.
        </p>
      )}

      <p className="text-xs text-texto-atenuado">
        {categorias.length > 0
          ? `${categorias.length} categorías guardadas.`
          : "Escribe la primera categoría y queda guardada para todo el equipo."}
      </p>
    </div>
  );
}

/**
 * Deja la categoría en el catálogo y devuelve **cómo se escribe**.
 *
 * Quien llama tiene que guardar en la cuenta lo que esta función devuelve, no
 * lo que se escribió: si el catálogo dice «Panadería» y el vendedor tecleó
 * «panaderia», la cuenta se queda con la del catálogo. Sin eso, el catálogo
 * quedaba limpio y los datos sucios — que es exactamente lo que pasó.
 *
 * Se llama al guardar la cuenta, no al escribir: si se guardara con cada
 * tecla, el catálogo se llenaría de «f», «fa», «far», «farm».
 *
 * Sin conexión devuelve lo escrito y sigue: perder la visita por no poder
 * consultar un catálogo sería absurdo. Queda una grafía suelta que el líder ve
 * y corrige desde `/categorias`.
 */
export async function asegurarCategoria(nombre: string): Promise<string | null> {
  const limpio = nombre.trim();
  if (limpio.length < 3) return limpio || null;

  const supabase = clienteNavegador();
  const { data, error } = await supabase.rpc("asegurar_categoria", {
    p_nombre: limpio,
  });

  if (error) return limpio;
  return (data as string | null) ?? limpio;
}
