"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { TIPOS_INTERACCION, type TipoInteraccion } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

/**
 * Programar un seguimiento: planificar, no registrar.
 *
 * Son dos actos distintos y hasta ahora estaban pegados. **Programar** es
 * decidir qué se va a hacer y cuándo; se hace sentado, mirando el mapa o la
 * cartera, y no afirma que haya pasado nada. **Registrar** es contar qué pasó
 * cuando ya pasó, con su check-in y su resultado.
 *
 * Tenerlos juntos obligaba a inventar un resultado para poder agendar una
 * visita futura, que es exactamente la clase de dato falso que este sistema
 * existe para no producir.
 *
 * Lo que se guarda aquí es un compromiso sin visita de origen —`visita_id` en
 * nulo— y aparece en Seguimientos junto a los que sí nacieron de una visita.
 */
export default function ProgramarSeguimiento() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(true);

  const [descripcion, setDescripcion] = useState("");
  const [accion, setAccion] = useState<TipoInteraccion>("visita");
  const [fecha, setFecha] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("cuentas")
      .select("nombre")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNombre(data.nombre ?? "");
        setCargando(false);
      });
  }, [id]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!descripcion.trim() || !fecha) return;

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

    const { error: fallo } = await supabase.from("compromisos").insert({
      id: crypto.randomUUID(),
      cuenta_id: id,
      // Nace de una decisión de planificación, no de una visita.
      visita_id: null,
      vendedor_id: user.id,
      descripcion: descripcion.trim(),
      fecha_compromiso: fecha,
      tipo_accion: accion,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/cuentas/${id}`);
    router.refresh();
  }

  const listo = descripcion.trim() !== "" && fecha !== "";

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/${id}`} />
        <h1 className="text-lg font-semibold text-marca">
          Programar seguimiento
        </h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {cargando && <Cargando />}

        {!cargando && (
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <Tarjeta>
              <p className="text-xs text-texto-secundario">Cuenta</p>
              <p className="text-base font-semibold text-texto">{nombre}</p>
              <p className="mt-1 text-xs text-texto-atenuado">
                Esto agenda lo que vas a hacer. Cuando lo hagas, lo registras
                desde Seguimientos y ahí cuentas cómo fue.
              </p>
            </Tarjeta>

            <Tarjeta>
              <Opciones
                etiqueta="¿Qué vas a hacer?"
                opciones={TIPOS_INTERACCION}
                valor={accion}
                onCambio={setAccion}
              />
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-4">
              <Campo
                etiqueta="Qué te comprometes a hacer"
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                ayuda="Concreto: “llevar cotización de rollos”, no “dar seguimiento”."
              />
              <Campo
                etiqueta="¿Cuándo?"
                type="date"
                required
                min={hoyEnPanama()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Tarjeta>

            {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

            <Boton type="submit" ancho disabled={guardando || !listo}>
              {guardando ? "Guardando" : "Programar"}
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}
