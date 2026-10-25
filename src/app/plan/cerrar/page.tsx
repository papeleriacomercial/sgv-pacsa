"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MoonStar } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { actualizar } from "@/lib/cola";
import {
  MOTIVOS_INCUMPLIDO,
  TIPOS_ACCION_PLAN,
  UNIDAD_DE_ACCION,
  type MotivoIncumplido,
  type TipoAccionPlan,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";
import {
  CierresDelDia,
  guardarCierres,
  type CierreListo,
} from "@/components/cierres-del-dia";
import { faltaDeLaRendicion, loQueQuedaDebiendo } from "@/lib/plan";

/**
 * Cerrar el día — docs/18-plan-diario.md §4.3.
 *
 * **Un toque por línea.** Si cerrar el día toma diez minutos, muere en una
 * semana — y eso es exactamente lo que le pasó al cierre semanal, que pedía
 * tres párrafos y terminaba lleno de frases puestas por salir del paso.
 *
 * Lo que no se cumplió **cae solo en el plan de mañana**. Ahí está la secuencia
 * que el usuario pedía —«qué van a hacer con aquellas metas que no se
 * cumplieron, cómo la van a rescatar»— pero diaria en vez de semanal, y sin que
 * nadie tenga que redactar nada.
 */

type Accion = {
  id: string;
  orden: number;
  tipo: TipoAccionPlan;
  meta: number;
  logrado: number | null;
  /** Lo que el sistema ya sabe. Nulo cuando de eso no hay registro. */
  automatico: number | null;
};

/** La rendición de una acción, más la casilla de arrastre, que es sólo de esta pantalla. */
type Rendicion = {
  hizo: string;
  motivo: MotivoIncumplido | null;
  motivoOtro: string;
  pasar: boolean;
};

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Panama",
  });
}

export default function CerrarElDia() {
  const router = useRouter();
  const supabase = clienteNavegador();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [yoId, setYoId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [rendiciones, setRendiciones] = useState<Record<string, Rendicion>>({});
  const [seguimientos, setSeguimientos] = useState({
    pendientes: 0,
    despachados: 0,
  });

  // Lo que cerró hoy, que sube desde el bloque de cierres. **No se guarda ahí
  // sino en el mismo botón de cerrar el día**: dos botones de guardar en la
  // misma pantalla es la receta de que alguien apriete el segundo y pierda el
  // primero.
  const [cierres, setCierres] = useState<CierreListo[]>([]);

  const hoy = useMemo(() => hoyEnPanama(), []);

  useEffect(() => {
    let vivo = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/entrar");
        return;
      }

      const { data: plan } = await supabase
        .from("planes_diarios")
        .select(
          "id, cerrado_en, plan_acciones(id, orden, tipo, meta, logrado)",
        )
        .eq("vendedor_id", user.id)
        .eq("fecha", hoy)
        .is("deleted_at", null)
        .maybeSingle();

      // Sin plan no hay nada que cerrar, y un día ya cerrado no se reabre: la
      // base lo impide, así que llegar hasta el botón sería un mal rato.
      if (!plan || (plan as { cerrado_en: string | null }).cerrado_en) {
        router.replace("/");
        return;
      }

      const desde = `${hoy}T00:00:00-05:00`;
      const hasta = `${hoy}T23:59:59.999-05:00`;

      const [llamadas, visitas, cotiz, pend, desp] = await Promise.all([
        supabase
          .from("seguimientos")
          .select("id", { count: "exact", head: true })
          .eq("vendedor_id", user.id)
          .eq("tipo", "llamada")
          .is("deleted_at", null)
          .gte("fecha", desde)
          .lte("fecha", hasta),
        supabase
          .from("seguimientos")
          .select("id", { count: "exact", head: true })
          .eq("vendedor_id", user.id)
          .eq("tipo", "visita")
          .is("deleted_at", null)
          .gte("fecha", desde)
          .lte("fecha", hasta),
        supabase
          .from("cotizaciones")
          .select("id", { count: "exact", head: true })
          .eq("vendedor_id", user.id)
          .is("deleted_at", null)
          .gte("emitida_en", desde)
          .lte("emitida_en", hasta),
        supabase
          .from("compromisos")
          .select("id", { count: "exact", head: true })
          .eq("vendedor_id", user.id)
          .is("deleted_at", null)
          .is("cumplido_en", null)
          .lte("fecha_compromiso", hoy),
        supabase
          .from("compromisos")
          .select("id", { count: "exact", head: true })
          .eq("vendedor_id", user.id)
          .is("deleted_at", null)
          .gte("cumplido_en", desde)
          .lte("cumplido_en", hasta),
      ]);

      if (!vivo) return;

      function automatico(tipo: TipoAccionPlan): number | null {
        if (tipo === "llamar_frio") return llamadas.count ?? 0;
        if (tipo === "visitar") return visitas.count ?? 0;
        if (tipo === "entregar_cotizacion") return cotiz.count ?? 0;
        return null;
      }

      const crudas = ((plan as Record<string, unknown>).plan_acciones ??
        []) as {
        id: string;
        orden: number;
        tipo: TipoAccionPlan;
        meta: number;
        logrado: number | null;
      }[];

      const lista = crudas
        .map((a) => ({ ...a, automatico: automatico(a.tipo) }))
        .sort((a, b) => a.orden - b.orden);

      setYoId(user.id);
      setPlanId(String((plan as { id: string }).id));
      setAcciones(lista);
      setSeguimientos({
        pendientes: pend.count ?? 0,
        despachados: desp.count ?? 0,
      });

      // **Se precarga lo que el sistema ya sabe.** El vendedor confirma en vez
      // de teclear: si visitó, la visita ya está registrada. Lo único que se
      // teclea de verdad son el reparto y el cobro, que no dejan rastro en
      // ninguna tabla.
      setRendiciones(
        Object.fromEntries(
          lista.map((a) => [
            a.id,
            {
              hizo: a.automatico == null ? "" : String(a.automatico),
              motivo: null,
              motivoOtro: "",
              pasar: false,
            } as Rendicion,
          ]),
        ),
      );
      setCargando(false);
    })().catch((e) => {
      if (vivo) {
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
        setCargando(false);
      }
    });

    return () => {
      vivo = false;
    };
  }, [hoy, router, supabase]);

  function cambiar(id: string, parche: Partial<Rendicion>) {
    setRendiciones((previo) => ({
      ...previo,
      [id]: { ...previo[id], ...parche },
    }));
  }

  /**
   * Qué le falta al cierre, dicho con palabras.
   *
   * **La regla vive en `plan.ts` y no acá**, porque es la que las pruebas
   * ejercitan y la que la base repite como restricción. Escrita en la pantalla
   * quedaría vieja el día que cambie en los otros dos sitios.
   */
  const falta = acciones
    .map((a) => faltaDeLaRendicion(rendiciones[a.id], a.meta))
    .find((f) => f !== null);

  async function cerrar() {
    if (!planId || !yoId || guardando || falta) return;
    setGuardando(true);
    setError(null);

    // **Los cierres van primero**, antes de marcar el día cerrado. Si algo
    // falla, el día queda abierto y el vendedor puede volver a intentarlo; al
    // revés, el día quedaría cerrado y su venta perdida.
    const falloCierre = await guardarCierres(yoId, hoy, cierres);
    if (falloCierre) {
      setError(falloCierre);
      setGuardando(false);
      return;
    }

    for (const a of acciones) {
      const r = rendiciones[a.id];
      const hizo = Number(r.hizo);
      const cumplida = hizo >= a.meta;

      const { error: fallo } = await actualizar(
        "plan_acciones",
        a.id,
        {
          logrado: hizo,
          motivo: cumplida ? null : r.motivo,
          motivo_otro:
            !cumplida && r.motivo === "otra_cosa"
              ? r.motivoOtro.trim()
              : null,
          pasar_a_manana: cumplida ? false : r.pasar,
        },
        `Lo que hiciste de ${TIPOS_ACCION_PLAN[a.tipo]}`,
      );

      if (fallo) {
        setError(fallo);
        setGuardando(false);
        return;
      }
    }

    const { error: fallo } = await actualizar(
      "planes_diarios",
      planId,
      { cerrado_en: new Date().toISOString() },
      "El cierre de tu día",
    );

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    router.replace("/");
  }

  if (cargando) return <Cargando />;

  const total = seguimientos.pendientes + seguimientos.despachados;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-28">
      <BotonVolver />

      <div className="flex items-center gap-2">
        <MoonStar size={20} className="text-marca" aria-hidden />
        <h1 className="text-lg font-semibold text-marca">Cerrar mi día</h1>
      </div>

      <AvisoSinConexion />
      {error ? <MensajeError detalle={error} /> : null}

      {/* Los seguimientos no se rinden a mano: el sistema ya sabe cuántos
          despachaste, porque cada uno se cierra donde se hace. */}
      {total > 0 ? (
        <Tarjeta className="flex items-center justify-between gap-2">
          <span className="text-sm text-texto">Seguimientos</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm text-texto">
              {seguimientos.despachados} de {total}
            </span>
            {seguimientos.pendientes === 0 ? (
              <CheckCircle2 size={18} className="text-ok" aria-hidden />
            ) : (
              <Insignia tono="aviso">
                {`${seguimientos.pendientes} sin despachar`}
              </Insignia>
            )}
          </span>
        </Tarjeta>
      ) : null}

      {/* **Lo que vendió, antes de lo que prometió.** Es lo que el vendedor
          quiere contar al final del día, y ponerlo primero hace que el cierre
          se sienta como rendir una venta y no como rendir un examen. */}
      {yoId ? (
        <CierresDelDia
          vendedorId={yoId}
          hoy={hoy}
          onCambio={(listos) => setCierres(listos)}
        />
      ) : null}

      {acciones.map((a) => {
        const r = rendiciones[a.id];
        if (!r) return null;
        const hizo = Number(r.hizo);
        const cumplida = r.hizo !== "" && hizo >= a.meta;

        return (
          <Tarjeta key={a.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-texto">
                {a.orden} · {TIPOS_ACCION_PLAN[a.tipo]}
              </span>
              <span className="font-mono text-sm text-texto-secundario">
                meta {a.meta}
              </span>
            </div>

            <Campo
              etiqueta={`¿Cuántas ${UNIDAD_DE_ACCION[a.tipo]} hiciste?`}
              ayuda={
                a.automatico == null
                  ? "Esto no deja rastro en el sistema, así que lo dices tú."
                  : "Lo contó el sistema con lo que registraste. Corrígelo si hace falta."
              }
              type="number"
              inputMode="numeric"
              min={0}
              value={r.hizo}
              onChange={(e) => cambiar(a.id, { hizo: e.target.value })}
            />

            {cumplida ? (
              <p className="flex items-center gap-2 text-sm text-ok">
                <CheckCircle2 size={16} aria-hidden /> Cumplida
              </p>
            ) : r.hizo === "" ? null : (
              <>
                <Opciones
                  etiqueta="¿Qué pasó?"
                  opciones={MOTIVOS_INCUMPLIDO}
                  valor={r.motivo}
                  onCambio={(motivo) => cambiar(a.id, { motivo })}
                />

                {r.motivo === "otra_cosa" ? (
                  <Campo
                    etiqueta="Cuenta qué pasó"
                    value={r.motivoOtro}
                    onChange={(e) =>
                      cambiar(a.id, { motivoOtro: e.target.value })
                    }
                  />
                ) : null}

                <label className="min-h-tactil flex items-center gap-3 text-sm text-texto">
                  <input
                    type="checkbox"
                    checked={r.pasar}
                    onChange={(e) => cambiar(a.id, { pasar: e.target.checked })}
                    className="size-5 accent-[var(--color-marca)]"
                  />
                  Pasar {loQueQuedaDebiendo(a.meta, hizo || 0)} a mañana
                </label>
              </>
            )}
          </Tarjeta>
        );
      })}

      <Boton onClick={cerrar} ancho disabled={guardando || !!falta}>
        {guardando ? "Cerrando…" : "Cerrar el día"}
      </Boton>

      {falta ? (
        <p className="text-center text-xs text-texto-atenuado">{falta}</p>
      ) : null}
    </main>
  );
}
