"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX } from "lucide-react";
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

function manana() {
  const d = new Date(`${hoyEnPanama()}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
}

/**
 * El día se cayó: mover lo de la calle en bloque.
 *
 * Sale un pedido urgente, cierran las calles, se daña el carro. **Eso no es
 * incumplir el plan: es replanificar, y es lo que hace un vendedor que
 * piensa.**
 *
 * Se mueve en bloque y no uno por uno porque hacerlo cinco veces es
 * exactamente la fricción que hace que no se haga — y entonces la agenda queda
 * llena de vencidos falsos y deja de significar algo.
 *
 * Y el motivo se pregunta aquí mismo: **cambiar el plan y decir por qué son el
 * mismo gesto**, no dos pantallas. Si además perdió el día entero, se registra
 * como jornada — mover el plan no gasta un día, perderlo sí, y esa es la
 * diferencia que decide si la semana tuvo tres días vendibles o cinco.
 */
export function CambiarElDia({
  ids,
  cuantos,
}: {
  /** Los compromisos de calle que vencen hoy o antes. */
  ids: string[];
  cuantos: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(manana());
  const [perdioElDia, setPerdioElDia] = useState(false);
  const [tipo, setTipo] = useState<TipoJornada>("no_pudo_salir");
  const [duracion, setDuracion] = useState<DuracionJornada>("completa");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mover() {
    if (!fecha) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Se cerró la sesión. Vuelve a entrar.");
      setGuardando(false);
      return;
    }

    // El trigger de la base cuenta cada empujón, uno por compromiso.
    const { error: fallo } = await supabase
      .from("compromisos")
      .update({ fecha_compromiso: fecha })
      .in("id", ids);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    if (perdioElDia) {
      const { error: falloJornada } = await insertar(
        "jornadas",
        {
          id: crypto.randomUUID(),
          vendedor_id: user.id,
          fecha: hoyEnPanama(),
          tipo,
          duracion,
        },
        "Día que se cayó",
      );

      if (falloJornada) {
        setError(
          `Los compromisos se movieron, pero la jornada no: ${falloJornada}`,
        );
        setGuardando(false);
        return;
      }
    }

    setAbierto(false);
    setPerdioElDia(false);
    setGuardando(false);
    router.refresh();
  }

  if (cuantos === 0) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <CalendarX size={16} aria-hidden />
        Hoy no voy a salir
      </button>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-texto">
          Mover lo de la calle a otro día
        </p>
        <p className="text-xs text-texto-secundario">
          {cuantos} {cuantos === 1 ? "parada" : "paradas"} se mueven de una vez.
          Las llamadas se quedan: esas se hacen desde donde sea.
        </p>
      </div>

      <Campo
        etiqueta="¿Para qué día?"
        type="date"
        min={hoyEnPanama()}
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
      />

      {/* Mover el plan no gasta un día; perderlo sí. La diferencia es lo que
          decide si la semana tuvo tres días vendibles o cinco. */}
      <label className="min-h-tactil flex cursor-pointer items-center gap-2 text-sm text-texto">
        <input
          type="checkbox"
          checked={perdioElDia}
          onChange={(e) => setPerdioElDia(e.target.checked)}
          className="size-5"
        />
        Perdí el día completo
      </label>

      {perdioElDia && (
        <>
          <Opciones
            etiqueta="¿Qué pasó?"
            opciones={TIPOS_JORNADA}
            valor={tipo}
            onCambio={setTipo}
          />
          <Opciones
            etiqueta="Cuánto"
            opciones={DURACIONES_JORNADA}
            valor={duracion}
            onCambio={setDuracion}
          />
        </>
      )}

      {error && <MensajeError titulo="No se pudo mover" detalle={error} />}

      <div className="grid grid-cols-2 gap-2">
        <Boton tono="secundario" ancho onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
        <Boton ancho disabled={guardando} onClick={mover}>
          {guardando ? "Moviendo" : "Mover"}
        </Boton>
      </div>

      <p className="text-xs text-texto-atenuado">
        Tu apuesta de la semana no cambia. Cambió el orden, no el compromiso.
      </p>
    </Tarjeta>
  );
}
