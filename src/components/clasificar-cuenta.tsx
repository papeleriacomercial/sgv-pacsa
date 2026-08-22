"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  MOTIVOS_DESCARTE,
  type MotivoDescarte,
  type TipoCuenta,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

/**
 * Mover la cuenta por su ciclo de vida.
 *
 *   sin_clasificar → prospecto → cliente
 *                 ↘ descartada
 *
 * Los tres saltos son hechos comerciales distintos y ninguno se deduce solo:
 * lo marca el vendedor, y queda en `auditoria` sin que nadie lo reporte.
 *
 * Descartar **no borra**. La cuenta se queda con su visita y su motivo, porque
 * saber que alguien ya fue y no sirvió es lo que evita que otro repita el
 * viaje. Simplemente deja de estorbar: sale de la cartera del día salvo que se
 * pidan las descartadas. Ver D-010 en docs/06-decisiones.md.
 */
export function ClasificarCuenta({
  id,
  tipo,
  motivoDescarte,
}: {
  id: string;
  tipo: TipoCuenta;
  motivoDescarte: MotivoDescarte | null;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDescarte | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mover(destino: TipoCuenta, razon: MotivoDescarte | null) {
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cuentas")
      // El motivo se limpia al salir de descartada: la base tiene un `check`
      // que exige motivo si y solo si la cuenta está descartada.
      .update({ tipo: destino, motivo_descarte: razon })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setDescartando(false);
    setMotivo(null);
    setGuardando(false);
    router.refresh();
  }

  if (descartando) {
    return (
      <Tarjeta className="flex flex-col gap-4">
        <Opciones
          etiqueta="¿Por qué se descarta?"
          opciones={MOTIVOS_DESCARTE}
          valor={motivo}
          onCambio={setMotivo}
          ayuda="Queda registrado. Es lo que evita que otro vendedor repita el viaje."
        />

        {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

        <div className="grid grid-cols-2 gap-2">
          <Boton
            tono="secundario"
            ancho
            onClick={() => {
              setDescartando(false);
              setMotivo(null);
            }}
          >
            Cancelar
          </Boton>
          <Boton
            tono="destructivo"
            ancho
            disabled={guardando || motivo === null}
            onClick={() => mover("descartada", motivo)}
          >
            {guardando ? "Guardando" : "Descartar"}
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  if (tipo === "descartada") {
    return (
      <Tarjeta className="flex flex-col gap-3 border-slate-300 bg-slate-50">
        <div>
          <p className="text-sm font-medium text-texto">Cuenta descartada</p>
          <p className="text-sm text-texto-secundario">
            {motivoDescarte
              ? MOTIVOS_DESCARTE[motivoDescarte]
              : "Sin motivo registrado"}
          </p>
        </div>
        {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}
        <Boton
          tono="secundario"
          ancho
          disabled={guardando}
          onClick={() => mover("prospecto", null)}
        >
          {guardando ? "Guardando" : "Reactivar como prospecto"}
        </Boton>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

      <div className="grid grid-cols-2 gap-2">
        {tipo === "sin_clasificar" && (
          <Boton
            tono="secundario"
            ancho
            disabled={guardando}
            onClick={() => mover("prospecto", null)}
          >
            Es prospecto
          </Boton>
        )}

        {tipo === "prospecto" && (
          <Boton
            tono="secundario"
            ancho
            disabled={guardando}
            onClick={() => mover("cliente", null)}
          >
            Marcar como cliente
          </Boton>
        )}

        {tipo === "cliente" && (
          <Boton
            tono="secundario"
            ancho
            disabled={guardando}
            onClick={() => mover("prospecto", null)}
          >
            Volver a prospecto
          </Boton>
        )}

        {/* A un cliente no se le ofrece descartar: si dejó de comprar, eso se
            resuelve devolviéndolo a prospecto primero. */}
        {tipo !== "cliente" && (
          <Boton tono="secundario" ancho onClick={() => setDescartando(true)}>
            Descartar
          </Boton>
        )}
      </div>
    </div>
  );
}
