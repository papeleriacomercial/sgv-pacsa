"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, Vacio } from "@/components/ui/estados";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  unidad: string | null;
  precio: string | number | null;
  existencia: string | number;
};

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

/**
 * Consultar precio y existencia parado frente al mostrador.
 *
 * Son las dos preguntas que hoy se contestan llamando a la oficina: **¿lo
 * tienen?** y **¿a cómo?** Con 1 834 productos, una lista completa no sirve —
 * lo único que sirve es escribir dos palabras y ver tres renglones.
 *
 * **Lo que hay en existencia sale primero**, porque es lo que se puede
 * prometer hoy. Y el precio en cero de Books no se muestra como «$0»: en ese
 * catálogo el cero significa que se acuerda con el cliente, y enseñarlo sería
 * mentir en el peor momento posible.
 */
export function BuscadorProductos() {
  const [texto, setTexto] = useState("");

  // **Un solo estado con lo buscado y su respuesta.** Guardar «para qué texto»
  // es lo que permite saber si se está esperando sin tener que fijar un
  // `buscando` a mano dentro del efecto: se deduce comparando.
  const [resultado, setResultado] = useState<{
    para: string;
    productos: Producto[];
    error: string | null;
  }>({ para: "", productos: [], error: null });

  const consulta = texto.trim();
  const hayTexto = consulta.length >= 2;
  const alDia = resultado.para === consulta;
  const buscando = hayTexto && !alDia;

  useEffect(() => {
    if (consulta.length < 2) return;

    // Sin esto, cada tecla es una consulta. Un cuarto de segundo alcanza para
    // que no se note la espera y para no disparar diez búsquedas por palabra.
    const temporizador = setTimeout(async () => {
      const supabase = clienteNavegador();
      const { data, error: fallo } = await supabase.rpc("buscar_productos", {
        p_texto: consulta,
        p_limite: 40,
      });

      setResultado({
        para: consulta,
        productos: fallo ? [] : ((data as Producto[]) ?? []),
        error: fallo?.message ?? null,
      });
    }, 250);

    return () => clearTimeout(temporizador);
  }, [consulta]);

  // Mientras se espera la respuesta nueva no se enseña la vieja: sería peor
  // que no enseñar nada, porque parece que ya contestó.
  const productos = useMemo(
    () => (alDia ? resultado.productos : []),
    [alDia, resultado.productos],
  );
  const error = alDia ? resultado.error : null;

  const conStock = useMemo(
    () => productos.filter((p) => Number(p.existencia) > 0).length,
    [productos],
  );

  return (
    <div className="flex flex-col gap-3">
      <Campo
        etiqueta="Qué buscas"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="rollo termico 80"
        ayuda="Palabras sueltas, en cualquier orden. No hacen falta acentos."
      />

      {buscando && <Cargando texto="Buscando" />}

      {!buscando && hayTexto && productos.length === 0 && !error && (
        <Tarjeta>
          <Vacio titulo="Nada con ese nombre">
            Prueba con menos palabras, o con parte del nombre.
          </Vacio>
        </Tarjeta>
      )}

      {!buscando && productos.length > 0 && (
        <p className="text-xs text-texto-atenuado">
          {productos.length} {productos.length === 1 ? "producto" : "productos"}
          {conStock > 0 && ` · ${conStock} con existencia`}
        </p>
      )}

      {productos.map((p) => {
        const existencia = Number(p.existencia);
        const precio = p.precio === null ? null : Number(p.precio);

        return (
          <Tarjeta key={p.id} className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-texto">{p.nombre}</p>

            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span
                className={
                  precio === null ? "text-texto-atenuado" : "font-mono text-texto"
                }
              >
                {precio === null ? "Precio a consultar" : DINERO.format(precio)}
                {p.unidad && precio !== null && (
                  <span className="text-xs text-texto-atenuado"> / {p.unidad}</span>
                )}
              </span>

              <span
                className={`shrink-0 text-xs ${
                  existencia > 0 ? "text-ok" : "text-texto-atenuado"
                }`}
              >
                {existencia > 0 ? `${existencia} disponibles` : "Sin existencia"}
              </span>
            </div>
          </Tarjeta>
        );
      })}

      {!hayTexto && (
        <Tarjeta>
          <Vacio titulo="Escribe qué buscas">
            Precio y existencia de los 1 800 productos, sin llamar a la oficina.
            Lo que hay en bodega aparece primero.
          </Vacio>
        </Tarjeta>
      )}

      {error && (
        <Tarjeta className="border-red-200 bg-red-50">
          <p className="flex items-center gap-2 text-sm text-error">
            <PackageSearch size={16} aria-hidden />
            No se pudo buscar: {error}
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
