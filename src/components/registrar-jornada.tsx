"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, X } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import {
  DURACIONES_JORNADA,
  TIPOS_JORNADA,
  type DuracionJornada,
  type TipoJornada,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

/**
 * Registrar en qué se fue el tiempo que no fue vender.
 *
 * **Esto es la coartada del vendedor, no un control.** Hoy la semana en que
 * hizo dos viajes a Natá se ve floja, y él lo sabe; la primera vez que un
 * tablero lo exponga injustamente pierde la confianza en la herramienta.
 *
 * Es la única captura de todo el sistema donde su interés y el de la empresa
 * apuntan al mismo lado, y por eso es la que se va a alimentar sola. La
 * pantalla lo dice con todas sus letras, porque el encuadre vale más que la
 * funcionalidad: presentada como control, se llena mal.
 *
 * Cuatro toques y quince segundos. Grueso a propósito: la pregunta de negocio
 * es si la logística se come el 30% o el 60% de la semana (§7.3), no una
 * planilla de nómina.
 */
export function RegistrarJornada() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoJornada | null>(null);
  const [duracion, setDuracion] = useState<DuracionJornada>("media");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [fecha, setFecha] = useState(hoyEnPanama());
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El viaje tiene origen y destino; una mañana de papeleo, no.
  const conRecorrido = tipo === "viaje_mercancia" || tipo === "entrega";

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!tipo) return;
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

    // El id se genera aquí, como todo lo demás: es lo que hace idempotente el
    // reintento cuando esto se registró manejando de vuelta y sin señal (§16).
    const { error: fallo } = await insertar(
      "jornadas",
      {
        id: crypto.randomUUID(),
        vendedor_id: user.id,
        fecha,
        tipo,
        duracion,
        desde_texto: conRecorrido ? desde.trim() || null : null,
        hasta_texto: conRecorrido ? hasta.trim() || null : null,
        notas: notas.trim() || null,
      },
      `Jornada del ${fecha}`,
    );

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    setAbierto(false);
    setTipo(null);
    setDuracion("media");
    setDesde("");
    setHasta("");
    setNotas("");
    setFecha(hoyEnPanama());
    setGuardando(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <Truck size={16} aria-hidden />
        Registrar jornada
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <Tarjeta className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-texto">
              ¿En qué se te fue el tiempo?
            </p>
            <p className="text-xs text-texto-secundario">
              Esto existe para que la semana en que hiciste dos viajes a Natá no
              se vea floja.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
            className="shrink-0 text-texto-atenuado"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <Opciones
          etiqueta="Qué fue"
          opciones={TIPOS_JORNADA}
          valor={tipo}
          onCambio={setTipo}
        />

        {tipo && (
          <>
            <Opciones
              etiqueta="Cuánto"
              opciones={DURACIONES_JORNADA}
              valor={duracion}
              onCambio={setDuracion}
            />

            {conRecorrido && (
              <div className="grid grid-cols-2 gap-2">
                <Campo
                  etiqueta="Desde"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  placeholder="Santiago"
                />
                <Campo
                  etiqueta="Hasta"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  placeholder="Natá"
                />
              </div>
            )}

            {/* Casi siempre es hoy, pero se registra de noche o a la mañana
                siguiente, y forzarlo a hoy convertiría el olvido en un dato
                falso. Hacia atrás nada más: no se agenda logística futura. */}
            <Campo
              etiqueta="Qué día fue"
              type="date"
              max={hoyEnPanama()}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />

            <Campo
              etiqueta="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              ayuda="Opcional."
            />
          </>
        )}

        {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

        <Boton type="submit" ancho disabled={guardando || !tipo}>
          {guardando ? "Guardando" : "Guardar"}
        </Boton>
      </Tarjeta>
    </form>
  );
}
