import Link from "next/link";
import { CalendarCheck, CheckCircle2, Circle, Clock } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import {
  TIPOS_ACCION_PLAN,
  UNIDAD_DE_ACCION,
  MOTIVOS_INCUMPLIDO,
} from "@/lib/catalogos";
import { avanceDe, type AvanceDeHoy } from "@/lib/plan";
import type { PlanDelDia } from "@/lib/plan-diario";

/**
 * El plan del día, arriba de la Agenda — docs/18-plan-diario.md §4.1.
 *
 * **La Agenda no se reemplaza: se le pone un sombrero.** Sus cuatro secciones
 * —Paradas, Llamadas y correos, Se les acaba el producto y Tus listas— siguen
 * abajo igual que siempre. Lo que faltaba no era información, era el acto de
 * comprometerse.
 *
 * Y los seguimientos que el plan «impone» no son datos nuevos: son esas mismas
 * Paradas y Llamadas que ya le aparecían, ahora con una marca de despachado.
 */

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Panama",
  });
}

export function PlanDelDia({
  plan,
  fallo,
  avance,
}: {
  plan: PlanDelDia | null;
  fallo: string | null;
  avance: AvanceDeHoy;
}) {
  // -------------------------------------------------------------------------
  // La consulta falló.
  //
  // **Se dice, en vez de ofrecer «Armar mi día».** Un fallo que se dibuja como
  // «no hay» haría que quien ya armó su día lo armara otra vez, y al guardar
  // chocaría contra la llave única sin entender por qué. Es la falla que el
  // proyecto hermano lleva contada siete veces, y acá se corta de entrada.
  // -------------------------------------------------------------------------
  if (fallo) {
    return (
      <Tarjeta className="flex flex-col gap-1 border-amber-200 bg-amber-50">
        <p className="text-sm font-medium text-texto">
          No se pudo leer tu plan de hoy
        </p>
        <p className="text-xs text-texto-secundario">
          No quiere decir que no lo tengas. Vuelve a entrar en un momento, y si
          sigue igual avísalo: {fallo}
        </p>
      </Tarjeta>
    );
  }

  // -------------------------------------------------------------------------
  // Todavía no armó el día.
  //
  // **Se dice cuánto cuesta y qué hay esperando.** Un botón solo —«Armar mi
  // día»— es una tarea más; un botón que dice «son 2 minutos y tienes cinco
  // seguimientos esperando» es una razón para tocarlo.
  // -------------------------------------------------------------------------
  if (!plan) {
    return (
      <Tarjeta className="flex flex-col items-center gap-3 border-marca/30 bg-marca/5 py-6 text-center">
        <CalendarCheck size={28} className="text-marca" aria-hidden />

        <p className="text-base font-semibold text-texto">
          Todavía no armas tu día
        </p>

        <Link
          href="/plan/armar"
          className="min-h-tactil flex items-center rounded-lg bg-marca px-5 text-base font-medium text-white"
        >
          Armar mi día
        </Link>

        <p className="text-sm text-texto-secundario">
          Son 2 minutos.
          {avance.seguimientosPendientes > 0 ? (
            <>
              {" "}
              Tienes{" "}
              <strong className="text-texto">
                {avance.seguimientosPendientes}
              </strong>{" "}
              {avance.seguimientosPendientes === 1
                ? "seguimiento esperando"
                : "seguimientos esperando"}
              .
            </>
          ) : null}
        </p>
      </Tarjeta>
    );
  }

  const seguimientosTotal =
    avance.seguimientosPendientes + avance.seguimientosDespachados;

  return (
    <Tarjeta className="flex flex-col gap-4">
      {/* La cabecera dice a qué hora abrió, que es la mitad de lo que se mide. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-texto-secundario" aria-hidden />
          <span className="text-sm text-texto-secundario">
            {plan.cerrado_en
              ? `Día cerrado a las ${hora(plan.cerrado_en)}`
              : `Plan abierto ${hora(plan.abierto_en)}`}
          </span>
        </div>

        {/* **Tarde no es una insignia de color solamente.** Lleva su palabra,
            porque en la calle hay sol y prisa y el color no se distingue. */}
        {plan.a_tiempo ? null : (
          <Insignia tono="aviso">Arrancó sin plan</Insignia>
        )}
      </div>

      {/* --------------------------------------------------------------------
          Los seguimientos. Primero, y no se escogen.
          -------------------------------------------------------------------- */}
      {seguimientosTotal > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-texto">
              Seguimientos de hoy
            </h2>
            <span className="font-mono text-sm text-texto-secundario">
              {avance.seguimientosDespachados} de {seguimientosTotal}
            </span>
          </div>
          <p className="text-xs text-texto-secundario">
            {avance.seguimientosPendientes === 0
              ? "Los despachaste todos."
              : "Están abajo, en Paradas y en Llamadas y correos."}
          </p>
        </div>
      ) : null}

      {/* --------------------------------------------------------------------
          Las acciones propias, con su contador.

          **El contador sube solo.** Si visitó, la visita ya está registrada; el
          vendedor no teclea nada durante el día. Reparto y cobro son la
          excepción y se dicen al cerrar — no hay tabla que los registre, y un
          contador en cero sobre un trabajo hecho es peor que no mostrarlo.
          -------------------------------------------------------------------- */}
      {plan.acciones.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Mis acciones</h2>

          {plan.acciones.map((a) => {
            const hecho = a.logrado ?? avanceDe(a.tipo, avance);
            const cumplida = hecho != null && hecho >= a.meta;

            return (
              <div key={a.id} className="flex items-start gap-2">
                {cumplida ? (
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-ok"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    size={18}
                    className="mt-0.5 shrink-0 text-borde"
                    aria-hidden
                  />
                )}

                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-texto">
                      {TIPOS_ACCION_PLAN[a.tipo]}
                      {a.lista ? (
                        <span className="text-texto-secundario"> · {a.lista}</span>
                      ) : null}
                    </span>

                    <span className="shrink-0 font-mono text-sm text-texto">
                      {hecho == null ? "—" : hecho}/{a.meta}
                    </span>
                  </div>

                  <p className="text-xs text-texto-secundario">
                    {hecho == null
                      ? `Se cuenta al cerrar el día · meta ${a.meta} ${UNIDAD_DE_ACCION[a.tipo]}`
                      : `meta ${a.meta} ${UNIDAD_DE_ACCION[a.tipo]}`}
                    {a.motivo ? ` · ${MOTIVOS_INCUMPLIDO[a.motivo]}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-texto-secundario">
          Hoy no te pusiste acciones propias: el día va entero en seguimientos.
        </p>
      )}

      {/* La nota, siempre colgada de una cuenta. */}
      {plan.nota ? (
        <div className="rounded-lg bg-fondo p-3">
          <p className="text-xs font-medium text-texto-secundario">Tu nota de hoy</p>
          <p className="text-sm text-texto">{plan.nota}</p>
        </div>
      ) : null}

      {plan.cerrado_en ? null : (
        <Link
          href="/plan/cerrar"
          className="min-h-tactil flex items-center justify-center rounded-lg bg-marca px-5 text-base font-medium text-white"
        >
          Cerrar mi día
        </Link>
      )}
    </Tarjeta>
  );
}
