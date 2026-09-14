"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import {
  abrirCorreo,
  correoDeSolicitud,
  type DatosDeCuenta,
} from "@/lib/correo";
import {
  ATIENDE,
  PIDE_A_LA_OFICINA,
  RESUELVE,
  TIPOS_SOLICITUD,
  type PideALaOficina,
  type ResuelveSolicitud,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { DesdeQueCuenta } from "@/components/desde-que-cuenta";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

export default function NuevaSolicitud() {
  return (
    <Suspense fallback={<Cargando />}>
      <Formulario />
    </Suspense>
  );
}

/**
 * Pedir algo a la oficina, o anotar lo que va a resolver él mismo.
 *
 * Veinte segundos, y sale de su cabeza. Al guardar deja también el seguimiento
 * —una llamada con resultado "pide cotización"— sin que él lo escriba: una
 * acción, dos consecuencias. El encargo llega a la oficina y el contacto
 * cuenta para la cadencia del cliente.
 */
function Formulario() {
  const router = useRouter();
  const { id: cuentaId } = useParams<{ id: string }>();
  const oportunidadId = useSearchParams().get("oportunidad");

  const [nombreCuenta, setNombreCuenta] = useState("");
  /**
   * Lo que hace falta para escribir el correo, no para la pantalla.
   *
   * Se trae aquí y no al mandar, porque al mandar el vendedor ya está esperando y una consulta
   * más entre el toque y el correo se siente como que no pasó nada.
   */
  const [datosDelCorreo, setDatosDelCorreo] = useState<DatosDeCuenta | null>(null);
  const [quienSoy, setQuienSoy] = useState("");
  const [cargando, setCargando] = useState(true);

  const [tipo, setTipo] = useState<PideALaOficina | null>(null);
  const [resuelve, setResuelve] = useState<ResuelveSolicitud>("oficina");
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState("");
  const [paraCuando, setParaCuando] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = clienteNavegador();

    async function traer() {
      const { data } = await supabase
        .from("cuentas")
        .select("nombre, ruc, corregimiento, contacto_nombre, contacto_telefono")
        .eq("id", cuentaId)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        setNombreCuenta(data.nombre ?? "");
        setDatosDelCorreo({
          nombre: data.nombre ?? "",
          ruc: data.ruc,
          corregimiento: data.corregimiento,
          contactoNombre: data.contacto_nombre,
          contactoTelefono: data.contacto_telefono,
          url: `${window.location.origin}/cuentas/${cuentaId}`,
        });
      }

      // Quién firma el correo. El nombre, no el identificador: lo lee una persona.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre")
          .eq("id", user.id)
          .maybeSingle();
        setQuienSoy(perfil?.nombre ?? "");
      }

      setCargando(false);
    }

    traer();
  }, [cuentaId]);

  // El precio y las condiciones las decide gerencia; ahí no hay opción de
  // resolverlo uno mismo.
  const esDecisionDeArriba = tipo === "precio";

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!tipo || !detalle.trim()) return;
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

    const destino: ResuelveSolicitud = esDecisionDeArriba ? "oficina" : resuelve;

    const { error: fallo } = await insertar(
      "solicitudes",
      {
        id: crypto.randomUUID(),
        cuenta_id: cuentaId,
        oportunidad_id: oportunidadId,
        vendedor_id: user.id,
        tipo,
        resuelve: destino,
        detalle: detalle.trim(),
        monto_estimado: monto ? Number(monto) : null,
        para_cuando: paraCuando || null,
      },
      `${TIPOS_SOLICITUD[tipo]} de ${nombreCuenta}`,
    );

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    // Una acción, dos consecuencias: el encargo sale y el contacto queda en la
    // bitácora. Si fallara, el encargo ya está guardado y eso es lo urgente —
    // se avisa pero no se deshace.
    await insertar(
      "seguimientos",
      {
        id: crypto.randomUUID(),
        cuenta_id: cuentaId,
        vendedor_id: user.id,
        tipo: "llamada",
        resultado: tipo === "muestra" ? "pide_muestra" : "pide_cotizacion",
        notas: `${TIPOS_SOLICITUD[tipo]}: ${detalle.trim()}`,
        oportunidad_id: oportunidadId,
        sin_gps: false,
      },
      `Contacto con ${nombreCuenta}`,
    );

    // EL CORREO, que desde el 13 de septiembre de 2026 es como la oficina se entera (D-071).
    //
    // Va **después** de guardar y no antes: si abriera el correo primero y el guardado fallara,
    // el vendedor mandaría un encargo que el sistema no tiene. Y sólo cuando lo resuelve la
    // oficina — lo que él mismo va a hacer no le interesa a nadie más.
    if (destino === "oficina" && datosDelCorreo) {
      abrirCorreo(
        correoDeSolicitud({
          tipo,
          rotulo: TIPOS_SOLICITUD[tipo],
          cuenta: datosDelCorreo,
          vendedor: quienSoy,
          detalle: detalle.trim(),
          monto: monto ? Number(monto) : null,
          paraCuando: paraCuando || null,
        }),
      );
    }

    router.replace(`/cuentas/${cuentaId}`);
    router.refresh();
  }

  const listo = tipo !== null && detalle.trim() !== "";

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/${cuentaId}`} />
        <h1 className="text-lg font-semibold text-marca">Nueva solicitud</h1>
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

            <Tarjeta>
              {/* **Ya no se piden cotizaciones ni pedidos por aquí.** Los dos
                  nacen del documento —la cotización o la orden de venta que el
                  vendedor arma en el expediente—, porque ahí ya están los
                  renglones, las cantidades y el total. Pedirlos con un párrafo
                  de texto libre obligaba a que alguien en la oficina lo
                  volviera a escribir entero en Zoho.

                  Siguen existiendo como tipo de solicitud: se crean solos al
                  mandar el documento, y así conservan su reloj. */}
              <Opciones
                etiqueta="¿Qué necesita?"
                opciones={PIDE_A_LA_OFICINA}
                valor={tipo}
                onCambio={setTipo}
              />
              {tipo && (
                <p className="mt-2 text-xs text-texto-atenuado">
                  Lo atiende {ATIENDE[tipo]}.
                </p>
              )}
            </Tarjeta>

            {tipo && (
              <>
                {!esDecisionDeArriba && (
                  <Tarjeta>
                    <Opciones
                      etiqueta="¿Quién lo resuelve?"
                      opciones={RESUELVE}
                      valor={resuelve}
                      onCambio={setResuelve}
                      ayuda="Con tu talonario o libreta, o formal desde la oficina. Los dos quedan registrados."
                    />
                  </Tarjeta>
                )}

                <Tarjeta className="flex flex-col gap-4">
                  <Campo
                    etiqueta="Detalle"
                    required
                    value={detalle}
                    onChange={(e) => setDetalle(e.target.value)}
                    ayuda="Qué necesita, en sus palabras: “4 cajas de rollos 80mm”."
                  />
                  <Campo
                    etiqueta="Monto estimado"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    ayuda="Si lo sabes. Con esto la venta del mes se ve sin esperar la factura."
                  />
                  <Campo
                    etiqueta="Para cuándo lo necesita"
                    type="date"
                    min={hoyEnPanama()}
                    value={paraCuando}
                    onChange={(e) => setParaCuando(e.target.value)}
                  />
                </Tarjeta>

                <Tarjeta>
                  <p className="text-xs text-texto-secundario">
                    Queda también como llamada en la bitácora del cliente. No
                    hay que registrarlo aparte.
                  </p>
                </Tarjeta>
              </>
            )}


            {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

            {/* Sólo cuando de verdad va a salir un correo: lo que resuelve él mismo no le manda
                nada a nadie, y avisar ahí sería ruido. */}
            {(esDecisionDeArriba || resuelve === "oficina") && <DesdeQueCuenta />}

            <Boton type="submit" ancho disabled={guardando || !listo}>
              {guardando
                ? "Guardando"
                : esDecisionDeArriba || resuelve === "oficina"
                  ? "Enviar a la oficina"
                  : "Anotar como pendiente mío"}
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}
