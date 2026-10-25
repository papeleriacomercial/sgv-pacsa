"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import {
  TIPOS_ACCION_PLAN,
  TOPE_ACCIONES,
  UNIDAD_DE_ACCION,
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

/**
 * Armar el día — docs/18-plan-diario.md §4.2.
 *
 * Tres pasos y **ningún campo de texto hasta el final**: los seguimientos ya
 * están, las acciones se escogen de un catálogo cerrado, y la nota —que sí es
 * libre— va colgada de una cuenta real.
 *
 * El objetivo son dos minutos. Todo lo que lo alargue hay que quitarlo: un
 * ritual que cuesta diez minutos muere en una semana, y entonces volvemos al
 * contrato semanal que nadie llenaba.
 */

/** Lo que el vendedor arma antes de guardar. Vive en el navegador, no en la base. */
type Borrador = {
  clave: number;
  tipo: TipoAccionPlan | null;
  listaId: string | null;
  cuentas: string[];
  meta: string;
};

type ListaConCuentas = { id: string; nombre: string; total: number };
type CuentaDeLista = { id: string; nombre: string };

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Panama",
  });
}

export default function ArmarElDia() {
  const router = useRouter();
  const supabase = clienteNavegador();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [yoId, setYoId] = useState<string | null>(null);
  const [seguimientos, setSeguimientos] = useState(0);
  const [vencidos, setVencidos] = useState(0);
  const [listas, setListas] = useState<ListaConCuentas[]>([]);

  const [acciones, setAcciones] = useState<Borrador[]>([]);
  const [cuentasPorLista, setCuentasPorLista] = useState<
    Record<string, CuentaDeLista[]>
  >({});

  const [nota, setNota] = useState("");
  const [notaCuenta, setNotaCuenta] = useState<string | null>(null);
  const [misCuentas, setMisCuentas] = useState<CuentaDeLista[]>([]);

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

      // **Si ya armó el día, no se arma otra vez.** La base lo impide con su
      // llave única, pero llegar hasta el final para que falle al guardar es un
      // mal rato evitable.
      const { data: yaHay } = await supabase
        .from("planes_diarios")
        .select("id")
        .eq("vendedor_id", user.id)
        .eq("fecha", hoy)
        .is("deleted_at", null)
        .maybeSingle();

      if (yaHay) {
        router.replace("/");
        return;
      }

      const [pend, venc, lis, cuentas] = await Promise.all([
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
          .is("cumplido_en", null)
          .lt("fecha_compromiso", hoy),
        supabase
          .from("listas")
          .select("id, nombre, listas_cuentas(count)")
          .eq("vendedor_id", user.id)
          .eq("archivada", false)
          .is("deleted_at", null)
          .order("nombre"),
        supabase
          .from("cuentas")
          .select("id, nombre")
          .eq("vendedor_id", user.id)
          .is("deleted_at", null)
          .order("nombre")
          .limit(500),
      ]);

      if (!vivo) return;

      setYoId(user.id);
      setSeguimientos(pend.count ?? 0);
      setVencidos(venc.count ?? 0);
      setListas(
        ((lis.data ?? []) as Record<string, unknown>[]).map((l) => ({
          id: String(l.id),
          nombre: String(l.nombre),
          total: Number(
            (l.listas_cuentas as { count: number }[] | null)?.[0]?.count ?? 0,
          ),
        })),
      );
      setMisCuentas((cuentas.data ?? []) as CuentaDeLista[]);
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

  /** Las cuentas de una lista, pedidas sólo cuando se escoge. */
  async function cargarCuentasDe(listaId: string) {
    if (cuentasPorLista[listaId]) return;
    const { data } = await supabase
      .from("listas_cuentas")
      .select("cuentas(id, nombre)")
      .eq("lista_id", listaId)
      .limit(200);

    const cuentas = ((data ?? []) as Record<string, unknown>[])
      .map((f) => {
        const c = f.cuentas as CuentaDeLista | CuentaDeLista[] | null;
        return Array.isArray(c) ? c[0] : c;
      })
      .filter((c): c is CuentaDeLista => !!c)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    setCuentasPorLista((previo) => ({ ...previo, [listaId]: cuentas }));
  }

  function agregar() {
    if (acciones.length >= TOPE_ACCIONES) return;
    setAcciones((previo) => [
      ...previo,
      { clave: Date.now(), tipo: null, listaId: null, cuentas: [], meta: "" },
    ]);
  }

  function cambiar(clave: number, parche: Partial<Borrador>) {
    setAcciones((previo) =>
      previo.map((a) => (a.clave === clave ? { ...a, ...parche } : a)),
    );
  }

  const listasPorId = useMemo(
    () => Object.fromEntries(listas.map((l) => [l.id, l])),
    [listas],
  );

  const opcionesDeLista = useMemo(
    () =>
      Object.fromEntries(
        listas.map((l) => [l.id, `${l.nombre} · ${l.total} cuentas`]),
      ) as Record<string, string>,
    [listas],
  );

  const opcionesDeCuenta = useMemo(
    () =>
      Object.fromEntries(misCuentas.map((c) => [c.id, c.nombre])) as Record<
        string,
        string
      >,
    [misCuentas],
  );

  const listas_ok = acciones.every(
    (a) => a.tipo !== null && Number(a.meta) > 0,
  );

  async function guardar() {
    if (!yoId || guardando) return;
    setGuardando(true);
    setError(null);

    // **Los identificadores se generan acá, como todo en esta aplicación.** Es
    // lo que vuelve idempotente un reintento de la cola: si la primera vez sí
    // llegó, la segunda choca contra la llave primaria y se descarta sin
    // duplicar nada.
    const planId = crypto.randomUUID();

    const { error: falloPlan } = await insertar(
      "planes_diarios",
      {
        id: planId,
        vendedor_id: yoId,
        fecha: hoy,
        nota: nota.trim() || null,
        nota_cuenta_id: nota.trim() ? notaCuenta : null,
      },
      "El plan de hoy",
    );

    if (falloPlan) {
      setError(falloPlan);
      setGuardando(false);
      return;
    }

    // **El orden importa y la cola lo respeta.** Las acciones apuntan al plan,
    // así que si el plan todavía está esperando señal, éstas esperan detrás y
    // llegan después — nunca antes.
    let puesto = 0;
    for (const a of acciones) {
      if (!a.tipo) continue;
      puesto += 1;
      const accionId = crypto.randomUUID();

      const { error: fallo } = await insertar(
        "plan_acciones",
        {
          id: accionId,
          plan_id: planId,
          orden: puesto,
          tipo: a.tipo,
          lista_id: a.listaId,
          meta: Number(a.meta),
        },
        `Acción ${puesto}: ${TIPOS_ACCION_PLAN[a.tipo]}`,
      );
      if (fallo) {
        setError(fallo);
        setGuardando(false);
        return;
      }

      for (const cuentaId of a.cuentas) {
        await insertar(
          "plan_accion_cuentas",
          { accion_id: accionId, cuenta_id: cuentaId },
          "Una cuenta del plan",
        );
      }
    }

    router.replace("/");
  }

  if (cargando) return <Cargando />;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-28">
      <BotonVolver />

      <div className="flex items-center gap-2">
        <CalendarCheck size={20} className="text-marca" aria-hidden />
        <h1 className="text-lg font-semibold text-marca">Armar mi día</h1>
      </div>

      <AvisoSinConexion />
      {error ? <MensajeError detalle={error} /> : null}

      {/* ------------------------------------------------------------------
          1. Los seguimientos. No se escogen: se imponen.

          **Aparecen armados y no se pueden saltar.** La razón es aritmética:
          una oportunidad abierta convierte mucho mejor que un contacto frío,
          así que prospectar con el embudo sucio es trabajar por lo más caro.
          ------------------------------------------------------------------ */}
      <Tarjeta className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-texto">
            1 · Tus seguimientos
          </h2>
          <Insignia tono={seguimientos > 0 ? "info" : "ok"}>
            {String(seguimientos)}
          </Insignia>
        </div>

        <p className="text-sm text-texto-secundario">
          {seguimientos === 0
            ? "Hoy no tienes seguimientos vencidos ni para hoy."
            : `Ya están, no hace falta elegir.${vencidos > 0 ? ` ${vencidos} vencido${vencidos === 1 ? "" : "s"}.` : ""}`}
        </p>
      </Tarjeta>

      {/* ------------------------------------------------------------------
          2. Hasta tres acciones propias.
          ------------------------------------------------------------------ */}
      <Tarjeta className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-texto">
            2 · ¿Qué más vas a hacer?
          </h2>
          <span className="text-xs text-texto-atenuado">
            hasta {TOPE_ACCIONES}
          </span>
        </div>

        {acciones.map((a, i) => {
          const cuentasDisponibles = a.listaId
            ? (cuentasPorLista[a.listaId] ?? [])
            : [];

          return (
            <div
              key={a.clave}
              className="flex flex-col gap-3 rounded-lg border border-borde p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-texto">
                  Acción {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAcciones((previo) =>
                      previo.filter((x) => x.clave !== a.clave),
                    )
                  }
                  className="min-h-tactil flex items-center gap-1 px-2 text-sm text-error"
                >
                  <Trash2 size={16} aria-hidden /> Quitar
                </button>
              </div>

              <Opciones
                etiqueta="Qué vas a hacer"
                opciones={TIPOS_ACCION_PLAN}
                valor={a.tipo}
                onCambio={(tipo) => cambiar(a.clave, { tipo })}
              />

              {listas.length > 0 ? (
                <Opciones
                  etiqueta="¿De cuál lista?"
                  ayuda="Opcional. Si la escoges, puedes nombrar las cuentas."
                  opciones={opcionesDeLista}
                  valor={a.listaId}
                  onCambio={(listaId) => {
                    const mismo = a.listaId === listaId;
                    cambiar(a.clave, {
                      listaId: mismo ? null : listaId,
                      cuentas: [],
                    });
                    if (!mismo) void cargarCuentasDe(listaId);
                  }}
                />
              ) : null}

              {/* **Nombrar las cuentas es opcional, pero es lo que permite la
                  conversación.** Es el pedido textual de gerencia: «si ellos
                  ponen que solamente van a haber 3 clientes, poder ver cuáles
                  son esos 3». Sin nombres, la meta es un número suelto. */}
              {cuentasDisponibles.length > 0 ? (
                <Opciones
                  etiqueta="¿Cuáles?"
                  ayuda="Opcional. Al marcarlas, la meta se pone sola."
                  opciones={
                    Object.fromEntries(
                      cuentasDisponibles.map((c) => [c.id, c.nombre]),
                    ) as Record<string, string>
                  }
                  valor={a.cuentas}
                  multiple
                  onCambio={(cuentaId) => {
                    const puestas = a.cuentas.includes(cuentaId)
                      ? a.cuentas.filter((x) => x !== cuentaId)
                      : [...a.cuentas, cuentaId];
                    cambiar(a.clave, {
                      cuentas: puestas,
                      meta: puestas.length > 0 ? String(puestas.length) : a.meta,
                    });
                  }}
                />
              ) : null}

              <Campo
                etiqueta={`¿Cuántas mínimo?${a.tipo ? ` (${UNIDAD_DE_ACCION[a.tipo]})` : ""}`}
                ayuda={
                  a.listaId
                    ? `La lista tiene ${listasPorId[a.listaId]?.total ?? 0} cuentas.`
                    : undefined
                }
                type="number"
                inputMode="numeric"
                min={1}
                value={a.meta}
                onChange={(e) => cambiar(a.clave, { meta: e.target.value })}
              />
            </div>
          );
        })}

        {acciones.length < TOPE_ACCIONES ? (
          <button
            type="button"
            onClick={agregar}
            className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-dashed border-borde text-sm font-medium text-marca"
          >
            <Plus size={16} aria-hidden /> Agregar una acción
          </button>
        ) : (
          <p className="text-xs text-texto-atenuado">
            Son tres como máximo. Si quieres otra, quita una: la restricción es
            la que obliga a elegir.
          </p>
        )}
      </Tarjeta>

      {/* ------------------------------------------------------------------
          3. La nota, colgada de una cuenta.
          ------------------------------------------------------------------ */}
      <Tarjeta className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-texto">3 · Algo más</h2>

        <Campo
          etiqueta="Una nota de hoy (opcional)"
          ayuda="Por ejemplo: cierro con esta cuenta, está esperando aprobación."
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />

        {nota.trim() ? (
          <Opciones
            etiqueta="¿Sobre cuál cuenta?"
            ayuda="Colgarla de una cuenta es lo que permite que mañana el sistema te pregunte si cerró."
            opciones={opcionesDeCuenta}
            valor={notaCuenta}
            onCambio={(id) => setNotaCuenta(notaCuenta === id ? null : id)}
          />
        ) : null}
      </Tarjeta>

      <Boton
        onClick={guardar}
        ancho
        disabled={guardando || !listas_ok}
      >
        {guardando ? "Abriendo…" : "Abrir mi día"}
      </Boton>

      {!listas_ok ? (
        <p className="text-center text-xs text-texto-atenuado">
          A cada acción le falta su tipo o su meta.
        </p>
      ) : null}
    </main>
  );
}
