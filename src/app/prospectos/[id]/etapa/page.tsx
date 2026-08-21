"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  ETAPAS,
  MOTIVOS_PERDIDA,
  MOTIVOS_CON_RECONTACTO,
  type Etapa,
  type MotivoPerdida,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

/**
 * Mover el prospecto de etapa.
 *
 * Es la pantalla de la que sale todo lo que gerencia pregunta: la tasa de
 * cierre, el tiempo de ciclo y los prospectos estancados. Cada cambio deja su
 * fila en `auditoria` sin que el vendedor tenga que reportar nada, que es el
 * principio rector del sistema.
 */
export default function CambiarEtapa() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [etapaActual, setEtapaActual] = useState<Etapa | null>(null);
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerdida | null>(null);
  const [fechaRecontacto, setFechaRecontacto] = useState("");

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("prospectos")
      .select("etapa, motivo_perdida, fecha_recontacto")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data, error: fallo }) => {
        if (fallo) setError(fallo.message);
        if (data) {
          setEtapaActual(data.etapa as Etapa);
          setEtapa(data.etapa as Etapa);
          setMotivo((data.motivo_perdida as MotivoPerdida) ?? null);
          setFechaRecontacto(data.fecha_recontacto ?? "");
        }
        setCargando(false);
      });
  }, [id]);

  const esPerdido = etapa === "perdido";
  const exigeFecha =
    esPerdido && motivo !== null && MOTIVOS_CON_RECONTACTO.includes(motivo);

  // Las mismas reglas que impone la base, comprobadas antes de intentar
  // guardar. La base es la que manda; esto solo evita que el vendedor choque
  // contra un error técnico frente al mostrador.
  const listo =
    etapa !== null &&
    (!esPerdido || motivo !== null) &&
    (!exigeFecha || fechaRecontacto !== "");

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!listo) return;
    setError(null);
    setGuardando(true);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("prospectos")
      .update({
        etapa,
        motivo_perdida: esPerdido ? motivo : null,
        fecha_recontacto: exigeFecha ? fechaRecontacto : null,
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/prospectos/${id}`);
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <Link href={`/prospectos/${id}`} className="text-sm text-texto-secundario">
          Volver
        </Link>
        <h1 className="text-lg font-semibold text-marca">Cambiar etapa</h1>
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
                  if (nueva !== "perdido") {
                    setMotivo(null);
                    setFechaRecontacto("");
                  }
                }}
                ayuda="Negociación cubre desde la cotización hasta la decisión final: aprobaciones, pruebas de producto y precio."
              />
            </Tarjeta>

            {esPerdido && (
              <Tarjeta>
                <Opciones
                  etiqueta="Motivo de la pérdida"
                  opciones={MOTIVOS_PERDIDA}
                  valor={motivo}
                  onCambio={(nuevo) => {
                    setMotivo(nuevo);
                    if (!MOTIVOS_CON_RECONTACTO.includes(nuevo)) {
                      setFechaRecontacto("");
                    }
                  }}
                  ayuda="Obligatorio. Sin motivo, la base no deja marcar un prospecto como perdido."
                />
              </Tarjeta>
            )}

            {exigeFecha && (
              <Tarjeta>
                <Campo
                  etiqueta="Fecha de recontacto"
                  type="date"
                  required
                  min={hoyEnPanama()}
                  value={fechaRecontacto}
                  onChange={(e) => setFechaRecontacto(e.target.value)}
                  ayuda="Este motivo no cierra el punto, lo aplaza. Es la mejor lista de reactivación que vas a tener."
                />
              </Tarjeta>
            )}

            {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

            <Boton
              type="submit"
              ancho
              disabled={guardando || !listo || etapa === etapaActual}
            >
              {guardando
                ? "Guardando"
                : etapa === etapaActual
                  ? "Elige una etapa distinta"
                  : "Guardar etapa"}
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}
