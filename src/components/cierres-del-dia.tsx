"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileCheck2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError } from "@/components/ui/estados";

/**
 * ¿Cerraste algo hoy? — docs/18-plan-diario.md §5.3.
 *
 * **Lo que ya pasó por documento aparece solo.** Una cotización que el vendedor
 * marcó ganada hoy trae su cuenta, su monto y sus renglones: no se teclea dos
 * veces, se confirma con un toque.
 *
 * Lo único que se escribe es la venta sin documento — la del mostrador, la de la
 * libreta, la que se despachó del camión.
 */

const CENTAVOS = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

type CotizacionGanada = {
  id: string;
  codigo: string;
  total: number;
  cuentaId: string;
  cuenta: string;
  /** Si ya se declaró, no se vuelve a ofrecer. */
  yaDeclarada: boolean;
};

type SinDocumento = {
  clave: number;
  cuentaId: string | null;
  monto: string;
};

/** Un cierre listo para guardar, tal como lo va a escribir la pantalla. */
export type CierreListo = {
  cotizacionId: string | null;
  cuentaId: string;
  monto: number;
};

export function CierresDelDia({
  vendedorId,
  hoy,
  onCambio,
}: {
  vendedorId: string;
  hoy: string;
  /**
   * Lo que el vendedor lleva confirmado, hacia arriba.
   *
   * **El componente no guarda nada por su cuenta**, y es deliberado: el guardado
   * tiene que ocurrir dentro del mismo botón de «Cerrar el día». Dos botones de
   * guardar en la misma pantalla —uno para los cierres y otro para el día— es la
   * receta de que alguien apriete el segundo y pierda el primero.
   */
  onCambio?: (cierres: CierreListo[], total: number) => void;
}) {
  const supabase = clienteNavegador();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ganadas, setGanadas] = useState<CotizacionGanada[]>([]);
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [sueltos, setSueltos] = useState<SinDocumento[]>([]);
  const [misCuentas, setMisCuentas] = useState<{ id: string; nombre: string }[]>([]);
  const [yaGuardado, setYaGuardado] = useState(0);

  useEffect(() => {
    let vivo = true;

    (async () => {
      const [cotiz, declarados, cuentas] = await Promise.all([
        // Las cerradas HOY como ganadas. `cerrada_en` es un timestamp, así que
        // el día de Panamá va de su medianoche a la siguiente — comparar contra
        // el texto de la fecha dejaría fuera todo lo cerrado después de las 7.
        supabase
          .from("cotizaciones")
          .select("id, codigo, total, cuenta_id, cuentas(nombre)")
          .eq("vendedor_id", vendedorId)
          .eq("estado", "ganada")
          .is("deleted_at", null)
          .gte("cerrada_en", `${hoy}T00:00:00-05:00`)
          .lte("cerrada_en", `${hoy}T23:59:59.999-05:00`),
        supabase
          .from("cierres_declarados")
          .select("monto, cotizacion_id")
          .eq("vendedor_id", vendedorId)
          .eq("fecha", hoy)
          .is("deleted_at", null),
        supabase
          .from("cuentas")
          .select("id, nombre")
          .eq("vendedor_id", vendedorId)
          .is("deleted_at", null)
          .order("nombre")
          .limit(500),
      ]);

      if (!vivo) return;

      const yaEstan = new Set(
        ((declarados.data ?? []) as { cotizacion_id: string | null }[])
          .map((d) => d.cotizacion_id)
          .filter((x): x is string => !!x),
      );

      setGanadas(
        ((cotiz.data ?? []) as Record<string, unknown>[]).map((c) => {
          const cta = c.cuentas as { nombre: string } | { nombre: string }[] | null;
          return {
            id: String(c.id),
            codigo: String(c.codigo),
            total: Number(c.total),
            cuentaId: String(c.cuenta_id),
            cuenta: Array.isArray(cta) ? (cta[0]?.nombre ?? "") : (cta?.nombre ?? ""),
            yaDeclarada: yaEstan.has(String(c.id)),
          };
        }),
      );

      // Lo ya declarado hoy se cuenta aparte: puede venir de haber entrado dos
      // veces a cerrar el día.
      setYaGuardado(
        ((declarados.data ?? []) as { monto: number }[]).reduce(
          (s, d) => s + Number(d.monto),
          0,
        ),
      );
      setMisCuentas((cuentas.data ?? []) as { id: string; nombre: string }[]);
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
  }, [hoy, supabase, vendedorId]);

  const opcionesDeCuenta = useMemo(
    () =>
      Object.fromEntries(misCuentas.map((c) => [c.id, c.nombre])) as Record<
        string,
        string
      >,
    [misCuentas],
  );

  /**
   * Lo confirmado, listo para guardar.
   *
   * **Un cierre suelto sin cuenta o sin monto no entra en la lista.** Así el
   * botón de cerrar el día nunca intenta guardar una fila a medio llenar: lo que
   * está incompleto simplemente no cuenta todavía.
   */
  const listos = useMemo<CierreListo[]>(() => {
    const deDocumentos = ganadas
      .filter((g) => confirmadas.has(g.id))
      .map((g) => ({ cotizacionId: g.id, cuentaId: g.cuentaId, monto: g.total }));

    const deSueltos = sueltos
      .filter((x) => x.cuentaId && Number(x.monto) > 0)
      .map((x) => ({
        cotizacionId: null,
        cuentaId: x.cuentaId as string,
        monto: Number(x.monto),
      }));

    return [...deDocumentos, ...deSueltos];
  }, [confirmadas, ganadas, sueltos]);

  const totalDeHoy = useMemo(
    () => yaGuardado + listos.reduce((s, c) => s + c.monto, 0),
    [listos, yaGuardado],
  );

  useEffect(() => {
    onCambio?.(listos, totalDeHoy);
  }, [listos, onCambio, totalDeHoy]);

  if (cargando) return null;

  const porOfrecer = ganadas.filter((g) => !g.yaDeclarada);
  const hayAlgo = porOfrecer.length > 0 || sueltos.length > 0 || yaGuardado > 0;

  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-texto">¿Cerraste algo hoy?</h2>
        {hayAlgo ? (
          <span className="font-mono text-sm text-texto">
            {CENTAVOS.format(totalDeHoy)}
          </span>
        ) : null}
      </div>

      {error ? <MensajeError detalle={error} /> : null}

      {/* ------------------------------------------------------------------
          Lo que ya pasó por documento. Un toque, no se teclea.
          ------------------------------------------------------------------ */}
      {porOfrecer.map((g) => (
        <label
          key={g.id}
          className="min-h-tactil flex items-start gap-3 rounded-lg border border-borde p-3"
        >
          <input
            type="checkbox"
            checked={confirmadas.has(g.id)}
            onChange={(e) => {
              const nuevas = new Set(confirmadas);
              if (e.target.checked) nuevas.add(g.id);
              else nuevas.delete(g.id);
              setConfirmadas(nuevas);
            }}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-marca)]"
          />
          <span className="flex-1">
            <span className="block text-sm text-texto">{g.cuenta}</span>
            <span className="block text-xs text-texto-atenuado">
              {g.codigo} · la marcaste ganada hoy
            </span>
          </span>
          <span className="shrink-0 font-mono text-sm text-texto">
            {CENTAVOS.format(g.total)}
          </span>
        </label>
      ))}

      {yaGuardado > 0 ? (
        <p className="flex items-center gap-2 text-xs text-texto-secundario">
          <FileCheck2 size={14} className="text-ok" aria-hidden />
          Ya tenías {CENTAVOS.format(yaGuardado)} declarados de hoy.
        </p>
      ) : null}

      {/* ------------------------------------------------------------------
          La venta sin documento. Veinte segundos: cliente y monto.

          **Los renglones no se piden, y es a propósito.** La factura los va a
          traer igual esta noche, y obligarlo a teclear veinticinco fardos en un
          teléfono para que mañana lleguen solos es trabajo doble — y el trabajo
          doble termina inventándose.
          ------------------------------------------------------------------ */}
      {sueltos.map((s, i) => (
        <div
          key={s.clave}
          className="flex flex-col gap-3 rounded-lg border border-borde p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-texto">
              Venta sin documento {sueltos.length > 1 ? i + 1 : ""}
            </span>
            <button
              type="button"
              onClick={() =>
                setSueltos((previo) => previo.filter((x) => x.clave !== s.clave))
              }
              className="min-h-tactil flex items-center gap-1 px-2 text-sm text-error"
            >
              <Trash2 size={16} aria-hidden /> Quitar
            </button>
          </div>

          <Opciones
            etiqueta="¿A quién?"
            opciones={opcionesDeCuenta}
            valor={s.cuentaId}
            onCambio={(id) =>
              setSueltos((previo) =>
                previo.map((x) =>
                  x.clave === s.clave
                    ? { ...x, cuentaId: x.cuentaId === id ? null : id }
                    : x,
                ),
              )
            }
          />

          <Campo
            etiqueta="¿Por cuánto?"
            ayuda="Sin ITBMS. Si no te acuerdas exacto, pon lo que recuerdes."
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={s.monto}
            onChange={(e) =>
              setSueltos((previo) =>
                previo.map((x) =>
                  x.clave === s.clave ? { ...x, monto: e.target.value } : x,
                ),
              )
            }
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setSueltos((previo) => [
            ...previo,
            { clave: Date.now(), cuentaId: null, monto: "" },
          ])
        }
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-dashed border-borde text-sm font-medium text-marca"
      >
        <Plus size={16} aria-hidden /> Agregar un cierre sin documento
      </button>

      {!hayAlgo ? (
        <p className="text-xs text-texto-atenuado">
          Si hoy no cerraste nada, déjalo así y cierra tu día. No pasa nada.
        </p>
      ) : null}
    </Tarjeta>
  );
}

/** Guarda lo que el vendedor confirmó. La llama el botón de «Cerrar el día». */
export async function guardarCierres(
  vendedorId: string,
  hoy: string,
  confirmadas: CierreListo[],
): Promise<string | null> {
  for (const c of confirmadas) {
    if (!(c.monto > 0) || !c.cuentaId) continue;
    const { error } = await insertar(
      "cierres_declarados",
      {
        id: crypto.randomUUID(),
        vendedor_id: vendedorId,
        fecha: hoy,
        cuenta_id: c.cuentaId,
        monto: c.monto,
        cotizacion_id: c.cotizacionId,
      },
      "Un cierre de hoy",
    );
    if (error) return error;
  }
  return null;
}
