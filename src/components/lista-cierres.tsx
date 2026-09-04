"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
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
  /** Para gerencia, que durante el arranque ve al líder y a los vendedores en la misma lista. */
  esLider: boolean;
  numeros: Record<string, number>;
  sorprendio: string | null;
  freno: string | null;
  necesito: string | null;
  apuestaPotenciales: number | null;
  apuestaClientes: number | null;
  respuesta: string | null;
  respondido: boolean;
  /** Ya lo revisó quien lo tenía que revisar. Mientras sea falso, el dueño puede corregirlo. */
  visto: boolean;
  /** El plan de la semana entrante, día por día y con los nombres ya resueltos. */
  plan: { dia: string; puestas: { lista: string; cantidad: number }[] }[];
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
  const [marcarVisto, setMarcarVisto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Responder, marcar como visto, o las dos cosas.
   *
   * **SON DOS GESTOS DISTINTOS Y AHÍ ESTÁ LA REGLA ENTERA.** El que tiene una observación responde y
   * **no** marca: con eso el plan queda abierto y el vendedor lo puede corregir. El que no tiene nada
   * que decir marca, y lo congela. No hace falta un botón de «reabrir» — no marcar *es* dejarlo
   * abierto.
   */
  async function guardar(id: string) {
    if (!texto.trim() && !marcarVisto) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // La respuesta y el visto, nada más. El trigger de la base rechaza cualquier intento de tocar
    // una cifra o el plan, aunque esta pantalla no lo ofrezca.
    const { error: fallo } = await supabase
      .from("cierres")
      .update({
        ...(texto.trim()
          ? {
              respuesta: texto.trim(),
              respondido_por: user?.id ?? null,
              respondido_en: new Date().toISOString(),
            }
          : {}),
        ...(marcarVisto
          ? { visto_por: user?.id ?? null, visto_en: new Date().toISOString() }
          : {}),
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setAbierto(null);
    setTexto("");
    setMarcarVisto(false);
    setGuardando(false);
    router.refresh();
  }

  /** Devolverle el plan al vendedor después de haberlo marcado, por si al releerlo apareció algo. */
  async function reabrir(id: string) {
    setGuardando(true);
    setError(null);

    const { error: fallo } = await clienteNavegador()
      .from("cierres")
      .update({ visto_en: null, visto_por: null })
      .eq("id", id);

    if (fallo) setError(fallo.message);
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
                <p className="flex items-center gap-2 text-base font-semibold text-texto">
                  {c.vendedor}
                  {c.esLider && (
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Líder
                    </span>
                  )}
                </p>
                <p className="font-mono text-xs text-texto-atenuado">
                  Semana del {FECHA.format(new Date(`${c.semana}T12:00:00`))}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Insignia tono={c.respondido ? "ok" : "aviso"}>
                  {c.respondido ? "Respondido" : "Sin responder"}
                </Insignia>
                {/* «PUEDE CORREGIR» ES LA MITAD ÚTIL DE ESTE PAR. Que esté visto no sorprende a
                    nadie; lo que hay que saber de un vistazo es cuáles siguen abiertos, porque son
                    los que el vendedor todavía puede arreglar si uno lo llama. */}
                <Insignia tono={c.visto ? "neutro" : "info"}>
                  {c.visto ? "Visto" : "Puede corregir"}
                </Insignia>
              </div>
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

            {/* EL PLAN DE LA SEMANA ENTRANTE. Faltaba: esta pantalla pedía responder a un plan que
                no mostraba, y el estado vacío llevaba meses prometiendo «aparecen aquí con sus
                números y su plan». Se escribía en la base y no lo leía ninguna pantalla. */}
            <div className="flex flex-col gap-1 rounded-lg border border-borde p-3">
              <p className="text-xs text-texto-secundario">Su plan de la semana entrante</p>

              {c.plan.every((d) => d.puestas.length === 0) ? (
                <p className="text-sm text-texto-secundario">
                  No repartió la semana por día.
                </p>
              ) : (
                c.plan.map((d) => (
                  <div key={d.dia} className="flex items-baseline gap-2 text-sm">
                    <span className="w-20 shrink-0 capitalize text-texto-secundario">
                      {d.dia}
                    </span>
                    {d.puestas.length === 0 ? (
                      <span className="text-texto-atenuado">—</span>
                    ) : (
                      <span className="min-w-0 flex-1">
                        {d.puestas.map((p, i) => (
                          <span key={`${p.lista}-${i}`}>
                            {i > 0 && ", "}
                            {/* EL CERO EN ÁMBAR. Marcar la lista y dejar la cantidad en blanco es
                                el error real —pasó el 31 de agosto, los cinco días en cero— y sin
                                señalarlo se lee como un plan hecho. */}
                            <span
                              className={
                                p.cantidad > 0
                                  ? "font-mono text-texto"
                                  : "font-mono text-aviso"
                              }
                            >
                              {p.cantidad}
                            </span>{" "}
                            <span className="text-texto-secundario">de {p.lista}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

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

                {/* LA CASILLA DICE LA CONSECUENCIA, NO EL NOMBRE DEL CAMPO. «Visto» a secas no le
                    dice a nadie que al marcarlo el otro deja de poder corregir, que es justamente
                    lo único que hay que saber antes de tocarla. */}
                {!c.visto && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcarVisto}
                    onClick={() => setMarcarVisto((v) => !v)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                      marcarVisto ? "border-marca bg-marca/5" : "border-borde"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
                        marcarVisto
                          ? "border-marca bg-marca text-white"
                          : "border-borde bg-fondo"
                      }`}
                    >
                      {marcarVisto && <Check size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-texto">
                        Marcarlo como visto
                      </span>
                      {/* LA CONSECUENCIA SE DICE SIEMPRE, MARCADA O NO. Puesta sólo cuando ya está
                          marcada llega tarde: se lee después de haber decidido. Es lo que pidió el
                          usuario — que al líder le quede claro que el plan se traba. */}
                      <span className="block text-xs text-texto-secundario">
                        Una vez marcado, {c.vendedor.split(" ")[0]} ya no puede
                        modificar su plan de esta semana.
                      </span>
                      {!marcarVisto && (
                        <span className="block text-xs text-texto-secundario">
                          Si le vas a pedir que corrija algo, déjalo sin marcar.
                        </span>
                      )}
                    </span>
                  </button>
                )}

                {error && (
                  <MensajeError titulo="No se pudo guardar" detalle={error} />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Boton
                    tono="secundario"
                    ancho
                    onClick={() => {
                      setAbierto(null);
                      setMarcarVisto(false);
                    }}
                  >
                    Cancelar
                  </Boton>
                  {/* EL BOTÓN DICE LO QUE VA A PASAR. Con la casilla puesta y sin texto,
                      «Responder» sería mentira: no se está respondiendo nada. */}
                  <Boton
                    ancho
                    disabled={guardando || (!texto.trim() && !marcarVisto)}
                    onClick={() => guardar(c.id)}
                  >
                    {guardando
                      ? "Guardando"
                      : texto.trim() && marcarVisto
                        ? "Responder y marcar"
                        : marcarVisto
                          ? "Marcar como visto"
                          : "Responder"}
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Boton
                  tono="secundario"
                  ancho
                  onClick={() => {
                    setAbierto(c.id);
                    setTexto(c.respuesta ?? "");
                    setMarcarVisto(false);
                  }}
                >
                  {c.respondido ? "Cambiar la respuesta" : "Responder"}
                </Boton>

                {/* MARCAR ES REVERSIBLE, Y TIENE QUE SERLO. Uno marca, sigue leyendo y encuentra
                    el cinco de cero — sin esto habría que llamar a alguien para desatascarlo. */}
                {c.visto && (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => reabrir(c.id)}
                    className="min-h-tactil text-xs text-texto-secundario underline underline-offset-2 disabled:opacity-50"
                  >
                    Devolvérselo para que corrija
                  </button>
                )}
              </div>
            )}
          </Tarjeta>
        );
      })}
    </div>
  );
}
