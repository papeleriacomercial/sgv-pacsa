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
  /** Cuándo se emitió la cotización, o cuándo se estima cerrar la venta. */
  cuando: string | null;
  /** Solo cuando se mira a más de uno: de quién es. */
  vendedor: string | null;
};

export type FilaVendedor = {
  id: string;
  nombre: string;
  vendido: number;
  comision: number;
  documentos: number;
  esMio: boolean;
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
  deQuien,
}: {
  vendido: number;
  comision: number;
  porcentaje: number;
  sobreNeto: boolean;
  documentos: number;
  porCobrar: number;
  pendientes: Pendiente[];
  detalleHref: string;
  /** Null cuando es el propio. Con nombre cuando el líder mira a alguien. */
  deQuien: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-texto-secundario">
            {deQuien ? `Vendido por ${deQuien}` : "Vendido este mes"}
          </p>
          <p className="font-mono text-2xl text-texto">{DINERO.format(vendido)}</p>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-3">
          <div>
            <p className="text-sm text-texto-secundario">
              {deQuien ? "Su comisión" : "Comisión ganada"}
            </p>
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
            Ver {documentos === 1 ? "la venta" : `las ${documentos} ventas`} del
            mes
          </span>
          <ChevronRight size={16} aria-hidden />
        </Link>

        {porCobrar > 0 && (
          <p className="text-xs text-texto-atenuado">
            De eso, {DINERO.format(porCobrar)} está todavía por cobrar.
          </p>
        )}

        <Advertencia />
      </Tarjeta>

      <Proyeccion
        pendientes={pendientes}
        porcentaje={porcentaje}
        vendido={vendido}
        comision={comision}
      />
    </div>
  );
}

/**
 * El mes del equipo entero, vendedor por vendedor.
 *
 * **El total de arriba no es la comisión de nadie.** Es la suma de tres
 * comisiones distintas que cobran tres personas distintas, y se rotula así
 * para que no se lea como un número propio del líder.
 *
 * Cada fila lleva a la vista de esa persona, que es la pregunta siguiente
 * natural: «¿de dónde salieron esos $8 900 de Javier?».
 */
export function VentasEquipo({
  filas,
  porcentaje,
  sobreNeto,
  pendientes,
  hrefDe,
}: {
  filas: FilaVendedor[];
  porcentaje: number;
  sobreNeto: boolean;
  pendientes: Pendiente[];
  hrefDe: (id: string) => string;
}) {
  const vendido = filas.reduce((s, f) => s + f.vendido, 0);
  const comision = filas.reduce((s, f) => s + f.comision, 0);
  const mayor = Math.max(...filas.map((f) => f.vendido), 1);

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-texto-secundario">Vendido por el equipo</p>
          <p className="font-mono text-2xl text-texto">{DINERO.format(vendido)}</p>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-3">
          <div>
            {/* En plural y a propósito: son varias comisiones de varias
                personas, no un número que cobre alguien. */}
            <p className="text-sm text-texto-secundario">Comisiones del mes</p>
            <p className="text-xs text-texto-atenuado">
              {porcentaje}% {sobreNeto ? "sin ITBMS" : "del total"}, cada quien
              sobre lo suyo
            </p>
          </div>
          <p className="font-mono text-2xl text-ok">{CENTAVOS.format(comision)}</p>
        </div>

        <Advertencia />
      </Tarjeta>

      <div className="flex flex-col gap-2">
        {filas.map((f) => (
          <Link key={f.id} href={hrefDe(f.id)} className="block">
            <Tarjeta className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-texto">
                  {f.nombre}
                  {f.esMio && (
                    <span className="ml-1.5 text-xs text-texto-atenuado">
                      (tú)
                    </span>
                  )}
                </p>
                <p className="shrink-0 font-mono text-base text-texto">
                  {DINERO.format(f.vendido)}
                </p>
              </div>

              {/* La barra es la comparación que el número solo no da: quién
                  está lejos de quién, sin tener que restar de cabeza. */}
              <div
                className="h-1.5 overflow-hidden rounded-full bg-fondo"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-marca"
                  style={{ width: `${Math.round((f.vendido / mayor) * 100)}%` }}
                />
              </div>

              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-texto-atenuado">
                  {f.documentos === 0
                    ? "Sin ventas todavía"
                    : `${f.documentos} ${f.documentos === 1 ? "venta" : "ventas"}`}
                </span>
                <span className="font-mono text-ok">
                  {CENTAVOS.format(f.comision)}
                </span>
              </div>
            </Tarjeta>
          </Link>
        ))}
      </div>

      <Proyeccion
        pendientes={pendientes}
        porcentaje={porcentaje}
        vendido={vendido}
        comision={comision}
      />
    </div>
  );
}

/**
 * Sin esto, el primer mes que la planilla no cuadre con la pantalla se pierde
 * la confianza en todo lo demás.
 */
function Advertencia() {
  return (
    <p className="text-xs text-texto-atenuado">
      Es lo que dice Zoho hasta la última sincronización. No incluye
      devoluciones ni notas de crédito, así que la planilla puede diferir.
    </p>
  );
}

/**
 * Lo que todavía puede entrar antes de fin de mes.
 *
 * **Es lo que el vendedor hace con papel y lápiz.** Mira lo que tiene en la
 * calle, decide cuáles cree que entran, y suma. Aquí las casillas hacen esa
 * cuenta sola — y al lado de cada una, lo que esa venta le dejaría a él.
 *
 * Nada de lo que se marca se guarda: es una cuenta mental, no una promesa. Si
 * se guardara, se convertiría en un pronóstico que alguien le va a reclamar, y
 * entonces se dejaría de marcar con honestidad.
 */
function Proyeccion({
  pendientes,
  porcentaje,
  vendido,
  comision,
}: {
  pendientes: Pendiente[];
  porcentaje: number;
  vendido: number;
  comision: number;
}) {
  const [marcados, setMarcados] = useState<string[]>([]);

  const proyeccion = useMemo(() => {
    const monto = pendientes
      .filter((p) => marcados.includes(p.id))
      .reduce((s, p) => s + p.monto, 0);
    return { monto, comision: (monto * porcentaje) / 100 };
  }, [pendientes, marcados, porcentaje]);

  if (pendientes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-texto">
        Lo que se puede cerrar este mes
      </h2>
      <p className="text-xs text-texto-atenuado">
        Marca las que creas que entran. Es una cuenta tuya, no queda guardada.
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
              {p.vendedor && (
                <p className="truncate text-xs text-texto-secundario">
                  {p.vendedor}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-sm text-texto">
                {DINERO.format(p.monto)}
              </p>
              {/* Lo que esa venta le deja a quien la cierre. Es el número que
                  hace que valga la pena perseguirla. */}
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
            {marcados.length === 0
              ? "Si cierras lo marcado"
              : `Si cierran esas ${marcados.length}`}
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
  );
}
