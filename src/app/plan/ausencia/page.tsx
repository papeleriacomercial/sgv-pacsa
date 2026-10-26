"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import { MOTIVOS_AUSENCIA, type MotivoAusencia } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

/**
 * Marcar los días que no se trabaja — docs/18-plan-diario.md §6.
 *
 * **Dos caminos en una sola pantalla.** «Hoy no voy a trabajar» es un toque y
 * resuelve el caso urgente —amanecer indispuesto— sin pedir fechas. Las
 * vacaciones piden el rango, porque se saben con anticipación y es justo lo que
 * el usuario quería: *«para efecto de que ya la aplicación sepa de antemano los
 * días que una persona no va a ingresar planes»*.
 *
 * Gerencia y el líder pueden registrarla por otro, y hacia atrás. El vendedor,
 * la suya y de hoy en adelante — la base lo impone, no sólo esta pantalla.
 */

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

type Persona = { id: string; nombre: string };
type Fila = {
  id: string;
  vendedor_id: string;
  desde: string;
  hasta: string;
  motivo: MotivoAusencia;
  nota: string | null;
};

export default function MarcarAusencia() {
  const router = useRouter();
  const supabase = clienteNavegador();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [yoId, setYoId] = useState<string | null>(null);
  const [supervisa, setSupervisa] = useState(false);
  const [gente, setGente] = useState<Persona[]>([]);
  const [registradas, setRegistradas] = useState<Fila[]>([]);

  const [deQuien, setDeQuien] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoAusencia | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");

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

      const [{ data: quien }, { data: equipo }, { data: filas }] = await Promise.all([
        supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle(),
        supabase
          .from("perfiles")
          .select("id, nombre")
          .is("deleted_at", null)
          .eq("activo", true)
          .neq("rol", "gerente")
          .order("nombre"),
        supabase
          .from("ausencias")
          .select("id, vendedor_id, desde, hasta, motivo, nota")
          .is("deleted_at", null)
          .gte("hasta", hoy)
          .order("desde"),
      ]);

      if (!vivo) return;

      const puede = quien?.rol === "gerente" || quien?.rol === "lider";
      setYoId(user.id);
      setSupervisa(puede);
      setGente((equipo ?? []) as Persona[]);
      setRegistradas((filas ?? []) as Fila[]);
      setDeQuien(user.id);
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

  const nombreDe = useMemo(
    () => new Map(gente.map((p) => [p.id, p.nombre])),
    [gente],
  );

  const opcionesDeGente = useMemo(
    () => Object.fromEntries(gente.map((p) => [p.id, p.nombre])) as Record<string, string>,
    [gente],
  );

  async function guardar(unDia: boolean) {
    if (!deQuien || guardando) return;
    const d = unDia ? hoy : desde;
    const h = unDia ? hoy : hasta || desde;
    const m: MotivoAusencia = unDia ? (motivo ?? "incapacidad") : (motivo as MotivoAusencia);

    if (!d || !m) {
      setError("Falta la fecha o el motivo.");
      return;
    }
    if (h < d) {
      setError("El último día no puede ser antes del primero.");
      return;
    }
    if (m === "otro" && nota.trim() === "") {
      setError("Si el motivo es otra razón, cuenta cuál.");
      return;
    }

    setGuardando(true);
    setError(null);

    const { error: fallo } = await insertar(
      "ausencias",
      {
        id: crypto.randomUUID(),
        vendedor_id: deQuien,
        desde: d,
        hasta: h,
        motivo: m,
        nota: nota.trim() || null,
      },
      "Tus días sin trabajar",
    );

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    router.replace("/");
  }

  async function cancelar(id: string) {
    const { error: fallo } = await supabase.from("ausencias").delete().eq("id", id);
    if (fallo) {
      setError(fallo.message);
      return;
    }
    setRegistradas((previo) => previo.filter((f) => f.id !== id));
  }

  if (cargando) return <Cargando />;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-28">
      <BotonVolver />

      <div className="flex items-center gap-2">
        <CalendarOff size={20} className="text-marca" aria-hidden />
        <h1 className="text-lg font-semibold text-marca">Días sin trabajar</h1>
      </div>

      <AvisoSinConexion />
      {error ? <MensajeError detalle={error} /> : null}

      {/* ------------------------------------------------------------------
          El caso urgente, de un toque.

          **Va primero y sin pedir fechas** porque es el que ocurre a las siete
          de la mañana con el teléfono en la mano: amanecer indispuesto. Pedirle
          un rango a alguien que se siente mal es pedirle que no lo marque.
          ------------------------------------------------------------------ */}
      {deQuien === yoId ? (
        <Tarjeta className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-texto">Hoy no voy a trabajar</h2>
          <p className="text-sm text-texto-secundario">
            Queda marcado como que hoy no trabajaste, y el día no se te cuenta
            como falta de plan.
          </p>

          <Opciones
            etiqueta="¿Por qué?"
            opciones={MOTIVOS_AUSENCIA}
            valor={motivo}
            onCambio={(m) => setMotivo(m)}
          />

          {motivo === "otro" ? (
            <Campo
              etiqueta="Cuenta cuál"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          ) : null}

          <Boton
            onClick={() => guardar(true)}
            ancho
            disabled={guardando || !motivo}
          >
            {guardando ? "Guardando…" : "Marcar sólo hoy"}
          </Boton>
        </Tarjeta>
      ) : null}

      {/* ------------------------------------------------------------------
          Y el rango, para las vacaciones.
          ------------------------------------------------------------------ */}
      <Tarjeta className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-texto">
          {deQuien === yoId ? "Varios días" : "Registrar unos días"}
        </h2>

        {supervisa && gente.length > 1 ? (
          <Opciones
            etiqueta="¿De quién?"
            opciones={opcionesDeGente}
            valor={deQuien}
            onCambio={(id) => setDeQuien(id)}
          />
        ) : null}

        <Opciones
          etiqueta="¿Por qué?"
          opciones={MOTIVOS_AUSENCIA}
          valor={motivo}
          onCambio={(m) => setMotivo(m)}
        />

        <Campo
          etiqueta="Primer día"
          type="date"
          min={supervisa ? undefined : hoy}
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />

        <Campo
          etiqueta="Último día"
          ayuda="Inclusive. Si es un solo día, repite la misma fecha."
          type="date"
          min={desde || (supervisa ? undefined : hoy)}
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />

        {motivo === "otro" ? (
          <Campo
            etiqueta="Cuenta cuál"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        ) : null}

        <Boton
          onClick={() => guardar(false)}
          ancho
          disabled={guardando || !motivo || !desde}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>

        {!supervisa ? (
          <p className="text-xs text-texto-atenuado">
            Si fue un día que ya pasó, pídele a gerencia que lo registre: desde
            acá sólo se puede de hoy en adelante.
          </p>
        ) : null}
      </Tarjeta>

      {/* ------------------------------------------------------------------
          Lo ya registrado, para poder cancelarlo si cambian los planes.
          ------------------------------------------------------------------ */}
      {registradas.length > 0 ? (
        <Tarjeta className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Lo que viene</h2>

          {registradas.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-sm text-texto">
                  {f.desde === f.hasta
                    ? f.desde
                    : `${f.desde} al ${f.hasta}`}
                  {f.vendedor_id !== yoId
                    ? ` · ${nombreDe.get(f.vendedor_id) ?? ""}`
                    : ""}
                </p>
                <p className="text-xs text-texto-atenuado">
                  {MOTIVOS_AUSENCIA[f.motivo]}
                  {f.nota ? ` · ${f.nota}` : ""}
                </p>
              </div>

              {/* **Sólo se cancela lo que todavía no empezó.** Borrar un día ya
                  transcurrido volvería a convertirlo en falta, y eso ya se
                  reportó como libre. La base lo impide igual. */}
              {f.desde > hoy || supervisa ? (
                <button
                  type="button"
                  onClick={() => cancelar(f.id)}
                  className="min-h-tactil flex items-center gap-1 px-2 text-sm text-error"
                >
                  <Trash2 size={16} aria-hidden /> Cancelar
                </button>
              ) : (
                <Insignia tono="neutro">En curso</Insignia>
              )}
            </div>
          ))}
        </Tarjeta>
      ) : null}
    </main>
  );
}
