"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError } from "@/components/ui/estados";

export type CierreDeAlguien = {
  id: string;
  vendedor: string;
  semana: string;
  esDeEstaSemana: boolean;
  numeros: Record<string, number>;
  sorprendio: string | null;
  freno: string | null;
  necesito: string | null;
  apuestaPotenciales: number | null;
  apuestaClientes: number | null;
  respuesta: string | null;
  respondido: boolean;
};

const FECHA = new Intl.DateTimeFormat("es-PA", {
  day: "numeric",
  month: "short",
  timeZone: "America/Panama",
});

/** Solo lo que hace falta para responder. El detalle está en su expediente. */
const A_LA_VISTA: [string, string][] = [
  ["interacciones", "Interacciones"],
  ["visitas", "Visitas"],
  ["verificadas", "Verificadas"],
  ["cuentasTocadas", "Cuentas distintas"],
  ["diasVendibles", "Días vendibles"],
  ["compromisosCumplidos", "Compromisos cumplidos"],
  ["compromisosVencidos", "Compromisos vencidos"],
];

export function ListaCierres({ cierres }: { cierres: CierreDeAlguien[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function responder(id: string) {
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Solo la respuesta. El trigger de la base rechaza cualquier intento de
    // tocar el plan, aunque esta pantalla no lo ofrezca.
    const { error: fallo } = await supabase
      .from("cierres")
      .update({
        respuesta: texto.trim(),
        respondido_por: user?.id ?? null,
        respondido_en: new Date().toISOString(),
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setAbierto(null);
    setTexto("");
    setGuardando(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {cierres.map((c) => {
        const gps =
          c.numeros.visitas > 0
            ? Math.round((c.numeros.verificadas / c.numeros.visitas) * 100)
            : null;

        return (
          <Tarjeta key={c.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-texto">
                  {c.vendedor}
                </p>
                <p className="font-mono text-xs text-texto-atenuado">
                  Semana del {FECHA.format(new Date(`${c.semana}T12:00:00`))}
                </p>
              </div>
              <Insignia tono={c.respondido ? "ok" : "aviso"}>
                {c.respondido ? "Respondido" : "Sin responder"}
              </Insignia>
            </div>

            <dl className="flex flex-col gap-1 text-sm">
              {A_LA_VISTA.map(([clave, etiqueta]) =>
                c.numeros[clave] === undefined ? null : (
                  <div key={clave} className="flex justify-between gap-2">
                    <dt className="text-texto-secundario">{etiqueta}</dt>
                    <dd className="font-mono text-texto">
                      {c.numeros[clave]}
                    </dd>
                  </div>
                ),
              )}
            </dl>

            {/* El porcentaje de verificadas en ámbar cuando cae. No es una
                acusación: es el renglón por el que hay que preguntar. */}
            {gps !== null && gps < 70 && (
              <p className="text-xs text-aviso">
                {gps}% de sus visitas quedaron verificadas. Vale la pena
                preguntar qué pasó.
              </p>
            )}

            {(c.sorprendio || c.freno || c.necesito) && (
              <div className="flex flex-col gap-2 rounded-lg bg-fondo p-3">
                {c.sorprendio && (
                  <p className="text-sm text-texto">
                    <span className="text-texto-secundario">Le sorprendió: </span>
                    {c.sorprendio}
                  </p>
                )}
                {c.freno && (
                  <p className="text-sm text-texto">
                    <span className="text-texto-secundario">Lo frenó: </span>
                    {c.freno}
                  </p>
                )}
                {/* La que devuelve algo. Va destacada por eso. */}
                {c.necesito && (
                  <p className="text-sm font-medium text-texto">
                    <span className="text-texto-secundario">Necesita: </span>
                    {c.necesito}
                  </p>
                )}
              </div>
            )}

            {c.apuestaPotenciales !== null && (
              <p className="text-sm text-texto-secundario">
                Apuesta la semana entrante:{" "}
                <span className="font-mono text-texto">{c.apuestaPotenciales}</span>{" "}
                potenciales
                {c.apuestaClientes !== null && (
                  <>
                    {" y "}
                    <span className="font-mono text-texto">
                      {c.apuestaClientes}
                    </span>{" "}
                    clientes
                  </>
                )}
                .
              </p>
            )}

            {c.respuesta && (
              <p className="rounded-lg border border-borde p-2 text-sm text-texto">
                {c.respuesta}
              </p>
            )}

            {abierto === c.id ? (
              <div className="flex flex-col gap-2">
                <Campo
                  etiqueta="Tu respuesta"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  ayuda="Cuestiona, pregunta, agrega un objetivo. El plan es de él: no se reescribe."
                />
                {error && (
                  <MensajeError titulo="No se pudo guardar" detalle={error} />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Boton
                    tono="secundario"
                    ancho
                    onClick={() => setAbierto(null)}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    ancho
                    disabled={guardando || !texto.trim()}
                    onClick={() => responder(c.id)}
                  >
                    {guardando ? "Guardando" : "Responder"}
                  </Boton>
                </div>
              </div>
            ) : (
              <Boton
                tono="secundario"
                ancho
                onClick={() => {
                  setAbierto(c.id);
                  setTexto(c.respuesta ?? "");
                }}
              >
                {c.respondido ? "Cambiar la respuesta" : "Responder"}
              </Boton>
            )}
          </Tarjeta>
        );
      })}
    </div>
  );
}
