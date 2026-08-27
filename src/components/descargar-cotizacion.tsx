"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Send } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { diasDesde, haceDias } from "@/lib/fechas";
import { MOTIVOS_PERDIDA, type MotivoPerdida } from "@/lib/catalogos";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

/**
 * Una cotización ya emitida: verla, reenviarla o anularla.
 *
 * **El archivo se descarga, no se rehace.** Una cotización es un documento que
 * alguien recibió: si se regenerara con los precios de hoy, el papel que tiene
 * el cliente y el que ve la oficina dejarían de coincidir.
 *
 * Reenviar usa la hoja de compartir del teléfono —correo, WhatsApp, lo que
 * tenga— porque el cliente que pide «mándamela otra vez» casi nunca la pide
 * por donde llegó la primera.
 */
export function DescargarCotizacion({
  id,
  codigo,
  total,
  conItbms,
  emitidaEn,
  ruta,
  anulada,
  motivo,
  esMia,
  estado,
  motivoPerdidaGuardado,
  venceEl,
}: {
  id: string;
  codigo: string;
  total: number;
  conItbms: boolean;
  emitidaEn: string | null;
  ruta: string | null;
  anulada: boolean;
  motivo: string | null;
  esMia: boolean;
  /** `emitida` · `ganada` · `perdida` · `anulada`. */
  estado: string;
  motivoPerdidaGuardado: MotivoPerdida | null;
  /** Cuándo se le acaba la validez. Se calcula en la base, no acá. */
  venceEl: string | null;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [razon, setRazon] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [motivoPerdida, setMotivoPerdida] = useState<MotivoPerdida | "">("");

  async function traer(): Promise<File | null> {
    if (!ruta) return null;
    const supabase = clienteNavegador();
    const { data, error: fallo } = await supabase.storage
      .from("cotizaciones")
      .download(ruta);

    if (fallo || !data) {
      setError("No se pudo abrir el archivo.");
      return null;
    }
    return new File([data], `${codigo}.pdf`, { type: "application/pdf" });
  }

  async function abrir() {
    setTrabajando(true);
    setError(null);
    const archivo = await traer();
    if (archivo) window.open(URL.createObjectURL(archivo), "_blank");
    setTrabajando(false);
  }

  async function reenviar() {
    setTrabajando(true);
    setError(null);
    const archivo = await traer();

    if (archivo) {
      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: `Cotización ${codigo}` });
        } catch {
          // Cancelar no es un error.
        }
      } else {
        // Sin hoja de compartir —escritorio— se abre y desde ahí se guarda.
        window.open(URL.createObjectURL(archivo), "_blank");
      }
    }
    setTrabajando(false);
  }

  /**
   * Anular no borra: deja constancia de que se anuló y por qué.
   *
   * El cliente tiene una copia en su correo. Hacer desaparecer el documento de
   * este lado no lo hace desaparecer del suyo — solo deja a quien mire el
   * expediente sin entender por qué hay dos cotizaciones parecidas.
   */
  async function anular() {
    if (razon.trim().length < 3) return;
    setTrabajando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cotizaciones")
      .update({
        estado: "anulada",
        anulada_en: new Date().toISOString(),
        motivo_anulacion: razon.trim(),
      })
      .eq("id", id);

    if (fallo) setError(fallo.message);
    else router.refresh();
    setTrabajando(false);
  }

  /**
   * Contar qué pasó con la promesa.
   *
   * **Cerrar no es anular.** Anular dice que el papel estaba mal; cerrar dice
   * qué contestó el cliente. Compartían estado y por eso no se podía medir
   * ninguna de las dos: «la anulé porque la rechazaron» quedaba mezclado con
   * «puse mal el precio», y después nadie puede contestar cuánto se pierde por
   * precio.
   *
   * El motivo sale del catálogo cerrado —el mismo de las oportunidades— y no de
   * un campo libre, que es justamente lo que hace que se pueda sumar.
   */
  async function cerrar(nuevo: "ganada" | "perdida") {
    if (nuevo === "perdida" && !motivoPerdida) return;
    setTrabajando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase.rpc("cerrar_cotizaciones", {
      p_ids: [id],
      p_estado: nuevo,
      p_motivo: nuevo === "perdida" ? motivoPerdida : null,
    });

    if (fallo) setError(fallo.message);
    else router.refresh();
    setTrabajando(false);
  }

  const dias = emitidaEn ? diasDesde(emitidaEn) : null;
  const cerrada = estado === "ganada" || estado === "perdida";
  const inactiva = anulada || cerrada;

  // Cuántos días lleva vencida. `venceEl` sale de la base —donde se calcula con
  // la fecha de Panamá y no con la del servidor— y acá solo se compara.
  const diasVencida =
    venceEl && estado === "emitida" ? diasDesde(venceEl) : null;
  const vencida = diasVencida !== null && diasVencida > 0;

  return (
    <Tarjeta className={`flex flex-col gap-2 ${inactiva ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-sm text-texto">
            {codigo}
            <Sello estado={estado} vencida={vencida} />
          </p>
          <p className="text-xs text-texto-atenuado">
            {dias === null ? "" : haceDias(dias)}
            {!conItbms && " · sin ITBMS"}
            {/* Los días de validez no son decoración: pasados, lo que el
                cliente tiene en la mano dejó de ser un compromiso. */}
            {vencida && diasVencida !== null && ` · venció hace ${diasVencida} d`}
          </p>
          {anulada && motivo && (
            <p className="mt-1 text-xs text-texto-secundario">{motivo}</p>
          )}
          {estado === "perdida" && motivoPerdidaGuardado && (
            <p className="mt-1 text-xs text-texto-secundario">
              {MOTIVOS_PERDIDA[motivoPerdidaGuardado]}
            </p>
          )}
        </div>
        <p
          className={`shrink-0 font-mono text-base ${
            inactiva ? "text-texto-atenuado line-through" : "text-texto"
          }`}
        >
          {DINERO.format(total)}
        </p>
      </div>

      {ruta && !anulada && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={abrir}
            disabled={trabajando}
            className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto disabled:opacity-50"
          >
            <FileText size={16} aria-hidden />
            Ver
          </button>
          <button
            type="button"
            onClick={reenviar}
            disabled={trabajando}
            className="min-h-tactil flex items-center justify-center gap-1.5 rounded-lg border border-borde text-sm text-texto disabled:opacity-50"
          >
            <Send size={16} aria-hidden />
            Reenviar
          </button>
        </div>
      )}

      {/* ¿QUÉ PASÓ CON ESTA? — el cierre, que es lo que faltaba.
          Sin esto una cotización solo podía salir de la lista anulándola, o sea
          diciendo que el papel estaba mal, aunque lo que hubiera pasado fuera
          que el cliente dijo que no. */}
      {esMia && estado === "emitida" && !anulando && (
        <div className="flex flex-col gap-2 border-t border-borde pt-2">
          <p className="text-xs text-texto-secundario">¿Qué pasó con esta?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cerrar("ganada")}
              disabled={trabajando}
              className="min-h-tactil rounded-lg border border-borde text-sm font-medium text-texto disabled:opacity-50"
            >
              La aprobaron
            </button>
            <button
              type="button"
              onClick={() => setCerrando(!cerrando)}
              disabled={trabajando}
              className="min-h-tactil rounded-lg border border-borde text-sm font-medium text-texto disabled:opacity-50"
            >
              No caminó
            </button>
          </div>

          {cerrando && (
            <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-3">
              {/* El catálogo cerrado y no un campo libre. Es lo único que
                  después permite contestar cuánto se pierde por precio. */}
              <p className="text-xs text-texto-secundario">Por qué no caminó</p>
              {(Object.keys(MOTIVOS_PERDIDA) as MotivoPerdida[]).map((m) => (
                <label key={m} className="flex min-h-tactil items-center gap-2 text-sm text-texto">
                  <input
                    type="radio"
                    name={`motivo-${id}`}
                    checked={motivoPerdida === m}
                    onChange={() => setMotivoPerdida(m)}
                  />
                  {MOTIVOS_PERDIDA[m]}
                </label>
              ))}
              <Boton
                onClick={() => cerrar("perdida")}
                disabled={trabajando || !motivoPerdida}
              >
                Dar por perdida
              </Boton>
            </div>
          )}
        </div>
      )}

      {/* Anular es del dueño: quien la prometió es quien la retira. */}
      {esMia && !inactiva && !anulando && (
        <button
          type="button"
          onClick={() => setAnulando(true)}
          className="min-h-tactil text-left text-xs text-texto-atenuado"
        >
          El precio estaba mal — anular esta cotización
        </button>
      )}

      {anulando && (
        <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-3">
          <p className="text-xs text-texto-secundario">
            No se borra: queda a la vista como anulada. El cliente tiene una
            copia en su correo, y hacerla desaparecer de aquí solo dejaría a
            quien mire el expediente sin entender qué pasó.
          </p>
          <Campo
            etiqueta="Por qué se anula"
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            placeholder="El precio del rollo estaba desactualizado"
          />
          <div className="grid grid-cols-2 gap-2">
            <Boton tono="secundario" onClick={() => setAnulando(false)}>
              Dejarla
            </Boton>
            <Boton
              tono="destructivo"
              onClick={anular}
              disabled={trabajando || razon.trim().length < 3}
            >
              Anular
            </Boton>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </Tarjeta>
  );
}

/**
 * El sello de estado de una cotización.
 *
 * **Vencida no es un estado guardado**: se deduce de la fecha de emisión más
 * los días de validez. Por eso convive con «emitida» en vez de reemplazarla —
 * nadie dijo que no, sólo se acabó el plazo.
 */
function Sello({ estado, vencida }: { estado: string; vencida: boolean }) {
  if (estado === "anulada") return <Etiqueta tono="neutro">Anulada</Etiqueta>;
  if (estado === "ganada") return <Etiqueta tono="ok">Ganada</Etiqueta>;
  if (estado === "perdida") return <Etiqueta tono="error">Perdida</Etiqueta>;
  if (vencida) return <Etiqueta tono="aviso">Vencida</Etiqueta>;
  return null;
}

function Etiqueta({
  tono,
  children,
}: {
  tono: "ok" | "aviso" | "error" | "neutro";
  children: string;
}) {
  const TONOS = {
    ok: "bg-green-100 text-green-800",
    aviso: "bg-amber-100 text-amber-900",
    error: "bg-red-100 text-red-800",
    neutro: "bg-fondo text-texto-secundario",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>
      {children}
    </span>
  );
}
