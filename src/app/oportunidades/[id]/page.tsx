"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  ETAPAS,
  LINEAS_PRODUCTO,
  MOTIVOS_PERDIDA,
  type Etapa,
  type LineaProducto,
  type MotivoPerdida,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

export default function EditarOportunidad() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prospectoId, setProspectoId] = useState<string | null>(null);
  const [linea, setLinea] = useState<LineaProducto | null>(null);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerdida | null>(null);

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("oportunidades")
      .select("cuenta_id, linea, monto_estimado, descripcion, etapa, motivo_perdida")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data, error: fallo }) => {
        if (fallo) setError(fallo.message);
        if (data) {
          setProspectoId(data.cuenta_id);
          setLinea(data.linea as LineaProducto);
          setMonto(data.monto_estimado ? String(data.monto_estimado) : "");
          setDescripcion(data.descripcion ?? "");
          setEtapa(data.etapa as Etapa);
          setMotivo((data.motivo_perdida as MotivoPerdida) ?? null);
        }
        setCargando(false);
      });
  }, [id]);

  const esPerdida = etapa === "perdido";
  // La misma regla que impone la base, comprobada antes de chocar con ella.
  const listo = etapa !== null && linea !== null && (!esPerdida || motivo !== null);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!listo) return;
    setError(null);
    setGuardando(true);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("oportunidades")
      .update({
        linea,
        monto_estimado: monto ? Number(monto) : null,
        descripcion: descripcion.trim() || null,
        etapa,
        motivo_perdida: esPerdida ? motivo : null,
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(prospectoId ? `/cuentas/${prospectoId}` : "/oportunidades");
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver
          alterno={prospectoId ? `/cuentas/` : "/oportunidades"}
        />
        <h1 className="text-lg font-semibold text-marca">Oportunidad</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {cargando && <Cargando />}

        {!cargando && (
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <Tarjeta>
              <Opciones
                etiqueta="Etapa"
                opciones={ETAPAS}
                valor={etapa}
                onCambio={(nueva) => {
                  setEtapa(nueva);
                  if (nueva !== "perdido") setMotivo(null);
                }}
              />
            </Tarjeta>

            {esPerdida && (
              <Tarjeta>
                <Opciones
                  etiqueta="Motivo de la pérdida"
                  opciones={MOTIVOS_PERDIDA}
                  valor={motivo}
                  onCambio={setMotivo}
                  ayuda="Obligatorio. Sin motivo, la base no deja marcarla como perdida."
                />
              </Tarjeta>
            )}

            <Tarjeta>
              <Opciones
                etiqueta="Línea de producto"
                opciones={LINEAS_PRODUCTO}
                valor={linea}
                onCambio={setLinea}
              />
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-4">
              <Campo
                etiqueta="Monto estimado"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <Campo
                etiqueta="Detalle"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Tarjeta>

            {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

            <Boton type="submit" ancho disabled={guardando || !listo}>
              {guardando ? "Guardando" : "Guardar oportunidad"}
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}
