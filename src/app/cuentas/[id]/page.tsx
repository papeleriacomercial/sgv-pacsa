import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, HelpCircle, MapPinned, MapPinOff } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  ETAPAS,
  LINEAS_PRODUCTO,
  type MotivoDescarte,
  type TipoCuenta,
  type TipoPunto,
  RESULTADOS,
  TIPOS_INTERACCION,
  TONO_ETAPA,
  type Etapa,
  type LineaProducto,
  type Resultado,
  type TipoInteraccion,
} from "@/lib/catalogos";
import { FichaPunto } from "@/components/ficha-punto";
import { ClasificarCuenta } from "@/components/clasificar-cuenta";
import { AgregarALista } from "@/components/agregar-a-lista";
import { CadenaCuenta } from "@/components/cadena-cuenta";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

const MONTO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

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
}: PageProps<"/cuentas/[id]">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: prospecto } = await supabase
    .from("cuentas_resumen")
    .select(
      "id, nombre, tipo_comercio, tipo, motivo_descarte, cuenta_madre_id, tipo_punto, volumen, productos_interes, contacto_nombre, contacto_telefono, ruc, notas, direccion, poblado, dias_sin_contacto, dias_hasta_compromiso, fuera_de_cadencia, sin_ubicacion",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // Si el RLS no deja verlo, para este usuario no existe. Es la respuesta
  // correcta: decir "existe pero no puedes verlo" ya es filtrar información.
  if (!prospecto) notFound();

  const { data: visitas } = await supabase
    .from("seguimientos")
    .select("id, tipo, fecha, resultado, notas, proveedor_actual, precio_referencia, sin_gps")
    .eq("cuenta_id", id)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  const { data: compromisos } = await supabase
    .from("compromisos")
    .select("id, descripcion, fecha_compromiso, cumplido_en")
    .eq("cuenta_id", id)
    .is("deleted_at", null)
    .is("cumplido_en", null)
    .order("fecha_compromiso", { ascending: true });

  const { data: oportunidades } = await supabase
    .from("oportunidades")
    .select("id, linea, descripcion, monto_estimado, etapa")
    .eq("cuenta_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const descartada = prospecto.tipo === "descartada";
  const sinClasificar = prospecto.tipo === "sin_clasificar";
  const vigente = compromisos?.[0];
  const vencido = vigente ? vigente.fecha_compromiso < hoyEnPanama() : false;
  const ultima = visitas?.[0];

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver />
        <h1 className="text-lg font-semibold text-marca">Expediente</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <FichaPunto
          id={prospecto.id}
          nombre={prospecto.nombre}
          tipoComercio={prospecto.tipo_comercio}
          tipo={prospecto.tipo as TipoCuenta}
          potencial={null}
          ultimaInteraccion={ultima ? fecha(ultima.fecha) : null}
          enlazada={false}
        />

        {/* Salta al mapa centrado en esta cuenta. El camino de vuelta lo
            resuelve el historial, y como los filtros viven en la dirección, el
            mapa filtrado que se estaba mirando reaparece intacto. */}
        {!prospecto.sin_ubicacion && (
          <Link
            href={`/mapa?cuenta=${id}`}
            className="min-h-tactil flex items-center justify-center gap-2 self-start rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
          >
            <MapPinned size={16} aria-hidden />
            Ver en el mapa
          </Link>
        )}

        {/* La cola de trabajo hecha visible: una cuenta puesta en el mapa desde
            la oficina no es un prospecto hasta que alguien va y lo comprueba. */}
        {sinClasificar && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <HelpCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">Sin clasificar</p>
              <p className="text-xs">
                Nadie la ha visitado ni contactado todavía. Al registrar el
                primer seguimiento decides si queda como prospecto o se descarta.
              </p>
            </div>
          </div>
        )}

        {/* Registrar y programar son dos actos distintos: uno cuenta lo que ya
            pasó, el otro agenda lo que va a pasar. Juntarlos obligaba a
            inventar un resultado para poder agendar una visita futura. */}
        {!descartada && (
          <div className="flex flex-col gap-2">
            <Link href={`/cuentas/${id}/seguimiento`} className="block">
              <Boton ancho>Registrar seguimiento</Boton>
            </Link>
            <Link href={`/cuentas/${id}/programar`} className="block">
              <Boton tono="secundario" ancho>
                Programar seguimiento
              </Boton>
            </Link>
            {/* Lo que el cliente pide y resuelve otro. No es un seguimiento:
                es un encargo con destinatario y con reloj. */}
            <Link href={`/cuentas/${id}/solicitud`} className="block">
              <Boton tono="secundario" ancho>
                Pedir algo a la oficina
              </Boton>
            </Link>
          </div>
        )}

        <ClasificarCuenta
          id={id}
          tipo={prospecto.tipo as TipoCuenta}
          motivoDescarte={prospecto.motivo_descarte as MotivoDescarte | null}
        />

        <Link href={`/cuentas/${id}/editar`} className="block">
          <Boton tono="secundario" ancho>
            Editar datos
          </Boton>
        </Link>

        <AgregarALista cuentaId={id} />

        <CadenaCuenta
          id={id}
          cuentaMadreId={prospecto.cuenta_madre_id as string | null}
          tipoPunto={prospecto.tipo_punto as TipoPunto}
        />

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
              {/* Cumplir un compromiso es registrar qué pasó, no tocar un
                  botón que lo borra. El "ya lo hice" que había aquí cerraba el
                  compromiso sin dejar rastro del hecho, que es justo lo que
                  §1 no permite. Es el mismo camino que usa Seguimientos. */}
              <div className="mt-2">
                <Link
                  href={`/cuentas/${id}/seguimiento?compromiso=${vigente.id}`}
                  className="block"
                >
                  <Boton tono="secundario">Registrar lo que pasó</Boton>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Los días son cálculo, no captura: salen de la vista de resumen.
            "Fuera de cadencia" los compara contra la cadencia de esta cuenta,
            no contra un número plano igual para todas. */}
        <div className="grid grid-cols-2 gap-2">
          <Tarjeta
            className={
              prospecto.fuera_de_cadencia ? "border-red-200 bg-red-50" : undefined
            }
          >
            <p className="text-xs text-texto-secundario">Sin contacto</p>
            <p
              className={`font-mono text-2xl ${
                prospecto.fuera_de_cadencia ? "text-error" : "text-texto"
              }`}
            >
              {prospecto.dias_sin_contacto ?? "—"}
            </p>
            <p className="text-xs text-texto-atenuado">
              {prospecto.dias_sin_contacto === null
                ? "Nunca contactada"
                : prospecto.fuera_de_cadencia
                  ? "Pasada de su cadencia"
                  : "días"}
            </p>
          </Tarjeta>

          <Tarjeta>
            <p className="text-xs text-texto-secundario">Próximo paso</p>
            <p className="font-mono text-2xl text-texto">
              {prospecto.dias_hasta_compromiso ?? "—"}
            </p>
            <p className="text-xs text-texto-atenuado">
              {prospecto.dias_hasta_compromiso === null
                ? "Sin compromiso"
                : prospecto.dias_hasta_compromiso < 0
                  ? "días vencido"
                  : "días"}
            </p>
          </Tarjeta>
        </div>

        {prospecto.sin_ubicacion && (
          <Link href={`/cuentas/${id}/ubicar`} className="block">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <MapPinOff size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-medium">Esta cuenta no tiene ubicación</p>
                <p className="text-xs">
                  No aparece en el mapa. Toca aquí para marcarla.
                </p>
              </div>
            </div>
          </Link>
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
              <dt className="text-texto-secundario">Poblado</dt>
              <dd className={prospecto.poblado ? "" : "text-texto-atenuado"}>
                {prospecto.poblado ?? "Sin registrar"}
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-texto">Oportunidades</h2>
            <Link
              href={`/cuentas/${id}/nueva-oportunidad`}
              className="text-sm text-texto-secundario underline"
            >
              Agregar
            </Link>
          </div>

          {!oportunidades?.length && (
            <Tarjeta>
              <Vacio titulo="Sin oportunidades">
                Crea una por cada línea de producto que estés negociando. Es lo
                que alimenta el pipeline.
              </Vacio>
            </Tarjeta>
          )}

          {oportunidades?.map((o) => (
            <Link key={o.id} href={`/oportunidades/${o.id}`} className="block">
              <Tarjeta className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-texto">
                    {LINEAS_PRODUCTO[o.linea as LineaProducto]}
                  </p>
                  {o.descripcion && (
                    <p className="text-xs text-texto-secundario">
                      {o.descripcion}
                    </p>
                  )}
                  <div className="mt-1">
                    <Insignia tono={TONO_ETAPA[o.etapa as Etapa]}>
                      {ETAPAS[o.etapa as Etapa]}
                    </Insignia>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm ${
                    o.monto_estimado !== null ? "text-texto" : "text-texto-atenuado"
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
