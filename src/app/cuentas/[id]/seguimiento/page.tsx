"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Camera, MapPin, MapPinOff } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import { subirFoto } from "@/lib/fotos";
import { obtenerUbicacion, calidadUbicacion, type Ubicacion } from "@/lib/gps";
import {
  DESCARTE_SUGERIDO,
  RESUELVE,
  RESULTADOS_CON_VENTA_LARGA,
  RESULTADO_VENTA,
  MOTIVOS_COMPETENCIA,
  MOTIVOS_DESCARTE,
  RESULTADOS,
  RESULTADOS_CON_COMPETENCIA,
  RESULTADOS_CON_RECONTACTO,
  RESULTADOS_TERMINALES,
  TIPOS_INTERACCION,
  type MotivoCompetencia,
  type LineaProducto,
  type MotivoDescarte,
  type Resultado,
  type ResuelveSolicitud,
  type TipoCuenta,
  type TipoInteraccion,
} from "@/lib/catalogos";
import {
  CampoCompetidor,
  registrarCompetidor,
} from "@/components/campo-competidor";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";
import { CampoRuc } from "@/components/campo-ruc";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Panama",
  });
}

/**
 * Qué se hace con una cuenta que era un potencial.
 *
 * Son tres destinos y no dos: si le compró en la misma visita no es un
 * prospecto —prospecto es quien todavía no compra— es un cliente, y saltar
 * por prospecto sería registrar un estado por el que nunca pasó.
 */
const CLASIFICACION = {
  prospecto: "Sí, queda como prospecto",
  cliente: "Ya me compró: es cliente",
  descartada: "No, se descarta",
} as const;

type Clasificacion = keyof typeof CLASIFICACION;

export default function RegistrarSeguimiento() {
  return (
    <Suspense fallback={<Cargando />}>
      <Formulario />
    </Suspense>
  );
}

/**
 * Registrar un seguimiento: contar qué pasó, cuando ya pasó.
 *
 * Programar lo que se va a hacer es otra pantalla (`/programar`). Aquí siempre
 * se está hablando en pasado.
 *
 * El orden de los campos no es cosmético: la **intención** va primero porque
 * decide el resto de la pantalla. Una llamada no tiene check-in ni foto del
 * local, y pedírselos enseña al vendedor a saltarse campos, que es el hábito
 * que después vacía la base.
 */
function Formulario() {
  const router = useRouter();
  const { id: cuentaId } = useParams<{ id: string }>();

  // Cuando se llega desde la pantalla de Seguimientos, se viene a cumplir un
  // compromiso concreto: al guardar se cierra ese y se encadena el siguiente.
  const parametros = useSearchParams();
  const compromisoId = parametros.get("compromiso");
  // Si se llega desde una oportunidad, el seguimiento queda ligado a esa venta.
  const oportunidadId = parametros.get("oportunidad");

  const [nombreCuenta, setNombreCuenta] = useState("");

  // El RUC de la cuenta, si ya lo tiene. Si no, se pide al facturar.
  const [rucCuenta, setRucCuenta] = useState<string | null>(null);
  const [ruc, setRuc] = useState("");
  const [sinRuc, setSinRuc] = useState(false);
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta | null>(null);
  const [lineaDeLaCuenta, setLineaDeLaCuenta] = useState<LineaProducto>("otros");
  const [cargando, setCargando] = useState(true);

  const [tipo, setTipo] = useState<TipoInteraccion>("visita");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [clasificacion, setClasificacion] = useState<Clasificacion | null>(null);
  const [motivoDescarte, setMotivoDescarte] = useState<MotivoDescarte | null>(
    null,
  );
  const [notas, setNotas] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [motivosCompetencia, setMotivosCompetencia] = useState<
    MotivoCompetencia[]
  >([]);
  const [precio, setPrecio] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  // El pedido, cuando la visita terminó en venta.
  const [pedidoDetalle, setPedidoDetalle] = useState("");
  const [pedidoMonto, setPedidoMonto] = useState("");
  const [pedidoFactura, setPedidoFactura] = useState<ResuelveSolicitud>("yo");
  const [entregado, setEntregado] = useState(true);

  // La venta que va a tomar tiempo.
  const [abrirVenta, setAbrirVenta] = useState(false);
  const [ventaNombre, setVentaNombre] = useState("");
  const [ventaMonto, setVentaMonto] = useState("");
  const [ventaCierre, setVentaCierre] = useState("");

  const [proximoPaso, setProximoPaso] = useState("");
  const [accion, setAccion] = useState<TipoInteraccion>("visita");
  const [fechaCompromiso, setFechaCompromiso] = useState("");

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [falloGps, setFalloGps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esVisita = tipo === "visita";

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("cuentas")
      .select("nombre, tipo, productos_interes, ruc")
      .eq("id", cuentaId)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNombreCuenta(data.nombre ?? "");
          setRucCuenta((data.ruc as string | null) ?? null);
          setTipoCuenta(data.tipo as TipoCuenta);
          // La venta hereda la línea que la cuenta ya declaró. Dejar todo en
          // "otros" volvería inútil el reporte por línea de producto (§7.7).
          const lineas = (data.productos_interes ?? []) as LineaProducto[];
          if (lineas.length > 0) setLineaDeLaCuenta(lineas[0]);
        }
        setCargando(false);
      });
  }, [cuentaId]);

  // El check-in arranca solo, sin botón: es uno de los gestos que hay que
  // quitar para bajar de 30 segundos. Pero solo en una visita: pedirle la
  // ubicación al celular durante una llamada no dice nada, gasta batería y
  // saca un permiso del navegador sin motivo.
  //
  // Se pide una sola vez. Volver a "visita" después de mirar otra opción no
  // vuelve a preguntar: el vendedor no se movió mientras tocaba la pantalla.
  const yaSePidio = useRef(false);

  useEffect(() => {
    if (!esVisita || yaSePidio.current) return;
    yaSePidio.current = true;

    obtenerUbicacion().then((leida) => {
      setUbicacion(leida);
      setFalloGps(leida === null);
    });
  }, [esVisita]);

  // Derivado, no un estado más: hay lectura en curso mientras no haya llegado
  // ni ubicación ni fallo.
  const buscandoGps = esVisita && ubicacion === null && !falloGps;

  const esTerminal =
    resultado !== null && RESULTADOS_TERMINALES.includes(resultado);
  const exigeRecontacto =
    resultado !== null && RESULTADOS_CON_RECONTACTO.includes(resultado);
  // La ficha de competencia solo aparece con los resultados que implican que
  // hay alguien más vendiéndole. Pedirla en toda visita duplicaría el tiempo de
  // captura y enseñaría a elegir resultados que no la disparan.
  const hayCompetencia =
    resultado !== null && RESULTADOS_CON_COMPETENCIA.includes(resultado);
  const puedeSerVentaLarga =
    resultado !== null && RESULTADOS_CON_VENTA_LARGA.includes(resultado);
  const hayQueClasificar = tipoCuenta === "potencial";
  const seDescarta = clasificacion === "descartada";

  // §6 obliga a dejar próximo paso, y esa regla es la que evita que una cuenta
  // se apague sin que nadie lo note. Se relaja solo donde inventarlo sería
  // peor: local cerrado, no usa nuestros productos, sin interés, o la cuenta
  // que se acaba de descartar. En todo lo demás sigue siendo obligatorio.
  // Con una venta recién cerrada la cuenta no corre riesgo de apagarse: la
  // cadencia se encarga del resto. Exigir un próximo paso ahí produciría un
  // compromiso inventado, igual que en los resultados terminales.
  const huboVenta = resultado === RESULTADO_VENTA;
  const exigeProximoPaso = !esTerminal && !seDescarta && !huboVenta;
  const empezoElPaso = proximoPaso.trim() !== "" || fechaCompromiso !== "";

  const listo =
    resultado !== null &&
    (!huboVenta || pedidoDetalle.trim() !== "") &&
    (!abrirVenta || ventaNombre.trim() !== "") &&
    // La lectura tarda ocho segundos como mucho. Dejar guardar antes marcaría
    // la visita como `sin_gps` cuando el GPS iba a enganchar en un segundo más.
    !buscandoGps &&
    (!hayQueClasificar || clasificacion !== null) &&
    (!seDescarta || motivoDescarte !== null) &&
    (exigeProximoPaso
      ? proximoPaso.trim() !== "" && fechaCompromiso !== ""
      : // Opcional, pero no a medias: o los dos campos o ninguno.
        !empezoElPaso || (proximoPaso.trim() !== "" && fechaCompromiso !== ""));

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!listo || !resultado) return;
    setError(null);
    setGuardando(true);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Se cerró la sesión. Vuelve a entrar.");
      setGuardando(false);
      return;
    }

    // El competidor escrito se suma al catálogo compartido, si es nuevo.
    if (hayCompetencia && proveedor.trim()) {
      await registrarCompetidor(proveedor);
    }

    const visitaId = crypto.randomUUID();

    // La foto se sube antes de insertar el seguimiento, no después. Los
    // seguimientos no tienen política de UPDATE (son bitácora), así que no se
    // les puede pegar la ruta de la foto más tarde.
    let fotoPath: string | null = null;
    if (foto) {
      fotoPath = await subirFoto(supabase, user.id, visitaId, foto);
      if (!fotoPath) {
        setError(
          "No se pudo subir la foto. Revisa la señal e intenta de nuevo.",
        );
        setGuardando(false);
        return;
      }
    }

    const { error: falloVisita } = await insertar("seguimientos", {
      id: visitaId,
      cuenta_id: cuentaId,
      vendedor_id: user.id,
      tipo,
      resultado,
      notas: notas.trim() || null,
      proveedor_actual: proveedor.trim() || null,
      motivos_competencia: hayCompetencia ? motivosCompetencia : [],
      precio_referencia: precio ? Number(precio) : null,
      foto_path: fotoPath,
      // El check-in solo existe en la visita. En lo demás va nulo y `sin_gps`
      // queda en falso: no falló el GPS, es que no aplicaba.
      checkin_lat: esVisita ? (ubicacion?.lat ?? null) : null,
      checkin_lng: esVisita ? (ubicacion?.lng ?? null) : null,
      checkin_precision_m: esVisita ? (ubicacion?.precisionM ?? null) : null,
      sin_gps: esVisita && ubicacion === null,
      oportunidad_id: oportunidadId,
    }, `Seguimiento de ${nombreCuenta}`);

    if (falloVisita) {
      setError(falloVisita);
      setGuardando(false);
      return;
    }

    // El potencial se resuelve aquí, con el hecho a la vista, y no
    // en una bandeja aparte que nadie vacía.
    if (hayQueClasificar && clasificacion) {
      const { error: falloTipo } = await supabase
        .from("cuentas")
        .update({
          tipo: clasificacion,
          motivo_descarte: seDescarta ? motivoDescarte : null,
        })
        .eq("id", cuentaId);

      if (falloTipo) {
        setError(
          `El seguimiento quedó guardado, pero la cuenta no se clasificó: ${falloTipo.message}`,
        );
        setGuardando(false);
        return;
      }
    }

    // La venta que va a tomar tiempo. Se crea antes del compromiso para que el
    // próximo paso pueda colgar de ella: es lo que hace que la agenda diga a
    // qué venta sirve cada renglón.
    let ventaId: string | null = oportunidadId;

    if (abrirVenta && ventaNombre.trim()) {
      const nuevaVenta = crypto.randomUUID();
      const { error: falloVenta } = await insertar(
        "oportunidades",
        {
          id: nuevaVenta,
          cuenta_id: cuentaId,
          vendedor_id: user.id,
          nombre: ventaNombre.trim(),
          linea: lineaDeLaCuenta,
          monto_estimado: ventaMonto ? Number(ventaMonto) : null,
          fecha_cierre_estimada: ventaCierre || null,
          etapa: "contactado",
        },
        `Venta abierta con ${nombreCuenta}`,
      );

      if (falloVenta) {
        setError(
          `El seguimiento quedó guardado, pero la venta no: ${falloVenta}`,
        );
        setGuardando(false);
        return;
      }

      ventaId = nuevaVenta;
    }

    // El RUC va a la cuenta, no a la solicitud: es un dato del comercio y
    // sirve para siempre, no solo para este pedido. Y es lo que va a
    // permitir reconocer la factura cuando vuelva de Zoho con la razón
    // social en vez del nombre del rótulo.
    if (huboVenta && !rucCuenta && ruc.trim()) {
      const supabase = clienteNavegador();
      await supabase
        .from("cuentas")
        .update({ ruc: ruc.trim() })
        .eq("id", cuentaId);
    }

    // El pedido. Nace como solicitud porque es exactamente eso: si lo factura
    // él con su talonario se cierra en el acto; si necesita factura fiscal,
    // sale a la bandeja de administración con su reloj.
    if (huboVenta && pedidoDetalle.trim()) {
      const ahora = new Date().toISOString();
      const propio = pedidoFactura === "yo";

      const { error: falloPedido } = await insertar(
        "solicitudes",
        {
          id: crypto.randomUUID(),
          cuenta_id: cuentaId,
          oportunidad_id: ventaId,
          vendedor_id: user.id,
          tipo: "pedido",
          resuelve: pedidoFactura,
          detalle: pedidoDetalle.trim(),
          monto_estimado: pedidoMonto ? Number(pedidoMonto) : null,
          // Si se la dejó del carro, el pedido nace cerrado: no hay nada que
          // esperar de nadie.
          estado: propio && entregado ? "resuelta" : "pendiente",
          respuesta:
            propio && entregado ? "Facturado y entregado en la visita" : null,
          resuelta_en: propio && entregado ? ahora : null,
          resuelta_por: propio && entregado ? user.id : null,
        },
        `Pedido de ${nombreCuenta}`,
      );

      if (falloPedido) {
        setError(
          `El seguimiento quedó guardado, pero el pedido no: ${falloPedido}`,
        );
        setGuardando(false);
        return;
      }
    }

    // El compromiso que motivó este seguimiento se da por cumplido. Registrar
    // lo que se hizo es lo que lo cierra: no hay un botón aparte de "ya lo
    // hice" que se pueda tocar sin dejar rastro de qué pasó.
    if (compromisoId) {
      await supabase
        .from("compromisos")
        .update({ cumplido_en: new Date().toISOString() })
        .eq("id", compromisoId);
    }

    if (proximoPaso.trim() && fechaCompromiso) {
      const { error: falloCompromiso } = await insertar(
        "compromisos",
        {
          id: crypto.randomUUID(),
          cuenta_id: cuentaId,
          visita_id: visitaId,
          // El próximo paso hereda la venta del seguimiento que lo originó, sin
          // que él la elija otra vez. Es lo que hace que la agenda sepa a qué
          // venta sirve cada renglón.
          oportunidad_id: ventaId,
          vendedor_id: user.id,
          descripcion: proximoPaso.trim(),
          fecha_compromiso: fechaCompromiso,
          tipo_accion: accion,
        },
        `Próximo paso de ${nombreCuenta}`,
      );

      if (falloCompromiso) {
        setError(
          `El seguimiento quedó guardado, pero el compromiso no: ${falloCompromiso}`,
        );
        setGuardando(false);
        return;
      }
    }

    // Volver a donde se venía: si el seguimiento salió de la agenda, ahí es
    // donde el vendedor sigue trabajando.
    router.replace(
      oportunidadId
        ? `/oportunidades/${oportunidadId}`
        : compromisoId
          ? "/seguimientos"
          : `/cuentas/${cuentaId}`,
    );
    router.refresh();
  }

  const calidad = ubicacion ? calidadUbicacion(ubicacion.precisionM) : null;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/${cuentaId}`} />
        <h1 className="text-lg font-semibold text-marca">
          Registrar seguimiento
        </h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {cargando && <Cargando />}

        {!cargando && (
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <Tarjeta>
              <p className="text-xs text-texto-secundario">Cuenta</p>
              <p className="text-base font-semibold text-texto">
                {nombreCuenta}
              </p>
            </Tarjeta>

            {/* 1. La intención, primero: decide qué se pregunta después. */}
            <Tarjeta>
              <Opciones
                etiqueta="¿Qué hiciste?"
                opciones={TIPOS_INTERACCION}
                valor={tipo}
                onCambio={setTipo}
              />
            </Tarjeta>

            {/* 2. El check-in, solo si fue visita. */}
            {esVisita && (
              <Tarjeta>
                <div className="flex items-center gap-2">
                  {ubicacion ? (
                    <MapPin size={18} className="text-ok" aria-hidden />
                  ) : (
                    <MapPinOff size={18} className="text-aviso" aria-hidden />
                  )}
                  <div className="flex-1">
                    {buscandoGps && (
                      <p className="text-sm text-texto-secundario">
                        Tomando check-in
                      </p>
                    )}
                    {!buscandoGps && calidad && (
                      <Insignia tono={calidad.tono}>{calidad.texto}</Insignia>
                    )}
                    {!buscandoGps && !ubicacion && (
                      <>
                        <p className="text-sm font-medium text-texto">Sin GPS</p>
                        <p className="text-xs text-texto-secundario">
                          La visita se guarda marcada como sin ubicación.
                        </p>
                      </>
                    )}
                    <p className="mt-1 text-xs text-texto-atenuado">
                      Esto es dónde estabas tú, no dónde queda el local. La
                      ubicación de la cuenta se corrige en Editar datos.
                    </p>
                  </div>
                </div>
              </Tarjeta>
            )}

            {/* 3. El resultado. */}
            <Tarjeta>
              <Opciones
                etiqueta="Resultado"
                opciones={RESULTADOS}
                valor={resultado}
                onCambio={(nuevo) => {
                  setResultado(nuevo);
                  // La clasificación se presugiere, no se decide sola: el
                  // vendedor la ve marcada y la cambia si no es así.
                  if (hayQueClasificar) {
                    const terminal = RESULTADOS_TERMINALES.includes(nuevo);
                    setClasificacion(
                      nuevo === RESULTADO_VENTA
                        ? "cliente"
                        : terminal
                          ? "descartada"
                          : "prospecto",
                    );
                    setMotivoDescarte(
                      terminal ? (DESCARTE_SUGERIDO[nuevo] ?? "otro") : null,
                    );
                  }
                }}
              />
            </Tarjeta>

            {/* 4. Si la cuenta era un potencial, se resuelve aquí. */}
            {hayQueClasificar && (
              <Tarjeta className="flex flex-col gap-4 border-amber-200 bg-amber-50">
                <div>
                  <p className="text-sm font-medium text-texto">
                    Esta cuenta era un potencial
                  </p>
                  <p className="text-xs text-texto-secundario">
                    Nadie la había visitado ni contactado. Este es el momento de
                    decidir.
                  </p>
                </div>

                <Opciones
                  etiqueta="¿Sirve como prospecto?"
                  opciones={CLASIFICACION}
                  valor={clasificacion}
                  onCambio={(nueva) => {
                    setClasificacion(nueva);
                    if (nueva !== "descartada") setMotivoDescarte(null);
                    else if (motivoDescarte === null) setMotivoDescarte("otro");
                  }}
                />

                {seDescarta && (
                  <Opciones
                    etiqueta="¿Por qué se descarta?"
                    opciones={MOTIVOS_DESCARTE}
                    valor={motivoDescarte}
                    onCambio={setMotivoDescarte}
                    ayuda="No se borra: queda con su motivo para que otro no repita el viaje."
                  />
                )}
              </Tarjeta>
            )}

            {/* 5. El pedido, cuando la visita terminó en venta. Es el mejor
                resultado posible y hasta ahora no tenía dónde anotarse. */}
            {huboVenta && (
              <Tarjeta className="flex flex-col gap-4 border-green-200 bg-green-50">
                <div>
                  <p className="text-sm font-medium text-texto">El pedido</p>
                  <p className="text-xs text-texto-secundario">
                    Con esto la venta de la semana se ve sin esperar la factura.
                  </p>
                </div>

                <Campo
                  etiqueta="Qué se llevó"
                  required
                  value={pedidoDetalle}
                  onChange={(e) => setPedidoDetalle(e.target.value)}
                  ayuda="“4 cajas de rollos 80mm”."
                />

                <Campo
                  etiqueta="Cuánto"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={pedidoMonto}
                  onChange={(e) => setPedidoMonto(e.target.value)}
                />

                {/* Los dos caminos son reales y ninguno es el excepcional. */}
                <Opciones
                  etiqueta="¿Quién factura?"
                  opciones={RESUELVE}
                  valor={pedidoFactura}
                  onCambio={setPedidoFactura}
                  ayuda="Tu talonario, o la oficina si necesita factura fiscal."
                />

                {pedidoFactura === "yo" && (
                  <label className="min-h-tactil flex cursor-pointer items-center gap-2 text-sm text-texto">
                    <input
                      type="checkbox"
                      checked={entregado}
                      onChange={(e) => setEntregado(e.target.checked)}
                      className="size-5"
                    />
                    Se la dejé ahora
                  </label>
                )}

                {/* Solo si la factura la oficina y la cuenta no lo tiene:
                    es el único momento en que el RUC hace falta y el
                    cliente lo tiene a la mano. */}
                {pedidoFactura === "oficina" && !rucCuenta && (
                  <CampoRuc
                    valor={ruc}
                    onCambio={setRuc}
                    sinRuc={sinRuc}
                    onSinRuc={setSinRuc}
                    motivo="La oficina lo necesita para facturar, y sin él la factura no vuelve enganchada a esta cuenta."
                  />
                )}
              </Tarjeta>
            )}

            {/* 5b. La venta que va a tomar tiempo. Opcional, y el vendedor de
                ruta casi siempre la salta: si se resuelve en la próxima visita
                es un pedido, no una venta que haya que seguir. */}
            {puedeSerVentaLarga && (
              <Tarjeta className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium text-texto">
                    ¿Esta venta va a tomar tiempo?
                  </p>
                  <p className="text-xs text-texto-secundario">
                    Si vas a volver más de una vez por lo mismo, ábrela y le
                    hacemos seguimiento. Si se resuelve en la próxima visita, no
                    hace falta.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={abrirVenta}
                    onClick={() => setAbrirVenta(true)}
                    className={`min-h-tactil rounded-lg border px-3 text-sm ${
                      abrirVenta
                        ? "border-marca bg-marca text-white"
                        : "border-borde bg-superficie text-texto"
                    }`}
                  >
                    Abrir la venta
                  </button>
                  <button
                    type="button"
                    aria-pressed={!abrirVenta}
                    onClick={() => setAbrirVenta(false)}
                    className={`min-h-tactil rounded-lg border px-3 text-sm ${
                      !abrirVenta
                        ? "border-marca bg-marca text-white"
                        : "border-borde bg-superficie text-texto"
                    }`}
                  >
                    Se resuelve pronto
                  </button>
                </div>

                {abrirVenta && (
                  <>
                    <Campo
                      etiqueta="Nombre de la venta"
                      required
                      value={ventaNombre}
                      onChange={(e) => setVentaNombre(e.target.value)}
                      ayuda="“Rollos térmicos”, “Bolsas para la cafetería”."
                    />
                    <Campo
                      etiqueta="Monto estimado"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={ventaMonto}
                      onChange={(e) => setVentaMonto(e.target.value)}
                    />
                    {/* La fecha es lo que después dice cuándo entra la plata, y
                        de ella sale si es venta rápida o grande. */}
                    <Campo
                      etiqueta="Cuándo crees que cierra"
                      type="date"
                      min={hoyEnPanama()}
                      value={ventaCierre}
                      onChange={(e) => setVentaCierre(e.target.value)}
                      ayuda="Aproximado. Es lo que arma la proyección por mes."
                    />
                  </>
                )}
              </Tarjeta>
            )}

            {/* 6. Lo que se conversó. */}
            <Tarjeta>
              <Campo
                etiqueta="Notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                ayuda="Lo que no cabe en el resultado."
              />
            </Tarjeta>

            {/* 7. La ficha de competencia. Solo cuando el resultado implica
                que hay alguien más vendiéndole. */}
            {hayCompetencia && (
              <Tarjeta className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium text-texto">
                    ¿A quién le compra?
                  </p>
                  <p className="text-xs text-texto-secundario">
                    Nada de esto es obligatorio, y puedes terminarlo en el
                    carro. En seis meses es el mapa de quién domina cada zona y
                    por qué — y es tu munición para la próxima puerta.
                  </p>
                </div>

                <CampoCompetidor valor={proveedor} onCambio={setProveedor} />

                {/* Varias a la vez: casi nunca es una sola razón. Le compra al
                    paisano *y* le da crédito. */}
                <Opciones
                  etiqueta="¿Por qué le compra a ese?"
                  opciones={MOTIVOS_COMPETENCIA}
                  valor={motivosCompetencia}
                  multiple
                  onCambio={(motivo) =>
                    setMotivosCompetencia((antes) =>
                      antes.includes(motivo)
                        ? antes.filter((m) => m !== motivo)
                        : [...antes, motivo],
                    )
                  }
                />

                <Campo
                  etiqueta="Precio que paga hoy"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  ayuda="Si lo suelta. Es la mitad de la conversación de precio."
                />
              </Tarjeta>
            )}

            {/* 8. Evidencia. */}
            <Tarjeta className="flex flex-col gap-3">
              <label className="text-sm font-medium text-texto">Evidencia</label>
              <label className="min-h-tactil flex cursor-pointer items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto">
                <Camera size={18} aria-hidden />
                {foto ? foto.name : "Tomar foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </Tarjeta>

            {/* 9. El próximo paso, al final: es lo que deja la cuenta viva. */}
            <Tarjeta className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-texto">Próximo paso</p>
                <p className="text-xs text-texto-atenuado">
                  {exigeProximoPaso
                    ? "Obligatorio. Sin próximo paso la cuenta se apaga sin que nadie lo note."
                    : "Opcional con este resultado. Si lo llenas, necesita fecha."}
                </p>
              </div>

              <Campo
                etiqueta="Qué te comprometes a hacer"
                required={exigeProximoPaso}
                value={proximoPaso}
                onChange={(e) => setProximoPaso(e.target.value)}
              />
              <Campo
                etiqueta="Fecha del compromiso"
                type="date"
                required={exigeProximoPaso}
                min={hoyEnPanama()}
                value={fechaCompromiso}
                onChange={(e) => setFechaCompromiso(e.target.value)}
                ayuda={
                  exigeRecontacto
                    ? "Este resultado necesita fecha: es cuándo vuelves antes de que se le acabe el stock."
                    : undefined
                }
              />

              {/* Qué acción es, no solo qué dice el texto. Es lo que permite
                  después pedir "las llamadas de hoy" en vez de leer 40 frases. */}
              {empezoElPaso && (
                <Opciones
                  etiqueta="¿Qué vas a hacer?"
                  opciones={TIPOS_INTERACCION}
                  valor={accion}
                  onCambio={setAccion}
                />
              )}
            </Tarjeta>

            {error && (
              <MensajeError titulo="No se pudo guardar" detalle={error} />
            )}

            <Boton type="submit" ancho disabled={guardando || !listo}>
              {guardando ? "Guardando" : "Guardar seguimiento"}
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}
