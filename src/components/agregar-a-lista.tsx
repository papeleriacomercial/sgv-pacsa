"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

type Fila = { id: string; nombre: string };

/**
 * Meter una cuenta a una lista desde su expediente.
 *
 * El camino normal es al revés —los puntos se escogen en el mapa y caen en la
 * lista— pero pasa seguido que al abrir un expediente uno se acuerda de que
 * esa cuenta pertenece a la ruta que está armando. Sin esto habría que volver
 * al mapa y buscarla otra vez.
 */
export function AgregarALista({ cuentaId }: { cuentaId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [listas, setListas] = useState<Fila[]>([]);
  const [yaEsta, setYaEsta] = useState<string[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;

    const supabase = clienteNavegador();

    supabase
      .from("listas")
      .select("id, nombre")
      .eq("archivada", false)
      .is("deleted_at", null)
      .order("nombre")
      .then(({ data }) => setListas((data ?? []) as Fila[]));

    supabase
      .from("listas_cuentas")
      .select("lista_id")
      .eq("cuenta_id", cuentaId)
      .then(({ data }) =>
        setYaEsta((data ?? []).map((f) => f.lista_id as string)),
      );
  }, [abierto, cuentaId]);

  async function agregar(listaId: string) {
    setGuardando(listaId);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("listas_cuentas")
      .insert({ lista_id: listaId, cuenta_id: cuentaId });

    if (fallo) {
      setError(fallo.message);
      setGuardando(null);
      return;
    }

    setYaEsta((antes) => [...antes, listaId]);
    setGuardando(null);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <ListPlus size={16} aria-hidden />
        Agregar a una lista
      </button>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      <p className="text-sm font-medium text-texto">¿A qué lista?</p>

      {listas.length === 0 && (
        <p className="text-xs text-texto-atenuado">
          Todavía no tienes listas. Se crean desde la pantalla de Listas.
        </p>
      )}

      {listas.map((l) => {
        const dentro = yaEsta.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            disabled={dentro || guardando !== null}
            onClick={() => agregar(l.id)}
            className={`min-h-tactil flex items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm ${
              dentro
                ? "border-borde bg-fondo text-texto-atenuado"
                : "border-borde bg-superficie text-texto"
            }`}
          >
            <span>{l.nombre}</span>
            {dentro && <span className="text-xs">Ya está</span>}
            {guardando === l.id && <span className="text-xs">Agregando</span>}
          </button>
        );
      })}

      {error && <MensajeError titulo="No se pudo agregar" detalle={error} />}

      <Boton tono="secundario" ancho onClick={() => setAbierto(false)}>
        Cerrar
      </Boton>
    </Tarjeta>
  );
}
