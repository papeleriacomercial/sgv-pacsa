import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarReportes, semanaLegible } from "@/lib/semanas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";

/**
 * Las semanas — docs/18-plan-diario.md §4.5.
 *
 * **Es la pantalla del lunes de gerencia.** El usuario no interviene en el día;
 * su intervención es semanal y escrita, así que lo único que necesita ver acá es
 * qué reportes están esperando su comentario.
 *
 * El vendedor abre la misma pantalla y ve los suyos. **No hace falta filtrar por
 * rol: lo decide el RLS de la base**, así que no hay forma de que un descuido de
 * esta pantalla le muestre a alguien lo que no le toca.
 */

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function Semanas() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const reportes = await cargarReportes();
  const porObservar = reportes.filter((r) => !r.observacion).length;

  return (
    <>
      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Semanas</h1>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {reportes.length === 0 ? (
          <Tarjeta>
            <Vacio titulo="Todavía no hay reportes">
              El primero sale el viernes por la noche, con la semana completa. Se
              arma solo a partir del plan de cada día y de lo facturado.
            </Vacio>
          </Tarjeta>
        ) : null}

        {porObservar > 0 ? (
          <p className="text-sm text-texto-secundario">
            {porObservar === 1
              ? "Un reporte espera tu observación."
              : `${porObservar} reportes esperan tu observación.`}
          </p>
        ) : null}

        {reportes.map((r) => {
          const d = r.datos ?? {};
          return (
            <Link key={r.id} href={`/semanas/${r.id}`} className="block">
              <Tarjeta className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-medium text-texto">
                      {r.nombre}
                    </span>
                    <span className="text-xs text-texto-atenuado">
                      {semanaLegible(r.semana)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-texto-secundario">
                    {DINERO.format(d.facturado ?? 0)}
                    {d.disciplina
                      ? ` · ${d.disciplina.diasConPlan} de 5 días con plan`
                      : ""}
                    {d.nuevos && d.nuevos.length > 0
                      ? ` · ${d.nuevos.length} ${d.nuevos.length === 1 ? "cliente nuevo" : "clientes nuevos"}`
                      : ""}
                  </p>

                  {/* **La antigüedad del canal frío va en la lista**, no sólo
                      adentro: es lo que hace que gerencia abra ese reporte
                      primero. */}
                  {d.canal && d.canal.frias > 0 ? (
                    <p className="mt-1 text-xs text-error">
                      {d.canal.frias} cotización(es) con más de un mes sin
                      respuesta
                    </p>
                  ) : null}
                </div>

                {r.observacion ? (
                  <Insignia tono="ok">Observada</Insignia>
                ) : (
                  <Insignia tono="aviso">Pendiente</Insignia>
                )}

                <ChevronRight
                  size={18}
                  className="shrink-0 text-texto-atenuado"
                  aria-hidden
                />
              </Tarjeta>
            </Link>
          );
        })}
      </main>
    </>
  );
}
