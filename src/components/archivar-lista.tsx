"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { MensajeError } from "@/components/ui/estados";

/**
 * Retirar una lista de circulación.
 *
 * **Archivar es lo normal y borrar es la excepción**, y la diferencia no es de
 * matiz: una lista con puntos adentro representa horas de planificación. Se
 * archiva y se guarda entera, con quién estaba y qué se trabajó.
 *
 * Borrar se reserva para la que nació con un dedazo en el nombre y nunca llegó
 * a tener nada dentro. Ahí no hay nada que guardar — y la base lo impone, no
 * esta pantalla: intentar borrar una con puntos rebota con su explicación.
 *
 * Las dos son marca, no destrucción (§16). La fila se queda; deja de verse.
 */
export function ArchivarLista({
  listaId,
  nombre,
  vacia,
}: {
  listaId: string;
  nombre: string;
  /** Sin puntos adentro. Solo entonces se ofrece borrarla. */
  vacia: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retirar(borrar: boolean) {
    setTrabajando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("listas")
      .update(
        borrar
          ? { deleted_at: new Date().toISOString() }
          : { archivada: true },
      )
      .eq("id", listaId);

    if (fallo) {
      setError(fallo.message);
      setTrabajando(false);
      return;
    }

    router.replace("/listas");
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center justify-center text-sm text-texto-atenuado"
      >
        Retirar esta lista
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borde bg-fondo p-3">
      {vacia ? (
        <p className="text-xs text-texto-secundario">
          <strong>{nombre}</strong> está vacía. Si la creaste por error, bórrala;
          si la vas a llenar después, archívala y vuelve cuando quieras.
        </p>
      ) : (
        <p className="text-xs text-texto-secundario">
          <strong>{nombre}</strong> tiene puntos adentro, así que se archiva en
          vez de borrarse: se guarda entera con lo que trabajaste y deja de
          aparecer en tus listas.
        </p>
      )}

      {error && <MensajeError titulo="No se pudo" detalle={error} />}

      <div className="flex flex-col gap-2">
        <Boton
          tono="secundario"
          ancho
          disabled={trabajando}
          onClick={() => retirar(false)}
        >
          <span className="flex items-center justify-center gap-2">
            <Archive size={16} aria-hidden />
            Archivarla
          </span>
        </Boton>

        {vacia && (
          <Boton
            tono="destructivo"
            ancho
            disabled={trabajando}
            onClick={() => retirar(true)}
          >
            <span className="flex items-center justify-center gap-2">
              <Trash2 size={16} aria-hidden />
              Borrarla
            </span>
          </Boton>
        )}

        <Boton tono="secundario" ancho onClick={() => setAbierto(false)}>
          Dejarla como está
        </Boton>
      </div>
    </div>
  );
}
