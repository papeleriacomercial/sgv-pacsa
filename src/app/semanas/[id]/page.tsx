import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, UserPlus } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarReporte, semanaLegible } from "@/lib/semanas";
import { TIPOS_ACCION_PLAN, MOTIVOS_INCUMPLIDO } from "@/lib/catalogos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { BotonVolver } from "@/components/boton-volver";
import { Observacion } from "@/components/observacion";

/**
 * Un reporte semanal, en pantalla — docs/18-plan-diario.md §4.5.
 *
 * **Dibuja lo mismo que el PDF, desde los mismos números congelados.** No
 * vuelve a consultar nada: si recalculara, una factura corregida haría que el
 * PDF que el vendedor tiene en su correo y esta pantalla dijeran cosas distintas
 * de la misma semana, y la conversación se iría en discutir cuál miente.
 */

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const CENTAVOS = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MOTIVOS_PERDIDA: Record<string, string> = {
  precio: "precio",
  espera_licitacion: "espera una licitación",
  no_cumple_especificaciones: "no cumple especificaciones",
  sin_interes_real: "no había interés real",
  no_contactar: "pidió que no lo contacten",
};

export default async function UnaSemana({ params }: PageProps<"/semanas/[id]">) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [reporte, { data: quien }] = await Promise.all([
    cargarReporte(id),
    supabase.from("perfiles").select("rol, nombre").eq("id", user.id).maybeSingle(),
  ]);

  if (!reporte) notFound();

  const d = reporte.datos ?? {};
  // Quien supervisa escribe; el vendedor lee. La base lo impone igual con su
  // política, así que esto sólo decide qué se dibuja.
  const puedeEscribir = quien?.rol === "gerente" || quien?.rol === "lider";

  const mesNombre = d.mes ? MES[Number(d.mes.clave.slice(5, 7)) - 1] : null;

  return (
    <>
      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">{reporte.nombre}</h1>
        <p className="text-sm text-texto-secundario">
          Semana {semanaLegible(reporte.semana)}
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 pb-28">
        <BotonVolver />

        {/* --- Lo positivo primero, igual que en el papel --------------- */}
        <Tarjeta className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-texto-atenuado">
              {mesNombre ? `${mesNombre}, al viernes` : "El mes"}
            </p>
            <p className="font-mono text-2xl text-texto">
              {DINERO.format(d.mes?.total ?? 0)}
            </p>
            <p className="text-xs text-texto-secundario">
              {d.mes?.documentos ?? 0} documentos en el mes
            </p>
          </div>

          {d.comision != null ? (
            <div className="text-right">
              <p className="text-xs font-medium text-texto-atenuado">
                Comisión ganada
              </p>
              <p className="font-mono text-2xl text-ok">
                {CENTAVOS.format(d.comision)}
              </p>
              <p className="text-xs text-texto-secundario">
                {d.porcentajeComision} % sin ITBMS
              </p>
            </div>
          ) : null}
        </Tarjeta>

        {d.mesAnterior ? (
          <p className="text-sm text-texto-secundario">
            {MES[Number(d.mesAnterior.clave.slice(5, 7)) - 1]} cerró con{" "}
            {DINERO.format(d.mesAnterior.total)}. La semana se cuenta entera; el
            mes arrancó de nuevo el día 1.
          </p>
        ) : null}

        {/* --- La semana ------------------------------------------------ */}
        <Tarjeta className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-texto">Esta semana</h2>
          <p className="text-base text-texto">
            {DINERO.format(d.facturado ?? 0)} en {d.documentos ?? 0}{" "}
            {d.documentos === 1 ? "documento" : "documentos"}
          </p>
          {d.disciplina ? (
            <p className="text-sm text-texto-secundario">
              {d.disciplina.diasConPlan} de 5 días con plan ·{" "}
              {d.disciplina.cerrados} cerrados
              {d.disciplina.tarde > 0
                ? ` · ${d.disciplina.tarde} arrancó sin plan`
                : ""}
            </p>
          ) : null}
        </Tarjeta>

        {/* --- Clientes nuevos ------------------------------------------ */}
        <Tarjeta className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-marca" aria-hidden />
            <h2 className="text-sm font-medium text-texto">Clientes nuevos</h2>
          </div>

          {!d.nuevos || d.nuevos.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              Ninguno compró por primera vez esta semana.
            </p>
          ) : (
            d.nuevos.map((n, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-texto">{n.nombre}</span>
                <span className="font-mono text-sm text-texto-secundario">
                  {CENTAVOS.format(n.monto)}
                </span>
              </div>
            ))
          )}

          {d.nuevosDelAnio != null ? (
            <p className="text-xs text-texto-atenuado">
              En el año: {d.nuevosDelAnio} clientes nuevos, y {d.volvieron ?? 0}{" "}
              ya volvieron a comprar. Un cliente que compra una vez y no regresa
              fue una venta; uno que vuelve es cartera.
            </p>
          ) : null}
        </Tarjeta>

        {/* --- Lo prometido contra lo hecho ----------------------------- */}
        {d.acciones && d.acciones.length > 0 ? (
          <Tarjeta className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-texto">
              Lo que prometió y lo que hizo
            </h2>
            {d.acciones.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm text-texto">
                  {TIPOS_ACCION_PLAN[a.tipo as keyof typeof TIPOS_ACCION_PLAN] ??
                    a.tipo}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-texto-secundario">
                    {a.hecho} de {a.meta}
                  </span>
                  {a.porcentaje != null ? (
                    <Insignia tono={a.porcentaje >= 100 ? "ok" : a.porcentaje >= 70 ? "info" : "error"}>
                      {`${a.porcentaje} %`}
                    </Insignia>
                  ) : null}
                </span>
              </div>
            ))}
            {d.motivoMasRepetido ? (
              <p className="text-xs text-texto-atenuado">
                Lo que más se repitió cuando no salió:{" "}
                {MOTIVOS_INCUMPLIDO[
                  d.motivoMasRepetido[0] as keyof typeof MOTIVOS_INCUMPLIDO
                ] ?? d.motivoMasRepetido[0]}{" "}
                ({d.motivoMasRepetido[1]}{" "}
                {d.motivoMasRepetido[1] === 1 ? "vez" : "veces"}).
              </p>
            ) : null}
          </Tarjeta>
        ) : null}

        {/* --- A quién le vendió --------------------------------------- */}
        {d.ventas && d.ventas.length > 0 ? (
          <Tarjeta className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-texto">
              A quién le vendió esta semana
            </h2>

            {d.ventas.slice(0, 15).map((v, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="flex-1 text-sm text-texto">
                  {v.cliente}
                  {v.enLista ? (
                    <span className="text-texto-atenuado"> · en lista</span>
                  ) : null}
                  {v.tocado ? null : (
                    <span className="text-texto-atenuado"> · sin registro</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm text-texto-secundario">
                  {CENTAVOS.format(v.monto)}
                </span>
              </div>
            ))}

            {d.ventas.length > 15 ? (
              <p className="text-xs text-texto-atenuado">
                y {d.ventas.length - 15} más.
              </p>
            ) : null}

            {d.sinTocar != null ? (
              <p className="text-xs text-texto-atenuado">
                {d.dentroDeLista} de {d.ventas.length} a cuentas de sus listas ·{" "}
                {d.sinTocar} sin visita ni llamada registrada en 30 días.
                <strong className="font-normal">
                  {" "}
                  Eso mide el registro, no la ruta.
                </strong>
              </p>
            ) : null}
          </Tarjeta>
        ) : null}

        {/* --- El canal ------------------------------------------------- */}
        {d.canal ? (
          <Tarjeta className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-marca" aria-hidden />
              <h2 className="text-sm font-medium text-texto">
                El canal: cotizaciones
              </h2>
            </div>

            <p className="text-sm text-texto">
              {d.canal.emitidas === 0
                ? "No emitió ninguna esta semana."
                : `Emitió ${d.canal.emitidas} por ${CENTAVOS.format(d.canal.emitidasMonto)}.`}
            </p>

            {d.canal.ganadas.length > 0 || d.canal.perdidas.length > 0 ? (
              <p className="text-sm text-texto-secundario">
                Cerró {d.canal.ganadas.length} ganada(s) y{" "}
                {d.canal.perdidas.length} perdida(s)
                {d.canal.perdidas.length > 0
                  ? `: ${d.canal.perdidas.map((p) => MOTIVOS_PERDIDA[p.motivo_perdida] ?? p.motivo_perdida).join(", ")}`
                  : ""}
                .
              </p>
            ) : null}

            {d.canal.vivas.length === 0 ? (
              <p className="text-sm text-texto-secundario">
                No tiene ninguna viva esperando respuesta.
              </p>
            ) : (
              <>
                <p
                  className={`text-sm font-medium ${d.canal.frias > 0 ? "text-error" : "text-texto"}`}
                >
                  {d.canal.vivas.length} vivas por{" "}
                  {CENTAVOS.format(d.canal.vivasMonto)}
                  {d.canal.frias > 0
                    ? ` · ${d.canal.frias} con más de un mes sin respuesta`
                    : ""}
                </p>
                {d.canal.vivas.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className="flex-1 text-sm text-texto">{c.cliente}</span>
                    <span className="font-mono text-sm text-texto-secundario">
                      {CENTAVOS.format(c.monto)}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${(c.dias ?? 0) > 30 ? "text-error" : "text-texto-atenuado"}`}
                    >
                      hace {c.dias} días
                    </span>
                  </div>
                ))}
                {d.canal.vivas.length > 8 ? (
                  <p className="text-xs text-texto-atenuado">
                    y {d.canal.vivas.length - 8} más.
                  </p>
                ) : null}
              </>
            )}
          </Tarjeta>
        ) : null}

        {/* --- A qué listas apuntó ------------------------------------- */}
        {d.listasApuntadas ? (
          <Tarjeta className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-texto">
              A qué listas apuntó en su plan
            </h2>
            {d.listasApuntadas.length === 0 ? (
              <p className="text-sm text-texto-secundario">
                {d.disciplina?.diasConPlan === 0
                  ? "No armó ningún día, así que no declaró a qué le apuntaba."
                  : "Ninguna de sus acciones salió de una lista."}
              </p>
            ) : (
              d.listasApuntadas.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-texto">{l.nombre}</span>
                  <span className="font-mono text-sm text-texto-secundario">
                    meta {l.meta}
                  </span>
                </div>
              ))
            )}
          </Tarjeta>
        ) : null}

        {/* --- Y la observación, que es para lo que se abre ------------- */}
        <Observacion
          reporteId={reporte.id}
          observacion={reporte.observacion}
          firmadaPor={null}
          firmadaEn={reporte.observado_en}
          puedeEscribir={puedeEscribir}
        />

        {reporte.enviado_en ? (
          <p className="text-center text-xs text-texto-atenuado">
            <CheckCircle2 size={12} className="inline text-ok" aria-hidden />{" "}
            Enviado por correo el{" "}
            {new Date(reporte.enviado_en).toLocaleDateString("es-PA", {
              day: "numeric",
              month: "long",
              timeZone: "America/Panama",
            })}
          </p>
        ) : (
          <p className="text-center text-xs text-texto-atenuado">
            Este reporte no se envió por correo.
          </p>
        )}
      </main>
    </>
  );
}
