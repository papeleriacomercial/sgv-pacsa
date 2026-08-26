"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, FileText } from "lucide-react";
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
  /** Quién lo pidió. La oficina atiende a tres y tiene que saber a quién contestar. */
  vendedor: string;
  /** El documento que originó el encargo, cuando lo hay. */
  documento: {
    codigo: string;
    tipo: "cotizacion" | "orden_venta";
    total: number;
    conItbms: boolean;
    ruta: string | null;
  } | null;
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
 * Un encargo de la bandeja.
 *
 * **Vive fuera de `ListaSolicitudes` y eso no es estilo: es corrección.**
 * Definida dentro, React creaba una función nueva en cada render, la trataba
 * como otro componente y desmontaba la tarjeta entera — con el campo de
 * respuesta adentro. En el teléfono se veía así: se abre el teclado, se escribe
 * la primera letra, y el teclado se cierra. Cada tecla remontaba el input y le
 * quitaba el foco.
 *
 * Por eso recibe por propiedades lo que antes tomaba del cierre. Son ocho, y
 * son el precio de que el campo se pueda escribir.
 */
function Fila({
s,
puedeResolver,
respondiendo,
setRespondiendo,
texto,
setTexto,
guardando,
error,
cerrar,
}: {
s: Solicitud;
puedeResolver: boolean;
respondiendo: string | null;
setRespondiendo: (id: string | null) => void;
texto: string;
setTexto: (t: string) => void;
guardando: boolean;
error: string | null;
cerrar: (id: string, estado: "resuelta" | "rechazada") => void;
}) {
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

      {/* **El documento es lo que hace atendible la bandeja.** Sin él,
          «cotización COT-260827-A3F1» es un número y hay que ir a
          buscarlo; con él, Verónica lo abre, lo imprime y lo levanta en
          Zoho sin salir de aquí. */}
      {s.documento && (
        <VerDocumento documento={s.documento} cuenta={s.cuenta} />
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Insignia tono="neutro">{TIPOS_SOLICITUD[s.tipo]}</Insignia>
        {/* Quien atiende necesita saber a quién le contesta; a quien la
            pidió, su propio nombre no le dice nada. */}
        {!s.esMia && (
          <span className="text-texto-secundario">{s.vendedor}</span>
        )}
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
            <Fila
              key={s.id}
              s={s}
              puedeResolver={puedeResolver}
              respondiendo={respondiendo}
              setRespondiendo={setRespondiendo}
              texto={texto}
              setTexto={setTexto}
              guardando={guardando}
              error={error}
              cerrar={cerrar}
            />
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
            <Fila
              key={s.id}
              s={s}
              puedeResolver={puedeResolver}
              respondiendo={respondiendo}
              setRespondiendo={setRespondiendo}
              texto={texto}
              setTexto={setTexto}
              guardando={guardando}
              error={error}
              cerrar={cerrar}
            />
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
              <Fila
              key={s.id}
              s={s}
              puedeResolver={puedeResolver}
              respondiendo={respondiendo}
              setRespondiendo={setRespondiendo}
              texto={texto}
              setTexto={setTexto}
              guardando={guardando}
              error={error}
              cerrar={cerrar}
            />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const DOCUMENTO: Record<"cotizacion" | "orden_venta", string> = {
  cotizacion: "Cotización",
  orden_venta: "Orden de venta",
};

/**
 * Abrir el PDF que originó el encargo.
 *
 * **Se descarga y se abre, no se enlaza.** El bucket es privado —una cotización
 * lleva los precios de un cliente concreto— así que no hay dirección pública
 * que poner en un `href`. Se pide con la sesión de quien mira, y el RLS de
 * Storage decide si puede.
 *
 * Verónica lo abre, lo imprime y lo levanta en Zoho. Es todo lo que el sistema
 * le pide: no reescribe nada.
 */
function VerDocumento({
  documento,
  cuenta,
}: {
  documento: NonNullable<Solicitud["documento"]>;
  cuenta: string;
}) {
  const [trayendo, setTrayendo] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function abrir() {
    if (!documento.ruta) return;
    setTrayendo(true);
    setFallo(false);

    const supabase = clienteNavegador();
    const { data } = await supabase.storage
      .from("cotizaciones")
      .download(documento.ruta);

    if (!data) {
      setFallo(true);
      setTrayendo(false);
      return;
    }

    window.open(
      URL.createObjectURL(
        new File([data], `${documento.codigo}.pdf`, { type: "application/pdf" }),
      ),
      "_blank",
    );
    setTrayendo(false);
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-borde bg-fondo p-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-texto-secundario">
          {DOCUMENTO[documento.tipo]}{" "}
          <span className="font-mono">{documento.codigo}</span>
        </p>
        <p className="shrink-0 font-mono text-sm text-texto">
          {MONTO.format(documento.total)}
        </p>
      </div>

      <p className="text-xs text-texto-atenuado">
        {documento.conItbms ? "Con ITBMS" : "Sin ITBMS"} · {cuenta}
      </p>

      {documento.ruta && (
        <button
          type="button"
          onClick={abrir}
          disabled={trayendo}
          className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde bg-superficie text-sm text-texto disabled:opacity-50"
        >
          <FileText size={16} aria-hidden />
          {trayendo ? "Abriendo" : "Abrir el PDF"}
        </button>
      )}

      {fallo && (
        <p className="text-xs text-error">
          No se pudo abrir el archivo. Vuelve a intentar.
        </p>
      )}
    </div>
  );
}
