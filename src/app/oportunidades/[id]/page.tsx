import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  RESULTADOS,
  TIPOS_INTERACCION,
  type Resultado,
  type TipoInteraccion,
} from "@/lib/catalogos";
import {
  EditarOportunidad,
  type Oportunidad,
} from "@/components/editar-oportunidad";
import {
  BitacoraOportunidad,
  type Nota,
} from "@/components/bitacora-oportunidad";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

export default async function DetalleOportunidad({
  params,
}: PageProps<"/oportunidades/[id]">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data } = await supabase
    .from("oportunidades")
    .select(
      "id, cuenta_id, nombre, linea, descripcion, monto_estimado, etapa, motivo_perdida, fecha_recontacto, fecha_cierre_estimada, cuentas(nombre)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();

  const cuentas = data.cuentas as { nombre: string } | { nombre: string }[] | null;
  const nombreCuenta = Array.isArray(cuentas)
    ? (cuentas[0]?.nombre ?? "Cuenta")
    : (cuentas?.nombre ?? "Cuenta");

  const { data: notas } = await supabase
    .from("notas_oportunidad")
    .select("id, texto, created_at")
    .eq("oportunidad_id", id)
    .order("created_at", { ascending: false });

  // Los seguimientos ligados a esta venta, para tener el panorama completo de
  // la negociación en un solo lugar.
  const { data: seguimientos } = await supabase
    .from("seguimientos")
    .select("id, tipo, fecha, resultado, notas")
    .eq("oportunidad_id", id)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  const vencida =
    data.fecha_cierre_estimada !== null &&
    data.fecha_cierre_estimada < hoyEnPanama() &&
    data.etapa !== "ganado" &&
    data.etapa !== "perdido";

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/oportunidades" />
        <h1 className="text-lg font-semibold text-marca">Oportunidad</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <Link href={`/cuentas/${data.cuenta_id}`} className="block">
          <Tarjeta>
            <p className="text-xs text-texto-secundario">Cuenta</p>
            <p className="text-base font-semibold text-texto">{nombreCuenta}</p>
          </Tarjeta>
        </Link>

        <EditarOportunidad
          oportunidad={data as unknown as Oportunidad}
          vencida={vencida}
        />

        <BitacoraOportunidad
          oportunidadId={id}
          notas={(notas ?? []) as Nota[]}
          bloqueada={vencida}
        />

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-texto">
              Seguimientos de esta venta
            </h2>
            <Link
              href={`/cuentas/${data.cuenta_id}/seguimiento?oportunidad=${id}`}
              className="block"
            >
              <Boton tono="secundario">Registrar</Boton>
            </Link>
          </div>

          {!seguimientos?.length && (
            <p className="text-xs text-texto-atenuado">
              Ninguno todavía. Los seguimientos que registres desde aquí quedan
              ligados a esta venta.
            </p>
          )}

          {seguimientos?.map((s) => (
            <Tarjeta key={s.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-texto-secundario">
                  {FECHA.format(new Date(s.fecha))}
                </span>
                <Insignia tono="neutro">
                  {TIPOS_INTERACCION[s.tipo as TipoInteraccion]}
                </Insignia>
              </div>
              <p className="text-sm font-medium text-texto">
                {RESULTADOS[s.resultado as Resultado]}
              </p>
              {s.notas && (
                <p className="text-sm text-texto-secundario">{s.notas}</p>
              )}
            </Tarjeta>
          ))}
        </section>
      </main>
    </>
  );
}
