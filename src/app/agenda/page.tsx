import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { CumplirCompromiso } from "@/components/cumplir-compromiso";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

/**
 * La agenda del día.
 *
 * Los compromisos vencidos van primero (§7.1). No es un detalle de orden: es
 * lo que convierte la lista en una herramienta de trabajo en vez de un
 * calendario. Lo primero que ve el vendedor al abrir el celular es lo que
 * prometió y no ha hecho.
 */
export default async function Agenda() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: compromisos } = await supabase
    .from("compromisos")
    .select("id, descripcion, fecha_compromiso, prospecto_id, prospectos(nombre)")
    .is("deleted_at", null)
    .is("cumplido_en", null)
    .order("fecha_compromiso", { ascending: true });

  const hoy = hoyEnPanama();
  const vencidos = compromisos?.filter((c) => c.fecha_compromiso < hoy) ?? [];
  const deHoy = compromisos?.filter((c) => c.fecha_compromiso === hoy) ?? [];
  const proximos = compromisos?.filter((c) => c.fecha_compromiso > hoy) ?? [];

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Agenda</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {!compromisos?.length && (
          <Tarjeta>
            <Vacio titulo="No tienes compromisos pendientes">
              Cada visita que registres deja aquí su próximo paso.
            </Vacio>
          </Tarjeta>
        )}

        <Grupo
          titulo="Vencidos"
          tono="error"
          compromisos={vencidos}
          resaltado
        />
        <Grupo titulo="Hoy" tono="info" compromisos={deHoy} />
        <Grupo titulo="Más adelante" tono="neutro" compromisos={proximos} />
      </main>
    </>
  );
}

type Compromiso = {
  id: string;
  descripcion: string;
  fecha_compromiso: string;
  prospecto_id: string;
  prospectos: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(prospectos: Compromiso["prospectos"]) {
  if (!prospectos) return "Prospecto";
  return Array.isArray(prospectos)
    ? (prospectos[0]?.nombre ?? "Prospecto")
    : prospectos.nombre;
}

function Grupo({
  titulo,
  tono,
  compromisos,
  resaltado = false,
}: {
  titulo: string;
  tono: "error" | "info" | "neutro";
  compromisos: Compromiso[];
  resaltado?: boolean;
}) {
  if (compromisos.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-texto">{titulo}</h2>
        <Insignia tono={tono}>{String(compromisos.length)}</Insignia>
      </div>

      {compromisos.map((c) => (
        <Tarjeta
          key={c.id}
          className={resaltado ? "border-red-200 bg-red-50" : undefined}
        >
          <Link href={`/prospectos/${c.prospecto_id}`} className="block">
            <p className="text-base font-semibold text-texto">
              {nombreDe(c.prospectos)}
            </p>
            <p className="text-sm text-texto-secundario">{c.descripcion}</p>
          </Link>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-mono text-xs text-texto-secundario">
              <CalendarClock size={14} aria-hidden />
              {FECHA.format(new Date(`${c.fecha_compromiso}T12:00:00`))}
            </span>
            <CumplirCompromiso id={c.id} />
          </div>
        </Tarjeta>
      ))}
    </section>
  );
}
