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
import { BorrarCuenta } from "@/components/borrar-cuenta";
import { AgregarALista } from "@/components/agregar-a-lista";
import { CadenaCuenta } from "@/components/cadena-cuenta";
import { Tarjeta } from "@/components/ui/tarjeta";
import { QueCompra } from "@/components/que-compra";
import { VentaCruzada, type Cruce } from "@/components/venta-cruzada";
import { DescargarCotizacion } from "@/components/descargar-cotizacion";
import { ComparacionEnLaFicha } from "@/components/comparacion-guardada";
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

type FilaCruce = {
  linea: string;
  la_compra: boolean;
  gasto_mensual: string | number;
  dias_sin_pedirla: number | null;
  pares_compran: number;
  pares_totales: number;
  gasto_tipico: string | number | null;
  suficiente: boolean;
};

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
      "id, nombre, tipo_comercio, tipo, motivo_descarte, cuenta_madre_id, tipo_punto, volumen, productos_interes, contacto_nombre, contacto_telefono, ruc, notas, direccion, poblado, vendedor_id, dias_cadencia, dias_sin_contacto, dias_hasta_compromiso, fuera_de_cadencia, sin_ubicacion, ultima_compra, dias_sin_comprar, compras_12m, total_12m, cadencia_observada, dejo_de_comprar",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // Si el RLS no deja verlo, para este usuario no existe. Es la respuesta
  // correcta: decir "existe pero no puedes verlo" ya es filtrar información.
  if (!prospecto) notFound();

  // **Venta cruzada**: qué líneas compra y cuáles no, contra lo que compran
  // los comercios de su mismo tipo. Es la conversación de venta más barata
  // que hay — un cliente que ya te compra y ya te paga, al que le estás
  // vendiendo una sola de las cuatro cosas que fabricas.
  const { data: crudo } = prospecto.tipo_comercio
    ? await supabase.rpc("venta_cruzada", { p_cuenta: id })
    : { data: null };

  const cruce: Cruce[] = ((crudo ?? []) as FilaCruce[]).map((x) => ({
    linea: x.linea,
    laCompra: x.la_compra,
    gastoMensual: Number(x.gasto_mensual),
    diasSinPedirla: x.dias_sin_pedirla,
    paresCompran: x.pares_compran,
    paresTotales: x.pares_totales,
    gastoTipico: x.gasto_tipico === null ? null : Number(x.gasto_tipico),
    suficiente: x.suficiente,
  }));

  // Las cotizaciones que se le han emitido. Van a la bitácora junto con los
  // seguimientos: una cotización entregada es un hecho, tan hecho como una
  // visita — y verlas en la misma línea contesta sola la pregunta de si se
  // cotizó y no compró.
  const { data: cotizaciones } = await supabase
    .from("cotizaciones")
    .select(
      "id, codigo, total, emitida_en, pdf_path, con_itbms, estado, motivo_anulacion, motivo_perdida, validez_dias",
    )
    .eq("cuenta_id", id)
    // Las cerradas también. El expediente tiene que contar qué pasó con cada
    // promesa, no sólo cuáles siguen vivas: una cotización perdida por precio
    // es justo lo que hay que ver antes de volver a cotizarle a este cliente.
    .in("estado", ["emitida", "anulada", "ganada", "perdida"])
    .is("deleted_at", null)
    .order("emitida_en", { ascending: false });

  const esMia = prospecto.vendedor_id === user.id;

  /**
   * Cuándo se le acaba la validez a una cotización.
   *
   * Se calcula acá —en el servidor— y no en el navegador del vendedor: el
   * teléfono puede tener la hora corrida, y una cotización que se ve vencida un
   * día antes le hace perder una venta.
   */
  function venceEl(emitida: string | null, dias: number | null): string | null {
    if (!emitida) return null;
    const d = new Date(emitida);
    d.setDate(d.getDate() + (dias ?? 15));
    return d.toISOString();
  }

  // **Si esta cuenta fue un error.** La regla vive en la base —la creó
  // quien pregunta, es potencial o prospecto, y nadie la tocó— y aquí solo
  // se consulta, para no ofrecer un botón que va a rebotar.
  const { data: esUnError } = await supabase.rpc("cuenta_es_un_error", {
    p_cuenta: id,
  });

  // Cómo se llama esta cuenta en la contabilidad. Casi nunca es igual: el
  // vendedor conoce el rótulo y la factura lleva la razón social.
  const { data: enBooks } = await supabase
    .from("clientes_zoho")
    .select("nombre")
    .eq("cuenta_id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // Qué le vende, ordenado por lo que más pesa. Ocho alcanzan: el resto es
  // cola larga que nadie mira parado frente al mostrador.
  const { data: lineas } = await supabase
    .from("lineas_por_cuenta")
    .select("producto, veces, total, ultima_vez, dias_sin_pedirlo")
    .eq("cuenta_id", id)
    .order("total", { ascending: false })
    .limit(8);

  // Las comparaciones de costo entregadas. Van a la bitácora por la misma razón
  // que las cotizaciones: son un hecho, tan hecho como una visita.
  const { data: comparaciones } = await supabase
    .from("comparaciones")
    .select(
      "id, creada_en, marca_competencia, nuestro_precio_caja, nuestro_rollos_caja, nuestro_metros_rollo, nuestro_calibre, cliente_precio_caja, cliente_rollos_caja, cliente_metros_rollo, ahorro_por_pedido, diferencia_al_ano, archivo_path",
    )
    .eq("cuenta_id", id)
    .is("deleted_at", null)
    .order("creada_en", { ascending: false })
    .limit(8);

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
  const esPotencial = prospecto.tipo === "potencial";
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
          zona={prospecto.poblado}
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
        {esPotencial && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <HelpCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">Potencial</p>
              <p className="text-xs">
                Nadie ha ido ni la ha contactado todavía. Al registrar el
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
            {/* Los dos documentos que el vendedor arma en el acto. Solo el
                dueño de la cuenta: la venta tiene que quedar a nombre de
                quien la trabajó.

                Ninguno de los dos tiene tope para armarse. Lo que el monto y
                el ITBMS deciden es a quién se lo entrega — a él mismo o a la
                oficina—, y eso se resuelve al final, con el PDF delante. */}
            {esMia && (
              <>
                <Link href={`/cuentas/${id}/cotizar`} className="block">
                  <Boton tono="secundario" ancho>
                    Cotizar
                  </Boton>
                </Link>
                {/* Debajo de la cotización a propósito: es el paso anterior. Se le demuestra
                    al cliente que el metro le sale más barato, y con eso en la mano se le
                    cotiza. Al revés —cotizar primero— la conversación se va al precio de la
                    caja, que es justamente donde perdemos. */}
                <Link href={`/cuentas/${id}/comparador`} className="block">
                  <Boton tono="secundario" ancho>
                    Comparar rendimiento
                  </Boton>
                </Link>
                {/* La nota de entrega de la libreta, en el teléfono. La
                    libreta sigue vigente: esto es para el cliente que pide
                    algo más formal. */}
                <Link href={`/cuentas/${id}/orden`} className="block">
                  <Boton tono="secundario" ancho>
                    Hacer orden de venta
                  </Boton>
                </Link>
              </>
            )}
            {/* Lo que queda de pedir a la oficina: muestras y precios. La
                cotización y el pedido ya no se piden por formulario — nacen
                del documento, que trae los renglones y el total. */}
            <Link href={`/cuentas/${id}/solicitud`} className="block">
              <Boton tono="secundario" ancho>
                Pedir muestra o precio
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

        {/* Al final y en letra pequeña. Borrar es raro y no debe competir
            por la atención con lo que se hace todos los días. */}
        {esUnError === true && (
          <BorrarCuenta id={id} nombre={prospecto.nombre} />
        )}

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
              <dt className="text-texto-secundario">Poblado o zona</dt>
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

        <VentaCruzada cruce={cruce} />

        <QueCompra
          cuentaId={prospecto.id}
          nombreCuenta={prospecto.nombre}
          nombreFacturacion={enBooks?.nombre ?? null}
          ultimaCompra={prospecto.ultima_compra}
          diasSinComprar={prospecto.dias_sin_comprar}
          compras12m={prospecto.compras_12m}
          total12m={prospecto.total_12m === null ? null : Number(prospecto.total_12m)}
          cadenciaObservada={prospecto.cadencia_observada}
          cadenciaPuesta={prospecto.dias_cadencia}
          dejoDeComprar={prospecto.dejo_de_comprar}
          lineas={(lineas ?? []).map((l) => ({
            ...l,
            veces: Number(l.veces),
            total: Number(l.total),
            dias_sin_pedirlo: Number(l.dias_sin_pedirlo),
          }))}
        />

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

        {/* El ancla la usa el seguimiento: al guardar uno en un cliente con
            cotizaciones vivas, aterriza acá y no arriba del expediente. */}
        {(cotizaciones ?? []).length > 0 && (
          <section id="cotizaciones" className="flex flex-col gap-2 scroll-mt-4">
            <h2 className="text-sm font-medium text-texto">Cotizaciones</h2>
            {(cotizaciones ?? []).map((c) => (
              <DescargarCotizacion
                key={c.id}
                id={c.id}
                codigo={c.codigo}
                total={Number(c.total)}
                conItbms={c.con_itbms}
                emitidaEn={c.emitida_en}
                ruta={c.pdf_path}
                anulada={c.estado === "anulada"}
                motivo={c.motivo_anulacion}
                esMia={esMia}
                estado={c.estado}
                motivoPerdidaGuardado={c.motivo_perdida}
                venceEl={venceEl(c.emitida_en, c.validez_dias)}
              />
            ))}
          </section>
        )}

        {/* Contesta la pregunta que el vendedor se hace al volver al local: qué
            le ofrecí a éste. Sin esto no tiene respuesta — la hoja se la llevó
            el cliente y el precio iba escrito a mano, así que no se puede
            deducir de ninguna lista. */}
        {(comparaciones ?? []).length > 0 && (
          <section id="comparaciones" className="flex flex-col gap-2 scroll-mt-4">
            <h2 className="text-sm font-medium text-texto">Comparaciones de costo</h2>
            {(comparaciones ?? []).map((c) => (
              <ComparacionEnLaFicha
                key={c.id}
                c={{
                  ...c,
                  nuestro_precio_caja: Number(c.nuestro_precio_caja),
                  nuestro_rollos_caja: Number(c.nuestro_rollos_caja),
                  nuestro_metros_rollo: Number(c.nuestro_metros_rollo),
                  cliente_precio_caja:
                    c.cliente_precio_caja === null ? null : Number(c.cliente_precio_caja),
                  cliente_rollos_caja:
                    c.cliente_rollos_caja === null ? null : Number(c.cliente_rollos_caja),
                  cliente_metros_rollo:
                    c.cliente_metros_rollo === null ? null : Number(c.cliente_metros_rollo),
                  ahorro_por_pedido:
                    c.ahorro_por_pedido === null ? null : Number(c.ahorro_por_pedido),
                  diferencia_al_ano:
                    c.diferencia_al_ano === null ? null : Number(c.diferencia_al_ano),
                }}
              />
            ))}
          </section>
        )}

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
