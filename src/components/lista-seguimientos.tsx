"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Filter } from "lucide-react";
import { TIPOS_INTERACCION, type TipoInteraccion } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";

export type Compromiso = {
  id: string;
  cuenta_id: string;
  cuenta: string;
  descripcion: string;
  fecha_compromiso: string;
  tipo_accion: TipoInteraccion;
};

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

function fecha(iso: string) {
  // Se ancla al mediodía para que el cambio de huso no corra el día.
  return FECHA.format(new Date(`${iso}T12:00:00`));
}

type Ventana = "vencidos" | "hoy" | "tres" | "todos" | "rango";

const VENTANAS: Record<Exclude<Ventana, "rango">, string> = {
  vencidos: "Vencidos",
  hoy: "Hoy",
  tres: "Próximos 3 días",
  todos: "Todos",
};

/**
 * Los seguimientos pendientes, por acción y por ventana de tiempo.
 *
 * Los vencidos van primero y en rojo. No es un detalle de orden: es lo que
 * convierte la lista en una herramienta de trabajo en vez de un calendario.
 */
export function ListaSeguimientos({
  compromisos,
  hoy,
}: {
  compromisos: Compromiso[];
  /** Fecha de Panamá calculada en el servidor, para que cliente y base coincidan. */
  hoy: string;
}) {
  const [acciones, setAcciones] = useState<TipoInteraccion[]>([]);
  const [ventana, setVentana] = useState<Ventana>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [abierto, setAbierto] = useState(false);

  const enTresDias = useMemo(() => {
    const d = new Date(`${hoy}T12:00:00`);
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  }, [hoy]);

  const visibles = useMemo(
    () =>
      compromisos.filter((c) => {
        if (acciones.length && !acciones.includes(c.tipo_accion)) return false;

        const f = c.fecha_compromiso;
        if (ventana === "vencidos") return f < hoy;
        if (ventana === "hoy") return f === hoy;
        if (ventana === "tres") return f <= enTresDias;
        if (ventana === "rango") {
          if (desde && f < desde) return false;
          if (hasta && f > hasta) return false;
        }
        return true;
      }),
    [compromisos, acciones, ventana, desde, hasta, hoy, enTresDias],
  );

  const vencidos = visibles.filter((c) => c.fecha_compromiso < hoy);
  const deHoy = visibles.filter((c) => c.fecha_compromiso === hoy);
  const proximos = visibles.filter((c) => c.fecha_compromiso > hoy);

  const activos = acciones.length + (ventana !== "todos" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="min-h-tactil flex items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <span className="flex items-center gap-2">
          <Filter size={16} aria-hidden />
          Filtros
        </span>
        <span className="text-texto-secundario">
          {activos > 0
            ? `${visibles.length} de ${compromisos.length}`
            : `${compromisos.length} pendientes`}
        </span>
      </button>

      {abierto && (
        <Tarjeta className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-texto">Qué hay que hacer</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(TIPOS_INTERACCION) as TipoInteraccion[]).map((t) => {
                const activo = acciones.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      setAcciones((a) =>
                        a.includes(t) ? a.filter((x) => x !== t) : [...a, t],
                      )
                    }
                    className={`min-h-tactil rounded-lg border px-3 text-sm ${
                      activo
                        ? "border-marca bg-marca text-white"
                        : "border-borde bg-superficie text-texto"
                    }`}
                  >
                    {TIPOS_INTERACCION[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-texto">Cuándo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(VENTANAS) as Exclude<Ventana, "rango">[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={ventana === v}
                  onClick={() => setVentana(v)}
                  className={`min-h-tactil rounded-lg border px-3 text-sm ${
                    ventana === v
                      ? "border-marca bg-marca text-white"
                      : "border-borde bg-superficie text-texto"
                  }`}
                >
                  {VENTANAS[v]}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={ventana === "rango"}
                onClick={() => setVentana("rango")}
                className={`min-h-tactil rounded-lg border px-3 text-sm ${
                  ventana === "rango"
                    ? "border-marca bg-marca text-white"
                    : "border-borde bg-superficie text-texto"
                }`}
              >
                Rango
              </button>
            </div>
          </div>

          {ventana === "rango" && (
            <div className="grid grid-cols-2 gap-2">
              <Campo
                etiqueta="Desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
              <Campo
                etiqueta="Hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          )}
        </Tarjeta>
      )}

      {compromisos.length === 0 && (
        <Tarjeta>
          <Vacio titulo="No tienes seguimientos pendientes">
            Cada seguimiento que registres deja aquí su próximo paso.
          </Vacio>
        </Tarjeta>
      )}

      {compromisos.length > 0 && visibles.length === 0 && (
        <Tarjeta>
          <Vacio titulo="Ninguno pasa el filtro">
            Prueba con otra ventana de tiempo o quita el filtro de acción.
          </Vacio>
        </Tarjeta>
      )}

      <Grupo titulo="Vencidos" tono="error" lista={vencidos} resaltado />
      <Grupo titulo="Hoy" tono="info" lista={deHoy} />
      <Grupo titulo="Más adelante" tono="neutro" lista={proximos} />
    </div>
  );
}

function Grupo({
  titulo,
  tono,
  lista,
  resaltado = false,
}: {
  titulo: string;
  tono: "error" | "info" | "neutro";
  lista: Compromiso[];
  resaltado?: boolean;
}) {
  if (lista.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-texto">{titulo}</h2>
        <Insignia tono={tono}>{String(lista.length)}</Insignia>
      </div>

      {lista.map((c) => (
        <Tarjeta
          key={c.id}
          className={`flex flex-col gap-2 ${
            resaltado ? "border-red-200 bg-red-50" : ""
          }`}
        >
          <Link href={`/cuentas/${c.cuenta_id}`} className="block">
            <p className="text-base font-semibold text-texto">{c.cuenta}</p>
            <p className="text-sm text-texto-secundario">{c.descripcion}</p>
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Insignia tono="neutro">{TIPOS_INTERACCION[c.tipo_accion]}</Insignia>
              <span className="flex items-center gap-1 font-mono text-xs text-texto-secundario">
                <CalendarClock size={14} aria-hidden />
                {fecha(c.fecha_compromiso)}
              </span>
            </span>

            {/* Cumplir un compromiso es registrar qué pasó, no tocar un botón
                que lo borra. Así el sistema se entera de cómo fue, y encadena
                el siguiente paso en el mismo gesto. */}
            <Link
              href={`/cuentas/${c.cuenta_id}/seguimiento?compromiso=${c.id}`}
              className="block"
            >
              <Boton tono="secundario">Registrar</Boton>
            </Link>
          </div>
        </Tarjeta>
      ))}
    </section>
  );
}
