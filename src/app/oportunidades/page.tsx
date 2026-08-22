import Link from "next/link";
import { redirect } from "next/navigation";
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

/**
 * Pipeline visual (§7.1).
 *
 * En escritorio esto sería un tablero de columnas. En móvil no: arrastrar
 * tarjetas entre columnas con una mano y a pleno sol no funciona. Aquí son
 * grupos apilados con su total, y la etapa se cambia entrando a la
 * oportunidad. Cambia la densidad, no los datos (§17).
 */
export default async function Pipeline() {
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

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Pipeline</h1>
      </header>

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

        {ORDEN.map((etapa) => {
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
