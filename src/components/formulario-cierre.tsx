"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import type { Lista } from "@/lib/listas";
import type { Semana } from "@/lib/semana";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError } from "@/components/ui/estados";

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes"] as const;
type Dia = (typeof DIAS)[number];

/** Qué se planifica para cada día: una o varias listas, con su cantidad. */
type PlanDia = { listaId: string; cantidad: number }[];

type Previo = {
  id: string;
  sorprendio: string | null;
  freno: string | null;
  necesito: string | null;
  plan: unknown;
  apuesta_potenciales: number | null;
  apuesta_clientes: number | null;
  enviado_en: string | null;
  /** Cuándo lo revisó su líder. Con esto puesto, el cierre queda como está. */
  visto_en: string | null;
  /** Lo que le contestaron. Se muestra acá porque es donde se viene a corregir. */
  respuesta: string | null;
};

/**
 * El cierre, en cuatro pasos.
 *
 * **Sobre el dictado:** no hay grabación de audio ni transcripción propia. El
 * teclado del celular ya trae micrófono, y con eso el vendedor habla y el
 * teléfono escribe — sin infraestructura nueva, y produciendo texto que se
 * puede buscar y agregar desde el primer día. Si en el piloto resulta que la
 * transcripción del teclado no alcanza, grabar audio es el paso siguiente.
 */
export function FormularioCierre({
  vendedorId,
  semana,
  semanaEntrante,
  numeros,
  listas,
  previo,
}: {
  vendedorId: string;
  semana: string;
  semanaEntrante: string;
  numeros: Semana;
  listas: Lista[];
  previo: Previo | null;
}) {
  const router = useRouter();

  const [paso, setPaso] = useState(1);
  // Ya lo revisaron: de acá en adelante es de lectura. La base lo impide igual —el trigger
  // rechaza el cambio— y esto es para que no se entere escribiendo un párrafo y perdiéndolo.
  const visto = previo?.visto_en != null;

  const [sorprendio, setSorprendio] = useState(previo?.sorprendio ?? "");
  const [freno, setFreno] = useState(previo?.freno ?? "");
  const [necesito, setNecesito] = useState(previo?.necesito ?? "");
  const [plan, setPlan] = useState<Record<Dia, PlanDia>>(() => {
    const base = {} as Record<Dia, PlanDia>;
    for (const d of DIAS) base[d] = [];
    const guardado = previo?.plan as Record<string, PlanDia> | undefined;
    if (guardado) {
      for (const d of DIAS) if (guardado[d]) base[d] = guardado[d];
    }
    return base;
  });
  const [apuestaPotenciales, setApuestaPotenciales] = useState(
    previo?.apuesta_potenciales ? String(previo.apuesta_potenciales) : "",
  );
  const [apuestaClientes, setApuestaClientes] = useState(
    previo?.apuesta_clientes ? String(previo.apuesta_clientes) : "",
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = listas.filter((l) => l.sin_tocar > 0);

  function alternarLista(dia: Dia, listaId: string) {
    setPlan((antes) => {
      const delDia = antes[dia];
      const ya = delDia.find((x) => x.listaId === listaId);
      return {
        ...antes,
        [dia]: ya
          ? delDia.filter((x) => x.listaId !== listaId)
          : [...delDia, { listaId, cantidad: 0 }],
      };
    });
  }

  function ponerCantidad(dia: Dia, listaId: string, cantidad: number) {
    setPlan((antes) => ({
      ...antes,
      [dia]: antes[dia].map((x) =>
        x.listaId === listaId ? { ...x, cantidad } : x,
      ),
    }));
  }

  /**
   * Los días donde marcó una lista y dejó la cantidad en blanco.
   *
   * **ES EL ERROR QUE DE VERDAD PASA, Y PASABA EN SILENCIO.** Tocar el nombre de la lista la
   * pone en el día con cantidad cero y abre la casilla del número al lado; si no se escribe
   * nada, el plan sale marcado y vacío. Ocurrió el 31 de agosto de 2026: el líder marcó la
   * misma lista los cinco días y las cinco cantidades quedaron en cero — un plan que se lee
   * como hecho y no compromete ni una visita. Nada se lo dijo al enviarlo.
   *
   * No es lo mismo que un día vacío: **un día sin lista es una decisión** —ese día no sale— y
   * se respeta. Lo que no puede quedar es una lista puesta sin decir cuántos.
   */
  const diasSinCantidad = DIAS.filter((d) =>
    plan[d].some((x) => !x.cantidad || x.cantidad <= 0),
  );

  // La suma de lo repartido por día. Se ofrece como sugerencia de la apuesta,
  // pero el número lo escribe él: en el momento en que la aplicación lo
  // proponga como meta, deja de ser su plan.
  const sumaDelPlan = DIAS.reduce(
    (total, d) => total + plan[d].reduce((s, x) => s + x.cantidad, 0),
    0,
  );

  async function enviar() {
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();

    // Los números se congelan aquí: la semana 34 tiene que seguir diciendo en
    // diciembre lo que dijo hoy.
    const { error: fallo } = await supabase.from("cierres").upsert(
      {
        id: previo?.id ?? crypto.randomUUID(),
        vendedor_id: vendedorId,
        semana,
        numeros,
        sorprendio: sorprendio.trim() || null,
        freno: freno.trim() || null,
        necesito: necesito.trim() || null,
        plan,
        apuesta_potenciales: apuestaPotenciales ? Number(apuestaPotenciales) : null,
        apuesta_clientes: apuestaClientes ? Number(apuestaClientes) : null,
        enviado_en: new Date().toISOString(),
      },
      { onConflict: "vendedor_id,semana" },
    );

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace("/?vista=semana");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* LO QUE LE CONTESTARON VA ARRIBA, NO AL FINAL. Si vino a corregir es por esto, y
          dejarlo abajo obliga a recorrer cuatro pasos para leerlo. */}
      {previo?.respuesta && (
        <Tarjeta className="flex flex-col gap-1">
          <p className="text-xs text-texto-secundario">Te respondieron</p>
          <p className="text-sm text-texto">{previo.respuesta}</p>
        </Tarjeta>
      )}

      {/* **NO SE ESCONDE EL FORMULARIO, SE DICE POR QUÉ NO SE PUEDE.** Una pantalla que
          desaparece deja a la persona pensando que se le perdió el cierre. */}
      {visto && (
        <Tarjeta className="flex flex-col gap-1 border-borde bg-fondo">
          <p className="text-sm font-medium text-texto">
            Tu líder ya revisó esta semana.
          </p>
          <p className="text-xs text-texto-secundario">
            Queda como está. Lo que quieras cambiar va en el cierre de la próxima.
          </p>
        </Tarjeta>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-texto-secundario">Paso {paso} de 4</p>
        {previo?.enviado_en &&
          (visto ? (
            <Insignia tono="neutro">Revisado</Insignia>
          ) : (
            <Insignia tono="ok">Enviado · lo puedes corregir</Insignia>
          ))}
      </div>

      {paso === 1 && (
        <>
          <Tarjeta className="flex flex-col gap-2">
            <p className="text-sm font-medium text-texto">Tus números</p>
            <p className="text-xs text-texto-secundario">
              Ya están calculados. No hay nada que escribir aquí — solo míralos.
            </p>
            <dl className="mt-1 flex flex-col gap-1 text-sm">
              {[
                ["Interacciones", String(numeros.interacciones)],
                [
                  "Visitas · verificadas",
                  `${numeros.visitas} · ${numeros.verificadas}`,
                ],
                ["Cuentas distintas", String(numeros.cuentasTocadas)],
                ["Cuentas nuevas", String(numeros.cuentasNuevas)],
                ["Compraron de una", String(numeros.aCliente)],
                [
                  "Cartera al día",
                  `${numeros.enCadencia} de ${numeros.clientes}`,
                ],
                [
                  "Compromisos cumplidos",
                  String(numeros.compromisosCumplidos),
                ],
                ["Días vendibles", String(numeros.diasVendibles)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-texto-secundario">{k}</dt>
                  <dd className="font-mono text-texto">{v}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>

          <Boton ancho onClick={() => setPaso(2)}>
            Continuar
          </Boton>
        </>
      )}

      {paso === 2 && (
        <>
          <Tarjeta className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <Mic size={18} className="mt-0.5 shrink-0 text-marca" aria-hidden />
              <p className="text-xs text-texto-secundario">
                Usa el micrófono de tu teclado: habla y el teléfono escribe.
                Noventa segundos alcanzan — los números ya están arriba, esto es
                para lo que ellos no dicen.
              </p>
            </div>

            {/* Tres preguntas fijas y no una caja abierta: "cuéntame la semana"
                produce prosa, y en un mes es la misma frase irrefutable. */}
            <Campo
              etiqueta="¿Qué te sorprendió?"
              value={sorprendio}
              onChange={(e) => setSorprendio(e.target.value)}
            />
            <Campo
              etiqueta="¿Qué te frenó?"
              value={freno}
              onChange={(e) => setFreno(e.target.value)}
            />
            <Campo
              etiqueta="¿Qué necesitas de nosotros?"
              value={necesito}
              onChange={(e) => setNecesito(e.target.value)}
              ayuda="Esta es la que devuelve algo. Si hay algo trancado, dilo aquí."
            />
          </Tarjeta>

          <div className="grid grid-cols-2 gap-2">
            <Boton tono="secundario" ancho onClick={() => setPaso(1)}>
              Atrás
            </Boton>
            <Boton ancho onClick={() => setPaso(3)}>
              Continuar
            </Boton>
          </div>
        </>
      )}

      {paso === 3 && (
        <>
          <Tarjeta>
            <p className="text-sm font-medium text-texto">
              La semana del {semanaEntrante}
            </p>
            <p className="text-xs text-texto-secundario">
              Reparte tus rutas en los días. Un día aguanta más de una, y hay
              días sin ninguna.
            </p>
          </Tarjeta>

          {disponibles.length === 0 && (
            <Tarjeta>
              <p className="text-sm text-texto-secundario">
                No tienes listas con puntos sin tocar. Arma una desde el mapa
                antes de planificar la semana.
              </p>
            </Tarjeta>
          )}

          {disponibles.length > 0 &&
            DIAS.map((dia) => (
              <Tarjeta key={dia} className="flex flex-col gap-2">
                <p className="text-sm font-medium capitalize text-texto">
                  {dia}
                </p>

                <div className="flex flex-wrap gap-2">
                  {disponibles.map((l) => {
                    const puesta = plan[dia].find((x) => x.listaId === l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={puesta !== undefined}
                        onClick={() => alternarLista(dia, l.id)}
                        className={`min-h-tactil rounded-lg border px-3 text-sm ${
                          puesta
                            ? "border-marca bg-marca text-white"
                            : "border-borde bg-superficie text-texto"
                        }`}
                      >
                        {l.nombre}
                      </button>
                    );
                  })}
                </div>

                {/* Se compromete por cantidad, no por nombre: cuál de los
                    cincuenta va a ver lo decide manejando. */}
                {plan[dia].map((x) => {
                  const l = disponibles.find((y) => y.id === x.listaId);
                  if (!l) return null;
                  return (
                    <div key={x.listaId} className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-texto-secundario">
                        {l.nombre} · {l.sin_tocar} sin tocar
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={l.sin_tocar}
                        value={x.cantidad || ""}
                        onChange={(e) =>
                          ponerCantidad(dia, x.listaId, Number(e.target.value))
                        }
                        aria-label={`Cuántos de ${l.nombre} el ${dia}`}
                        className="min-h-tactil w-20 rounded-lg border border-borde bg-superficie px-2 text-center font-mono text-base outline-none focus:border-marca"
                      />
                    </div>
                  );
                })}
              </Tarjeta>
            ))}

          {/* El mismo aviso donde se corrige, no sólo donde se traba. Descubrirlo en el paso 4
              obliga a devolverse; acá está al lado de la casilla que falta. */}
          {diasSinCantidad.length > 0 && (
            <p className="text-xs text-aviso">
              Te falta el número en:{" "}
              <span className="font-medium">{diasSinCantidad.join(", ")}</span>.
            </p>
          )}

          <Tarjeta className="flex flex-col gap-4">
            <p className="text-sm font-medium text-texto">Tu apuesta</p>
            <Campo
              etiqueta="Potenciales que vas a tocar"
              type="number"
              inputMode="numeric"
              min="0"
              value={apuestaPotenciales}
              onChange={(e) => setApuestaPotenciales(e.target.value)}
              ayuda={
                sumaDelPlan > 0
                  ? `Repartiste ${sumaDelPlan} entre los días.`
                  : undefined
              }
            />
            <Campo
              etiqueta="Clientes que vas a visitar"
              type="number"
              inputMode="numeric"
              min="0"
              value={apuestaClientes}
              onChange={(e) => setApuestaClientes(e.target.value)}
              ayuda={`Tienes ${numeros.fueraDeCadencia.length} fuera de cadencia.`}
            />
          </Tarjeta>

          <div className="grid grid-cols-2 gap-2">
            <Boton tono="secundario" ancho onClick={() => setPaso(2)}>
              Atrás
            </Boton>
            <Boton ancho onClick={() => setPaso(4)}>
              Continuar
            </Boton>
          </div>
        </>
      )}

      {paso === 4 && (
        <>
          <Tarjeta className="flex flex-col gap-2">
            <p className="text-sm font-medium text-texto">Listo para enviar</p>
            <p className="text-sm text-texto-secundario">
              Apuestas <span className="font-mono">{apuestaPotenciales || 0}</span>{" "}
              potenciales y{" "}
              <span className="font-mono">{apuestaClientes || 0}</span> clientes
              para la semana del {semanaEntrante}.
            </p>
            <p className="text-xs text-texto-atenuado">
              El lunes vas a ver esto al lado de lo que de verdad pasó. Nadie lo
              calcula: sale solo.
            </p>
          </Tarjeta>

          {/* **NO SE DEJA ENVIAR UN DÍA MARCADO SIN CANTIDAD.** Es lo único que se traba en toda
              la pantalla, y se traba porque no es una omisión sino una contradicción: dice que va
              a esa lista ese día y no dice a cuántos. Un día en blanco, en cambio, se envía sin
              chistar — no salir el miércoles es una decisión legítima. */}
          {diasSinCantidad.length > 0 && (
            <Tarjeta className="flex flex-col gap-1 border-amber-200 bg-amber-50">
              <p className="text-sm font-medium text-texto">
                {diasSinCantidad.length === 1
                  ? `Marcaste lista el ${diasSinCantidad[0]} y no dijiste cuántos.`
                  : `Marcaste lista sin decir cuántos: ${diasSinCantidad.join(", ")}.`}
              </p>
              <p className="text-xs text-texto-secundario">
                Vuelve al paso 3 y escribe el número, o quita la lista de ese
                día si no vas a salir.
              </p>
            </Tarjeta>
          )}

          {error && <MensajeError titulo="No se pudo enviar" detalle={error} />}

          <div className="grid grid-cols-2 gap-2">
            <Boton tono="secundario" ancho onClick={() => setPaso(3)}>
              Atrás
            </Boton>
            <Boton
              ancho
              disabled={guardando || diasSinCantidad.length > 0}
              onClick={enviar}
            >
              {guardando ? "Enviando" : "Enviar"}
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}
