import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
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
import { FiltroVendedor, type Vendedor } from "@/components/filtro-vendedor";
import { CarteraEnCifras } from "@/components/cartera-en-cifras";
import {
  MiMes,
  VentasEquipo,
  type FilaVendedor,
  type Pendiente,
} from "@/components/mi-mes";

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

const DIA = new Intl.DateTimeFormat("es-PA", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Panama",
});

const MES = new Intl.DateTimeFormat("es-PA", {
  month: "long",
  year: "numeric",
  timeZone: "America/Panama",
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

/**
 * Las tres preguntas que contesta la pantalla, cada una en su pestaña.
 *
 * **Están en orden de dureza**, y eso es deliberado: primero lo que ya ocurrió
 * y nadie discute, después la promesa escrita, y al final la intención. Quien
 * abre Ventas ve primero el número que es verdad.
 */
const PESTANAS = [
  { clave: "facturado", etiqueta: "Facturado" },
  { clave: "cartera", etiqueta: "Mi cartera" },
  { clave: "cotizaciones", etiqueta: "Cotizaciones" },
  { clave: "oportunidades", etiqueta: "Oportunidades" },
] as const;

type Pestana = (typeof PESTANAS)[number]["clave"];

type Oportunidad = {
  id: string;
  nombre: string;
  linea: string;
  fecha_cierre_estimada: string | null;
  descripcion: string | null;
  monto_estimado: string | number | null;
  etapa: string;
  vendedor_id: string;
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

type CotizacionFila = {
  id: string;
  codigo: string;
  total: string | number;
  emitida_en: string | null;
  cuenta_id: string;
  vendedor_id: string;
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

type FilaRanking = {
  contacto_id: string;
  nombre: string | null;
  cuenta_id: string | null;
  documentos: number;
  total: string | number;
  neto: string | number;
  por_cobrar: string | number;
  ultima_compra: string;
};

type FilaLinea = {
  linea: string;
  clientes: number;
  total: string | number;
};

type Comision = {
  perfil_id: string;
  vendido: string;
  base: string;
  comision: string;
  porcentaje: string;
  sobre_neto: boolean;
  documentos: number;
  por_cobrar: string;
};

function nombreDe(cuentas: Oportunidad["cuentas"]) {
  if (!cuentas) return "Cuenta";
  return Array.isArray(cuentas)
    ? (cuentas[0]?.nombre ?? "Cuenta")
    : cuentas.nombre;
}

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

/** Las que se estima cerrar antes de fin de mes. */
function abiertasDelMes(todas: Oportunidad[], hasta: string) {
  return todas.filter(
    (o) =>
      o.etapa !== "ganado" &&
      o.etapa !== "perdido" &&
      o.fecha_cierre_estimada !== null &&
      o.fecha_cierre_estimada <= hasta,
  );
}

export default async function Ventas({
  searchParams,
}: PageProps<"/oportunidades">) {
  // Los parámetros pueden llegar repetidos —?v=a&v=b— y entonces son un
  // arreglo. Se toma el primero: la pantalla mira a uno o a todos, nunca a dos.
  const params = await searchParams;
  const unoDe = (x: string | string[] | undefined) =>
    Array.isArray(x) ? x[0] : x;
  const v = unoDe(params.v);
  const t = unoDe(params.t);
  const vista = unoDe(params.vista);
  const porMes = vista === "mes";
  const pestana: Pestana =
    PESTANAS.find((p) => p.clave === t)?.clave ?? "facturado";

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // Quiénes puede mirar. El RLS de `perfiles` ya lo decide: el vendedor se ve
  // solo a sí mismo, el líder a su equipo, gerencia a todos. Solo quien puede
  // tener cartera — ofrecer administración es ofrecer una opción que siempre
  // devuelve cero.
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .in("rol", ["vendedor", "lider"])
    .is("deleted_at", null)
    .order("nombre");

  const vendedores = (perfiles ?? []) as Vendedor[];
  const nombreVendedor = new Map(vendedores.map((x) => [x.id, x.nombre]));

  // **Lo propio por omisión**, siempre que haya algo propio. Poder ver lo del
  // equipo no lo hace suyo, y la pantalla que arranca mezclando no contesta
  // ninguna pregunta.
  //
  // Gerencia es la excepción y no por descuido: no vende, así que su cartera
  // propia es cero. Arrancarla en cero sería mostrarle la única cifra de la
  // pantalla que no significa nada. Empieza mirando a todos.
  const puedeElegir = vendedores.length > 1;
  const propio = nombreVendedor.has(user.id) ? user.id : "todos";
  const elegido =
    puedeElegir && (v === "todos" || (v && nombreVendedor.has(v)))
      ? v
      : propio;
  const todos = elegido === "todos";
  const ids = todos ? vendedores.map((x) => x.id) : [elegido];

  const enlace = (cambios: { v?: string; t?: string; vista?: string }) => {
    const p = new URLSearchParams();
    const destino = { v: elegido, t: pestana, vista: porMes ? "mes" : "", ...cambios };
    if (destino.v !== propio) p.set("v", destino.v);
    if (destino.t !== "facturado") p.set("t", destino.t);
    if (destino.vista) p.set("vista", destino.vista);
    const cola = p.toString();
    return cola ? `/oportunidades?${cola}` : "/oportunidades";
  };

  // --- Lo que se carga siempre, porque alimenta la proyección -------------
  //
  // Las tres pestañas miran los mismos tres conjuntos desde ángulos distintos:
  // Facturado necesita cotizaciones y oportunidades para proyectar, y las
  // otras dos son esos mismos conjuntos vistos como trabajo pendiente.

  // Fin de mes en Panamá, no en el reloj del servidor: si se usara UTC, el
  // último día del mes las ventas del 31 se caerían de la lista de noche.
  const [anio, mes] = hoyEnPanama().split("-").map(Number);
  const hastaFin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);

  const [{ data: comisiones }, { data: crudas }, { data: cotizaciones }] =
    await Promise.all([
      supabase.rpc("comision_del_equipo", { p_perfiles: ids }),
      supabase
        .from("oportunidades")
        .select(
          "id, nombre, linea, descripcion, monto_estimado, etapa, fecha_cierre_estimada, vendedor_id, cuentas(nombre)",
        )
        .in("vendedor_id", ids)
        .is("deleted_at", null)
        .order("monto_estimado", { ascending: false, nullsFirst: false }),
      supabase
        .from("cotizaciones")
        .select("id, codigo, total, emitida_en, cuenta_id, vendedor_id, cuentas(nombre)")
        .in("vendedor_id", ids)
        .eq("estado", "emitida")
        .is("deleted_at", null)
        .order("emitida_en", { ascending: false }),
    ]);

  const oportunidades = (crudas ?? []) as unknown as Oportunidad[];

  // **Doce meses móviles, no año calendario.** Al vendedor el ejercicio
  // fiscal le da igual: lo que quiere saber es cómo viene su último año de
  // trabajo, hoy. Gerencia sí lee por año, y por eso pide otro rango a la
  // misma función.
  const haceUnAnio = new Date();
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1);

  // Solo cuando la pestaña lo pide: son dos consultas que agregan miles de
  // filas, y cargarlas para enseñar el embudo sería pagarlas por nada.
  const [{ data: ranking }, { data: lineas }] =
    pestana === "cartera"
      ? await Promise.all([
          supabase.rpc("ranking_de_clientes", {
            p_desde: haceUnAnio.toISOString().slice(0, 10),
            p_hasta: hoyEnPanama(),
            p_perfil: todos ? null : elegido,
          }),
          supabase.rpc("venta_por_linea", {
            p_desde: haceUnAnio.toISOString().slice(0, 10),
            p_hasta: hoyEnPanama(),
            p_perfil: todos ? null : elegido,
          }),
        ])
      : [{ data: null }, { data: null }];
  const cotiza = (cotizaciones ?? []) as unknown as CotizacionFila[];
  const dinero = (comisiones ?? []) as Comision[];

  const porPerfil = new Map(dinero.map((d) => [d.perfil_id, d]));
  const regla = dinero[0];
  const porcentaje = Number(regla?.porcentaje ?? 0);

  // De quién es cada cosa. Solo se escribe cuando se mira a más de uno: al
  // vendedor que mira lo suyo, poner su nombre en cada tarjeta es ruido.
  const deQuien = (id: string) =>
    todos ? (nombreVendedor.get(id) ?? "Sin vendedor") : null;

  const pendientes: Pendiente[] = [
    ...cotiza.map((c) => ({
      id: `cot-${c.id}`,
      clase: "cotizacion" as const,
      titulo: `Cotización ${c.codigo}`,
      cuenta: nombreDe(c.cuentas),
      monto: Number(c.total),
      cuando: c.emitida_en
        ? `emitida ${DIA.format(new Date(c.emitida_en))}`
        : null,
      vendedor: deQuien(c.vendedor_id),
    })),
    ...abiertasDelMes(oportunidades, hastaFin).map((o) => ({
      id: `op-${o.id}`,
      clase: "oportunidad" as const,
      titulo: o.nombre,
      cuenta: nombreDe(o.cuentas),
      monto: Number(o.monto_estimado ?? 0),
      cuando: o.fecha_cierre_estimada
        ? `cierra ${DIA.format(new Date(`${o.fecha_cierre_estimada}T12:00:00Z`))}`
        : null,
      vendedor: deQuien(o.vendedor_id),
    })),
  ].filter((x) => x.monto > 0);

  const abiertas = oportunidades.filter(
    (o) => o.etapa !== "ganado" && o.etapa !== "perdido",
  );
  const totalAbierto = abiertas.reduce(
    (suma, o) => suma + Number(o.monto_estimado ?? 0),
    0,
  );

  const filas: FilaVendedor[] = vendedores
    .map((x) => {
      const d = porPerfil.get(x.id);
      return {
        id: x.id,
        nombre: x.nombre,
        // El neto, no el bruto: es sobre lo que se calcula la comisión y es
        // lo que el vendedor reconoce como su venta.
        vendido: Number(d?.base ?? 0),
        comision: Number(d?.comision ?? 0),
        documentos: Number(d?.documentos ?? 0),
        esMio: x.id === user.id,
        href: enlace({ v: x.id }),
      };
    })
    .sort((a, b) => b.vendido - a.vendido);

  const uno = porPerfil.get(elegido);

  return (
    <>
      <AvisoSinConexion />

      {/* Se llamaba "Pipeline". Quedó del principio y no es la palabra del
          negocio: en el sistema esto son, sencillamente, las ventas — las ya
          facturadas, las prometidas por escrito y las que están en marcha. */}
      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Ventas</h1>
      </header>

      <FiltroVendedor
        vendedores={vendedores}
        elegido={elegido}
        yo={user.id}
        href={(valor) => enlace({ v: valor })}
      />

      <div
        className="grid border-b border-borde bg-superficie"
        style={{ gridTemplateColumns: `repeat(${PESTANAS.length}, minmax(0, 1fr))` }}
      >
        {PESTANAS.map(({ clave, etiqueta }) => {
          const activa = clave === pestana;
          const cuantas =
            clave === "cotizaciones"
              ? cotiza.length
              : clave === "oportunidades"
                ? abiertas.length
                : 0;

          return (
            <Link
              key={clave}
              href={enlace({ t: clave })}
              aria-current={activa ? "page" : undefined}
              // Con cuatro pestañas quedan 93 px cada una en un teléfono
              // angosto, y «Oportunidades» a 14 px no entra.
              className={`min-h-tactil flex items-center justify-center gap-1 border-b-2 px-0.5 text-xs ${
                activa
                  ? "border-b-marca font-medium text-marca"
                  : "border-b-transparent text-texto-atenuado"
              }`}
            >
              <span className="truncate">{etiqueta}</span>
              {cuantas > 0 && (
                <span className="font-mono text-xs text-texto-atenuado">
                  {cuantas}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <main className="flex flex-col gap-4 p-4">
        {pestana === "facturado" &&
          (todos ? (
            <VentasEquipo
              filas={filas}
              porcentaje={porcentaje}
              sobreNeto={regla?.sobre_neto ?? true}
              pendientes={pendientes}
            />
          ) : (
            <MiMes
              vendido={Number(uno?.base ?? 0)}
              comision={Number(uno?.comision ?? 0)}
              porcentaje={porcentaje}
              sobreNeto={uno?.sobre_neto ?? true}
              documentos={Number(uno?.documentos ?? 0)}
              porCobrar={Number(uno?.por_cobrar ?? 0)}
              pendientes={pendientes}
              detalleHref={
                elegido === user.id
                  ? "/oportunidades/cerradas"
                  : `/oportunidades/cerradas?v=${elegido}`
              }
              deQuien={
                elegido === user.id ? null : (nombreVendedor.get(elegido) ?? null)
              }
            />
          ))}

        {pestana === "cartera" && (
          <CarteraEnCifras
            clientes={((ranking ?? []) as FilaRanking[]).map((c) => ({
              contactoId: c.contacto_id,
              nombre: c.nombre ?? "Sin nombre",
              cuentaId: c.cuenta_id,
              // **Sin ITBMS, siempre.** El vendedor no maneja números con
              // impuesto: su comisión sale del neto y su papel también. Y
              // de paso el desglose por producto —que suma renglones, sin
              // impuesto— queda en la misma unidad y cuadra.
              total: Number(c.neto),
              porCobrar: Number(c.por_cobrar),
              documentos: c.documentos,
              ultimaCompra: c.ultima_compra,
            }))}
            lineas={((lineas ?? []) as FilaLinea[]).map((l) => ({
              linea: l.linea,
              total: Number(l.total),
              clientes: l.clientes,
            }))}
            deQuien={
              todos
                ? "todo el equipo"
                : elegido === user.id
                  ? null
                  : (nombreVendedor.get(elegido) ?? null)
            }
          />
        )}

        {pestana === "cotizaciones" && (
          <Cotizaciones filas={cotiza} deQuien={deQuien} />
        )}

        {pestana === "oportunidades" && (
          <>
            {/* Las dos vistas del embudo. Por etapa dice en qué momento está
                cada venta; por mes dice cuándo entra la plata — y es la única
                que muestra los huecos. */}
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-borde">
              {(
                [
                  ["", "Por etapa", !porMes],
                  ["mes", "Por mes", porMes],
                ] as const
              ).map(([valor, etiqueta, activa]) => (
                <Link
                  key={etiqueta}
                  href={enlace({ vista: valor })}
                  aria-current={activa ? "page" : undefined}
                  className={`min-h-tactil flex items-center justify-center text-sm ${
                    activa
                      ? "bg-marca font-medium text-white"
                      : "bg-superficie text-texto"
                  }`}
                >
                  {etiqueta}
                </Link>
              ))}
            </div>

            {oportunidades.length === 0 ? (
              <Tarjeta>
                <Vacio
                  titulo={
                    todos
                      ? "El equipo no tiene oportunidades abiertas"
                      : "Todavía no hay oportunidades"
                  }
                >
                  Se crean desde el expediente de una cuenta, una por cada línea
                  de producto que se esté negociando.
                </Vacio>
              </Tarjeta>
            ) : (
              <Tarjeta>
                {/* **No dice «en negociación».** Negociación es una de las
                    seis etapas, y usar la misma palabra para el total de
                    todas hacía leer que ahí solo iba lo que está en esa
                    etapa — cuando en realidad suma también lo nuevo, lo
                    contactado y lo cotizado. */}
                <p className="text-sm text-texto-secundario">
                  Por cerrar, en todas las etapas
                </p>
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

            {porMes && <PorMes oportunidades={abiertas} deQuien={deQuien} />}

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
                        <Insignia tono={TONO_ETAPA[etapa]}>
                          {ETAPAS[etapa]}
                        </Insignia>
                        <span className="text-xs text-texto-secundario">
                          {grupo.length}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-texto">
                        {MONTO.format(total)}
                      </span>
                    </div>

                    {grupo.map((o) => (
                      <Link
                        key={o.id}
                        href={`/oportunidades/${o.id}`}
                        className="block"
                      >
                        <Tarjeta className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-texto">
                              {o.nombre}
                            </p>
                            <p className="text-sm text-texto-secundario">
                              {nombreDe(o.cuentas)} ·{" "}
                              {LINEAS_PRODUCTO[o.linea as LineaProducto]}
                            </p>
                            {/* De quién es. Sin esto, el líder que mira al
                                equipo ve cuarenta ventas sin dueño y no puede
                                pedirle cuentas a nadie. */}
                            {deQuien(o.vendedor_id) && (
                              <p className="text-xs text-texto-secundario">
                                {deQuien(o.vendedor_id)}
                              </p>
                            )}
                            {/* La fecha vencida se marca en rojo: es lo que
                                congela la oportunidad hasta que alguien la
                                mueva. */}
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
          </>
        )}
      </main>
    </>
  );
}

/**
 * Las cotizaciones emitidas que todavía no son ni venta ni descarte.
 *
 * **Es la promesa escrita**, y por eso tiene su propia pestaña: una cotización
 * de la que nadie se acordó es la forma más cara de perder una venta — el
 * trabajo ya se hizo, el precio ya se dio, y solo faltó volver a llamar.
 *
 * Los días a la vista no son decoración: a los quince, la validez venció y lo
 * que el cliente tiene en la mano dejó de ser un compromiso.
 */
function Cotizaciones({
  filas,
  deQuien,
}: {
  filas: CotizacionFila[];
  deQuien: (id: string) => string | null;
}) {
  if (filas.length === 0) {
    return (
      <Tarjeta>
        <Vacio titulo="No hay cotizaciones en curso">
          Se arman desde el expediente de una cuenta, y aparecen aquí en cuanto
          se envían.
        </Vacio>
      </Tarjeta>
    );
  }

  const total = filas.reduce((s, c) => s + Number(c.total), 0);
  const hoy = hoyEnPanama();

  return (
    <>
      <Tarjeta>
        <p className="text-sm text-texto-secundario">Cotizado y sin respuesta</p>
        <p className="mt-1 font-mono text-3xl text-marca">
          {MONTO.format(total)}
        </p>
        <p className="mt-1 text-xs text-texto-secundario">
          {filas.length}{" "}
          {filas.length === 1 ? "cotización enviada" : "cotizaciones enviadas"}
        </p>
      </Tarjeta>

      {filas.map((c) => {
        // Quince días es la validez por omisión. Pasado eso, el papel que
        // tiene el cliente ya no obliga a nadie.
        const dias = c.emitida_en
          ? Math.floor(
              (new Date(`${hoy}T12:00:00Z`).getTime() -
                new Date(c.emitida_en).getTime()) /
                86_400_000,
            )
          : null;
        const vencida = dias !== null && dias > 15;

        return (
          <Link key={c.id} href={`/cuentas/${c.cuenta_id}`} className="block">
            <Tarjeta className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-texto">
                    {nombreDe(c.cuentas)}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-xs text-texto-atenuado">
                    <FileText size={12} aria-hidden />
                    {c.codigo}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-base text-texto">
                  {MONTO.format(Number(c.total))}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {dias !== null && (
                  <Insignia tono={vencida ? "aviso" : "neutro"}>
                    {vencida
                      ? `Vencida hace ${dias - 15} d`
                      : dias === 0
                        ? "Enviada hoy"
                        : `Hace ${dias} ${dias === 1 ? "día" : "días"}`}
                  </Insignia>
                )}
                {deQuien(c.vendedor_id) && (
                  <span className="text-xs text-texto-secundario">
                    {deQuien(c.vendedor_id)}
                  </span>
                )}
              </div>
            </Tarjeta>
          </Link>
        );
      })}
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
function PorMes({
  oportunidades,
  deQuien,
}: {
  oportunidades: Oportunidad[];
  deQuien: (id: string) => string | null;
}) {
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-texto">{o.nombre}</p>
                      <p className="text-xs text-texto-secundario">
                        {nombreDe(o.cuentas)}
                        {deQuien(o.vendedor_id) &&
                          ` · ${deQuien(o.vendedor_id)}`}
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-texto">{o.nombre}</p>
                  <p className="text-xs text-texto-secundario">
                    {nombreDe(o.cuentas)}
                    {deQuien(o.vendedor_id) && ` · ${deQuien(o.vendedor_id)}`}
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
