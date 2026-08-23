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
  RESULTADO_VENTA,
  MOTIVOS_COMPETENCIA,
  MOTIVOS_DESCARTE,
  RESULTADOS,
  RESULTADOS_CON_COMPETENCIA,
  RESULTADOS_CON_RECONTACTO,
  RESULTADOS_TERMINALES,
  TIPOS_INTERACCION,
  type MotivoCompetencia,
  type MotivoDescarte,
  type Resultado,
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

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Panama",
  });
}

/**
 * Qué se hace con una cuenta que estaba sin clasificar.
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
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta | null>(null);
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
      .select("nombre, tipo")
      .eq("id", cuentaId)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNombreCuenta(data.nombre ?? "");
          setTipoCuenta(data.tipo as TipoCuenta);
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
  const hayQueClasificar = tipoCuenta === "sin_clasificar";
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

    // La cuenta sin clasificar se resuelve aquí, con el hecho a la vista, y no
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
          oportunidad_id: oportunidadId,
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

            {/* 4. Si la cuenta estaba sin clasificar, se resuelve aquí. */}
            {hayQueClasificar && (
              <Tarjeta className="flex flex-col gap-4 border-amber-200 bg-amber-50">
                <div>
                  <p className="text-sm font-medium text-texto">
                    Esta cuenta estaba sin clasificar
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

            {/* 5. Lo que se conversó. */}
            <Tarjeta>
              <Campo
                etiqueta="Notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                ayuda="Lo que no cabe en el resultado."
              />
            </Tarjeta>

            {/* 6. La ficha de competencia. Solo cuando el resultado implica
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

            {/* 7. Evidencia. */}
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

            {/* 8. El próximo paso, al final: es lo que deja la cuenta viva. */}
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
