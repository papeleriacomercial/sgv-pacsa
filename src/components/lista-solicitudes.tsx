"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  ESTADOS_SOLICITUD,
  RESUELVE,
  TIPOS_SOLICITUD,
  TONO_SOLICITUD,
  type EstadoSolicitud,
  type ResuelveSolicitud,
  type TipoSolicitud,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio, MensajeError } from "@/components/ui/estados";

export type Solicitud = {
  id: string;
  cuentaId: string;
  cuenta: string;
  ruc: string | null;
  esMia: boolean;
  tipo: TipoSolicitud;
  resuelve: ResuelveSolicitud;
  detalle: string;
  monto: number | null;
  paraCuando: string | null;
  estado: EstadoSolicitud;
  respuesta: string | null;
  horas: number;
  vencida: boolean;
};

const MONTO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

/** El reloj en palabras. Las horas exactas no le sirven a nadie. */
function reloj(horas: number): string {
  if (horas < 1) return "hace menos de una hora";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/**
 * La bandeja, con su reloj.
 *
 * Lo pendiente arriba y lo vencido en rojo. No es un detalle de orden: es lo
 * que convierte la lista en una herramienta de trabajo en vez de un archivo.
 *
 * Y el reloj mide a los dos lados. Si los vendedores quedan medidos y la
 * oficina no, esto es control con buena interfaz por mucho que lo llamemos
 * contrato.
 */
export function ListaSolicitudes({
  solicitudes,
  puedeResolver,
}: {
  solicitudes: Solicitud[];
  /** Administración y gerencia cierran; el vendedor solo cierra las suyas. */
  puedeResolver: boolean;
}) {
  const router = useRouter();
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const cerradas = solicitudes.filter((s) => s.estado !== "pendiente");

  const vencidas = pendientes.filter((s) => s.vencida);
  const aTiempo = pendientes.filter((s) => !s.vencida);

  // El cumplimiento de las 24 horas, visible para todos. Es la contrapartida
  // que vuelve creíble el compromiso.
  const contestadasATiempo = cerradas.filter((s) => s.horas <= 24).length;

  async function cerrar(id: string, estado: "resuelta" | "rechazada") {
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: fallo } = await supabase
      .from("solicitudes")
      .update({
        estado,
        respuesta: texto.trim() || null,
        resuelta_en: new Date().toISOString(),
        resuelta_por: user?.id ?? null,
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setRespondiendo(null);
    setTexto("");
    setGuardando(false);
    router.refresh();
  }

  function Fila({ s }: { s: Solicitud }) {
    const puedeCerrar = s.estado === "pendiente" && (puedeResolver || s.esMia);

    return (
      <Tarjeta
        className={`flex flex-col gap-2 ${s.vencida ? "border-red-200 bg-red-50" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <Link href={`/cuentas/${s.cuentaId}`} className="block">
            <p className="text-base font-semibold text-texto">{s.cuenta}</p>
            {s.ruc && (
              <p className="font-mono text-xs text-texto-secundario">
                RUC {s.ruc}
              </p>
            )}
          </Link>
          <Insignia tono={TONO_SOLICITUD[s.estado]}>
            {ESTADOS_SOLICITUD[s.estado]}
          </Insignia>
        </div>

        <p className="text-sm text-texto-secundario">{s.detalle}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Insignia tono="neutro">{TIPOS_SOLICITUD[s.tipo]}</Insignia>
          {s.resuelve === "yo" && (
            <span className="text-texto-atenuado">{RESUELVE.yo}</span>
          )}
          {s.monto !== null && (
            <span className="font-mono text-texto">{MONTO.format(s.monto)}</span>
          )}
          {s.paraCuando && (
            <span className="font-mono text-texto-secundario">
              para el {FECHA.format(new Date(`${s.paraCuando}T12:00:00`))}
            </span>
          )}
          <span
            className={`flex items-center gap-1 font-mono ${
              s.vencida ? "text-error" : "text-texto-atenuado"
            }`}
          >
            <Clock size={12} aria-hidden />
            {reloj(s.horas)}
          </span>
        </div>

        {s.respuesta && (
          <p className="rounded-lg bg-fondo p-2 text-sm text-texto">
            {s.respuesta}
          </p>
        )}

        {puedeCerrar && respondiendo !== s.id && (
          <Boton tono="secundario" onClick={() => setRespondiendo(s.id)}>
            Responder
          </Boton>
        )}

        {respondiendo === s.id && (
          <div className="flex flex-col gap-2">
            <Campo
              etiqueta="Respuesta"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              ayuda="Un no en cuatro horas se puede trabajar. El silencio de tres días, no."
            />
            {error && (
              <MensajeError titulo="No se pudo guardar" detalle={error} />
            )}
            <div className="grid grid-cols-2 gap-2">
              <Boton
                tono="secundario"
                ancho
                disabled={guardando}
                onClick={() => cerrar(s.id, "rechazada")}
              >
                No se puede
              </Boton>
              <Boton
                ancho
                disabled={guardando}
                onClick={() => cerrar(s.id, "resuelta")}
              >
                {guardando ? "Guardando" : "Resuelta"}
              </Boton>
            </div>
          </div>
        )}
      </Tarjeta>
    );
  }

  if (solicitudes.length === 0) {
    return (
      <Tarjeta>
        <Vacio titulo="No hay solicitudes">
          Aquí llega lo que el cliente pide y que resuelve la oficina: pedidos,
          cotizaciones, muestras y precios especiales. Se crean desde el
          expediente de la cuenta.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {vencidas.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-texto">
              Pasaron de 24 horas
            </h2>
            <Insignia tono="error">{String(vencidas.length)}</Insignia>
          </div>
          {vencidas.map((s) => (
            <Fila key={s.id} s={s} />
          ))}
        </section>
      )}

      {aTiempo.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-texto">Pendientes</h2>
            <Insignia tono="aviso">{String(aTiempo.length)}</Insignia>
          </div>
          {aTiempo.map((s) => (
            <Fila key={s.id} s={s} />
          ))}
        </section>
      )}

      {cerradas.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-texto">Cerradas</h2>
            <span className="font-mono text-xs text-texto-secundario">
              {contestadasATiempo} de {cerradas.length} dentro de 24 h
            </span>
          </div>
          <div className="flex flex-col gap-2 opacity-70">
            {cerradas.slice(0, 10).map((s) => (
              <Fila key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
