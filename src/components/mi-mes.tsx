"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";

export type Pendiente = {
  id: string;
  clase: "cotizacion" | "oportunidad";
  titulo: string;
  cuenta: string;
  monto: number;
  /** Fecha en que vence la cotización, o el cierre estimado de la venta. */
  cuando: string | null;
};

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const CENTAVOS = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

/**
 * Cuánto lleva vendido este mes y cuánto de comisión, con lo que podría cerrar.
 *
 * **Es lo que el vendedor hace con papel y lápiz.** Mira lo que tiene en la
 * calle, decide cuáles cree que entran, y suma. Aquí las casillas hacen esa
 * cuenta sola — y al lado de cada una, lo que esa venta le dejaría a él.
 *
 * Nada de lo que se marca se guarda: es una cuenta mental, no una promesa. Si
 * se guardara, se convertiría en un pronóstico que alguien le va a reclamar, y
 * el vendedor dejaría de usarlo con honestidad.
 *
 * **Va en Ventas y no en la Agenda a propósito.** Un número de comisión
 * delante todo el día motiva cuando el mes va bien y desmoraliza cuando va
 * mal. Aquí se mira cuando se quiere mirar.
 */
export function MiMes({
  vendido,
  comision,
  porcentaje,
  sobreNeto,
  documentos,
  porCobrar,
  pendientes,
  detalleHref,
}: {
  vendido: number;
  comision: number;
  porcentaje: number;
  sobreNeto: boolean;
  documentos: number;
  porCobrar: number;
  pendientes: Pendiente[];
  detalleHref: string;
}) {
  const [marcados, setMarcados] = useState<string[]>([]);

  const proyeccion = useMemo(() => {
    const monto = pendientes
      .filter((p) => marcados.includes(p.id))
      .reduce((s, p) => s + p.monto, 0);
    return { monto, comision: (monto * porcentaje) / 100 };
  }, [pendientes, marcados, porcentaje]);

  return (
    <div className="flex flex-col gap-4">
      {/* --- Lo cerrado, que es el número duro --- */}
      <Tarjeta className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-texto-secundario">Vendido este mes</p>
          <p className="font-mono text-2xl text-texto">{DINERO.format(vendido)}</p>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-3">
          <div>
            <p className="text-sm text-texto-secundario">Comisión ganada</p>
            <p className="text-xs text-texto-atenuado">
              {porcentaje}% {sobreNeto ? "sin ITBMS" : "del total"}
            </p>
          </div>
          <p className="font-mono text-2xl text-ok">{CENTAVOS.format(comision)}</p>
        </div>

        <Link
          href={detalleHref}
          className="min-h-tactil flex items-center justify-between gap-2 rounded-lg border border-borde px-3 text-sm text-texto"
        >
          <span>
            Ver las {documentos} {documentos === 1 ? "venta" : "ventas"} del mes
          </span>
          <ChevronRight size={16} aria-hidden />
        </Link>

        {porCobrar > 0 && (
          <p className="text-xs text-texto-atenuado">
            De eso, {DINERO.format(porCobrar)} está todavía por cobrar.
          </p>
        )}

        {/* Sin esto, el primer mes que la planilla no cuadre con la pantalla se
            pierde la confianza en todo lo demás. */}
        <p className="text-xs text-texto-atenuado">
          Es lo que dice Zoho hasta la última sincronización. No incluye
          devoluciones ni notas de crédito, así que la planilla puede diferir.
        </p>
      </Tarjeta>

      {/* --- Lo que podría cerrar --- */}
      {pendientes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">
            Lo que puedes cerrar este mes
          </h2>
          <p className="text-xs text-texto-atenuado">
            Marca las que creas que entran. Es tu cuenta, no queda guardada.
          </p>

          {pendientes.map((p) => {
            const marcado = marcados.includes(p.id);
            return (
              <Tarjeta
                key={p.id}
                className={`flex items-start gap-3 ${marcado ? "border-marca/40" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() =>
                    setMarcados((m) =>
                      m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id],
                    )
                  }
                  aria-label={`Contar ${p.titulo}`}
                  className="mt-1 size-5 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-texto">{p.titulo}</p>
                  <p className="truncate text-xs text-texto-atenuado">
                    {p.cuenta}
                    {p.cuando && ` · ${p.cuando}`}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm text-texto">
                    {DINERO.format(p.monto)}
                  </p>
                  {/* Lo que esa venta le deja a él. Es el número que hace que
                      valga la pena perseguirla. */}
                  <p className="font-mono text-xs text-ok">
                    +{CENTAVOS.format((p.monto * porcentaje) / 100)}
                  </p>
                </div>
              </Tarjeta>
            );
          })}

          <Tarjeta
            className={`flex flex-col gap-2 ${
              marcados.length > 0 ? "border-marca/40 bg-fondo" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-texto-secundario">
                Si cierras {marcados.length === 0 ? "lo marcado" : `esas ${marcados.length}`}
              </p>
              <p className="font-mono text-lg text-texto">
                {DINERO.format(vendido + proyeccion.monto)}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-texto-secundario">Comisión del mes</p>
              <p className="font-mono text-xl text-ok">
                {CENTAVOS.format(comision + proyeccion.comision)}
              </p>
            </div>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
