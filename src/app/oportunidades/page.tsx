import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  ETAPAS,
  LINEAS_PRODUCTO,
  TONO_ETAPA,
  type Etapa,
  type LineaProducto,
} from "@/lib/catalogos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

const MONTO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

// El orden del pipeline, de la primera etapa a las dos salidas.
const ORDEN: Etapa[] = [
  "nuevo",
  "contactado",
  "cotizado",
  "negociacion",
  "ganado",
  "perdido",
];

type Oportunidad = {
  id: string;
  nombre: string;
  linea: string;
  fecha_cierre_estimada: string | null;
  descripcion: string | null;
  monto_estimado: string | number | null;
  etapa: string;
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(cuentas: Oportunidad["cuentas"]) {
  if (!cuentas) return "Cuenta";
  return Array.isArray(cuentas)
    ? (cuentas[0]?.nombre ?? "Cuenta")
    : cuentas.nombre;
}

const MES = new Intl.DateTimeFormat("es-PA", {
  month: "long",
  year: "numeric",
  timeZone: "America/Panama",
});

/**
 * Una venta es "grande" cuando cierra a más de un mes.
 *
 * No hace falta capturarlo: sale de la fecha estimada de cierre, que ya se pide
 * al abrirla. Y tiene una propiedad buena — **si empuja la fecha tres veces, la
 * venta pasa sola de rápida a grande**, que es justo lo que está pasando en la
 * realidad.
 */
function esGrande(fecha: string | null): boolean {
  if (!fecha) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() + 30);
  return fecha > limite.toLocaleDateString("en-CA");
}

/**
 * Pipeline visual (§7.1).
 *
 * En escritorio esto sería un tablero de columnas. En móvil no: arrastrar
 * tarjetas entre columnas con una mano y a pleno sol no funciona. Aquí son
 * grupos apilados con su total, y la etapa se cambia entrando a la
 * oportunidad. Cambia la densidad, no los datos (§17).
 */
export default async function Ventas({
  searchParams,
}: PageProps<"/oportunidades">) {
  const { vista } = await searchParams;
  const porMes = vista === "mes";

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data } = await supabase
    .from("oportunidades")
    .select(
      "id, nombre, linea, descripcion, monto_estimado, etapa, fecha_cierre_estimada, cuentas(nombre)",
    )
    .is("deleted_at", null)
    .order("monto_estimado", { ascending: false, nullsFirst: false });

  const oportunidades = (data ?? []) as Oportunidad[];

  const abiertas = oportunidades.filter(
    (o) => o.etapa !== "ganado" && o.etapa !== "perdido",
  );
  const totalAbierto = abiertas.reduce(
    (suma, o) => suma + Number(o.monto_estimado ?? 0),
    0,
  );

  return (
    <>
      <AvisoSinConexion />

      {/* Se llamaba "Pipeline". Quedó del principio y no es la palabra del
          negocio: en el sistema esto son las ventas en marcha. */}
      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Ventas en marcha</h1>
      </header>

      {/* Dos vistas de lo mismo, y cada una contesta una pregunta distinta:
          por etapa, en qué momento está cada venta; por mes, cuánto va a
          entrar y cuándo. La segunda es la única que muestra los huecos. */}
      <div className="grid grid-cols-2 border-b border-borde bg-superficie">
        {(
          [
            ["/oportunidades", "Por etapa", !porMes],
            ["/oportunidades?vista=mes", "Por mes", porMes],
          ] as const
        ).map(([href, etiqueta, activa]) => (
          <Link
            key={etiqueta}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={`min-h-tactil flex items-center justify-center border-b-2 text-sm ${
              activa
                ? "border-b-marca font-medium text-marca"
                : "border-b-transparent text-texto-atenuado"
            }`}
          >
            {etiqueta}
          </Link>
        ))}
      </div>

      <main className="flex flex-col gap-4 p-4">
        {oportunidades.length === 0 ? (
          <Tarjeta>
            <Vacio titulo="Todavía no tienes oportunidades">
              Se crean desde el expediente de un prospecto, una por cada línea
              de producto que esté negociando.
            </Vacio>
          </Tarjeta>
        ) : (
          <Tarjeta>
            <p className="text-sm text-texto-secundario">En negociación</p>
            <p className="mt-1 font-mono text-3xl text-marca">
              {MONTO.format(totalAbierto)}
            </p>
            <p className="mt-1 text-xs text-texto-secundario">
              {abiertas.length}{" "}
              {abiertas.length === 1
                ? "oportunidad abierta"
                : "oportunidades abiertas"}
            </p>
          </Tarjeta>
        )}

        {porMes && <PorMes oportunidades={abiertas} />}

        {!porMes &&
          ORDEN.map((etapa) => {
          const grupo = oportunidades.filter((o) => o.etapa === etapa);
          if (grupo.length === 0) return null;

          const total = grupo.reduce(
            (suma, o) => suma + Number(o.monto_estimado ?? 0),
            0,
          );

          return (
            <section key={etapa} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Insignia tono={TONO_ETAPA[etapa]}>{ETAPAS[etapa]}</Insignia>
                  <span className="text-xs text-texto-secundario">
                    {grupo.length}
                  </span>
                </div>
                <span className="font-mono text-sm text-texto">
                  {MONTO.format(total)}
                </span>
              </div>

              {grupo.map((o) => (
                <Link key={o.id} href={`/oportunidades/${o.id}`} className="block">
                  <Tarjeta className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-texto">
                        {o.nombre}
                      </p>
                      <p className="text-sm text-texto-secundario">
                        {nombreDe(o.cuentas)} ·{" "}
                        {LINEAS_PRODUCTO[o.linea as LineaProducto]}
                      </p>
                      {/* La fecha vencida se marca en rojo: es lo que congela
                          la oportunidad hasta que alguien la mueva. */}
                      {o.fecha_cierre_estimada && (
                        <p
                          className={`font-mono text-xs ${
                            o.fecha_cierre_estimada < hoyEnPanama()
                              ? "text-error"
                              : "text-texto-atenuado"
                          }`}
                        >
                          {o.fecha_cierre_estimada < hoyEnPanama()
                            ? "Vencida el "
                            : "Cierra el "}
                          {FECHA.format(
                            new Date(`${o.fecha_cierre_estimada}T12:00:00`),
                          )}
                        </p>
                      )}
                      {o.descripcion && (
                        <p className="text-xs text-texto-atenuado">
                          {o.descripcion}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 font-mono text-sm ${
                        o.monto_estimado !== null
                          ? "text-texto"
                          : "text-texto-atenuado"
                      }`}
                    >
                      {o.monto_estimado !== null
                        ? MONTO.format(Number(o.monto_estimado))
                        : "Sin monto"}
                    </span>
                  </Tarjeta>
                </Link>
              ))}
            </section>
          );
        })}
      </main>
    </>
  );
}

/**
 * Las ventas abiertas agrupadas por el mes en que se estima que cierran.
 *
 * **Es la única vista que muestra el hueco.** En agosto se ve que octubre está
 * vacío, y en agosto todavía se puede meter algo rápido que cierre en seis
 * semanas; cuando llega octubre ya no.
 *
 * Las que no tienen fecha van aparte a propósito: son invisibles para
 * cualquier proyección, y son las que se pudren calladas.
 */
function PorMes({ oportunidades }: { oportunidades: Oportunidad[] }) {
  const conFecha = oportunidades.filter((o) => o.fecha_cierre_estimada);
  const sinFecha = oportunidades.filter((o) => !o.fecha_cierre_estimada);

  const meses = new Map<string, Oportunidad[]>();
  for (const o of conFecha) {
    const clave = o.fecha_cierre_estimada!.slice(0, 7);
    meses.set(clave, [...(meses.get(clave) ?? []), o]);
  }

  const ordenados = [...meses.keys()].sort();

  // Los meses vacíos entre el primero y el último son la información: un mes
  // sin nada no aparece solo, hay que dibujarlo.
  const conHuecos: string[] = [];
  if (ordenados.length > 0) {
    const cursor = new Date(`${ordenados[0]}-01T12:00:00`);
    const fin = new Date(`${ordenados[ordenados.length - 1]}-01T12:00:00`);
    while (cursor <= fin) {
      conHuecos.push(cursor.toLocaleDateString("en-CA").slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  if (oportunidades.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {conHuecos.map((mes) => {
        const grupo = meses.get(mes) ?? [];
        const total = grupo.reduce(
          (suma, o) => suma + Number(o.monto_estimado ?? 0),
          0,
        );
        const vacio = grupo.length === 0;

        return (
          <section key={mes} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium capitalize text-texto">
                {MES.format(new Date(`${mes}-01T12:00:00`))}
              </h2>
              <span className="font-mono text-sm text-texto">
                {MONTO.format(total)}
              </span>
            </div>

            {vacio ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <p className="text-xs">
                  Aquí no hay nada. Se ve ahora y todavía se puede arreglar
                  metiendo ventas rápidas que cierren a tiempo.
                </p>
              </div>
            ) : (
              grupo.map((o) => (
                <Link key={o.id} href={`/oportunidades/${o.id}`} className="block">
                  <Tarjeta className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-texto">{o.nombre}</p>
                      <p className="text-xs text-texto-secundario">
                        {nombreDe(o.cuentas)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Insignia tono={TONO_ETAPA[o.etapa as Etapa]}>
                          {ETAPAS[o.etapa as Etapa]}
                        </Insignia>
                        <Insignia
                          tono={esGrande(o.fecha_cierre_estimada) ? "info" : "neutro"}
                        >
                          {esGrande(o.fecha_cierre_estimada) ? "Grande" : "Rápida"}
                        </Insignia>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-sm ${
                        o.monto_estimado !== null
                          ? "text-texto"
                          : "text-texto-atenuado"
                      }`}
                    >
                      {o.monto_estimado !== null
                        ? MONTO.format(Number(o.monto_estimado))
                        : "Sin monto"}
                    </span>
                  </Tarjeta>
                </Link>
              ))
            )}
          </section>
        );
      })}

      {sinFecha.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">
            Sin fecha · {sinFecha.length}
          </h2>
          <p className="text-xs text-texto-atenuado">
            No entran en ninguna proyección. Ponles fecha o ciérralas.
          </p>
          {sinFecha.map((o) => (
            <Link key={o.id} href={`/oportunidades/${o.id}`} className="block">
              <Tarjeta className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-texto">{o.nombre}</p>
                  <p className="text-xs text-texto-secundario">
                    {nombreDe(o.cuentas)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-texto-atenuado">
                  {o.monto_estimado !== null
                    ? MONTO.format(Number(o.monto_estimado))
                    : "Sin monto"}
                </span>
              </Tarjeta>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
