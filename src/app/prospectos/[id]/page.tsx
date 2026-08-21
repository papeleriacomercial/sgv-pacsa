import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, MapPinOff } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  LINEAS_PRODUCTO,
  RESULTADOS,
  TIPOS_INTERACCION,
  type Etapa,
  type LineaProducto,
  type Resultado,
  type TipoInteraccion,
} from "@/lib/catalogos";
import { FichaPunto } from "@/components/ficha-punto";
import { CumplirCompromiso } from "@/components/cumplir-compromiso";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

function fecha(valor: string) {
  return FECHA.format(new Date(valor));
}

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

export default async function Expediente({
  params,
}: PageProps<"/prospectos/[id]">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: prospecto } = await supabase
    .from("prospectos")
    .select(
      "id, nombre, tipo_comercio, etapa, productos_interes, contacto_nombre, contacto_telefono, ruc, notas, lat, lng",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // Si el RLS no deja verlo, para este usuario no existe. Es la respuesta
  // correcta: decir "existe pero no puedes verlo" ya es filtrar información.
  if (!prospecto) notFound();

  const { data: visitas } = await supabase
    .from("visitas")
    .select("id, tipo, fecha, resultado, notas, proveedor_actual, precio_referencia, sin_gps")
    .eq("prospecto_id", id)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  const { data: compromisos } = await supabase
    .from("compromisos")
    .select("id, descripcion, fecha_compromiso, cumplido_en")
    .eq("prospecto_id", id)
    .is("deleted_at", null)
    .is("cumplido_en", null)
    .order("fecha_compromiso", { ascending: true });

  const vigente = compromisos?.[0];
  const vencido = vigente ? vigente.fecha_compromiso < hoyEnPanama() : false;
  const ultima = visitas?.[0];

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <Link href="/" className="text-sm text-texto-secundario">
          Volver
        </Link>
        <h1 className="text-lg font-semibold text-marca">Expediente</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <FichaPunto
          id={prospecto.id}
          nombre={prospecto.nombre}
          tipoComercio={prospecto.tipo_comercio}
          etapa={prospecto.etapa as Etapa}
          potencial={null}
          ultimaInteraccion={ultima ? fecha(ultima.fecha) : null}
          enlazada={false}
        />

        <Link href={`/prospectos/${id}/visita`} className="block">
          <Boton ancho>Registrar visita</Boton>
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/prospectos/${id}/etapa`} className="block">
            <Boton tono="secundario" ancho>
              Cambiar etapa
            </Boton>
          </Link>
          <Link href={`/prospectos/${id}/editar`} className="block">
            <Boton tono="secundario" ancho>
              Editar datos
            </Boton>
          </Link>
        </div>

        {vigente && (
          <div
            className={[
              "flex items-start gap-2 rounded-lg border p-3",
              vencido
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-200 bg-blue-50 text-blue-700",
            ].join(" ")}
          >
            <CalendarClock size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {vencido ? "Compromiso vencido" : "Próximo paso"}
              </p>
              <p className="text-sm">{vigente.descripcion}</p>
              <p className="font-mono text-xs">
                {fecha(vigente.fecha_compromiso)}
              </p>
              <div className="mt-2">
                <CumplirCompromiso id={vigente.id} />
              </div>
            </div>
          </div>
        )}

        <Tarjeta className="flex flex-col gap-3">
          <p className="text-sm font-medium text-texto">Datos</p>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-texto-secundario">Contacto</dt>
              <dd className={prospecto.contacto_nombre ? "" : "text-texto-atenuado"}>
                {prospecto.contacto_nombre ?? "Sin registrar"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-texto-secundario">Teléfono</dt>
              <dd
                className={
                  prospecto.contacto_telefono
                    ? "font-mono"
                    : "text-texto-atenuado"
                }
              >
                {prospecto.contacto_telefono ?? "Sin registrar"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-texto-secundario">RUC</dt>
              <dd className={prospecto.ruc ? "font-mono" : "text-texto-atenuado"}>
                {prospecto.ruc ?? "Sin registrar"}
              </dd>
            </div>
          </dl>

          {prospecto.productos_interes?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(prospecto.productos_interes as LineaProducto[]).map((linea) => (
                <Insignia key={linea} tono="neutro">
                  {LINEAS_PRODUCTO[linea]}
                </Insignia>
              ))}
            </div>
          )}

          {prospecto.notas && (
            <p className="text-sm text-texto-secundario">{prospecto.notas}</p>
          )}
        </Tarjeta>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Bitácora</h2>

          {!visitas?.length && (
            <Tarjeta>
              <Vacio titulo="Sin interacciones todavía">
                Registra la primera visita para empezar el historial.
              </Vacio>
            </Tarjeta>
          )}

          {visitas?.map((v) => (
            <Tarjeta key={v.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-texto-secundario">
                  {fecha(v.fecha)}
                </span>
                <Insignia tono="neutro">
                  {TIPOS_INTERACCION[v.tipo as TipoInteraccion]}
                </Insignia>
              </div>

              <p className="text-sm font-medium text-texto">
                {RESULTADOS[v.resultado as Resultado]}
              </p>

              {v.notas && (
                <p className="text-sm text-texto-secundario">{v.notas}</p>
              )}

              {(v.proveedor_actual || v.precio_referencia !== null) && (
                <p className="text-xs text-texto-secundario">
                  {v.proveedor_actual ?? "Proveedor sin registrar"}
                  {v.precio_referencia !== null && (
                    <span className="font-mono">
                      {" — "}
                      {Number(v.precio_referencia).toFixed(2)} USD
                    </span>
                  )}
                </p>
              )}

              {v.sin_gps && (
                <p className="flex items-center gap-1 text-xs text-aviso">
                  <MapPinOff size={14} aria-hidden />
                  Registrada sin ubicación
                </p>
              )}
            </Tarjeta>
          ))}
        </section>
      </main>
    </>
  );
}
