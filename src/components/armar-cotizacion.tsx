"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Send, Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  CONDICIONES,
  generarCotizacion,
  type CondicionPago,
  type Empresa,
} from "@/lib/cotizacion-pdf";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError, Vacio } from "@/components/ui/estados";

type Producto = {
  item_id: string;
  nombre: string;
  unidad: string | null;
  precio: string | number | null;
  existencia: string | number;
};

type Renglon = {
  clave: string;
  itemId: string | null;
  nombre: string;
  unidad: string | null;
  cantidad: string;
  precio: string;
  /** De cuándo salió el precio, si vino de una compra anterior. */
  desde: string | null;
};

export type Cuenta = {
  id: string;
  nombre: string;
  ruc: string | null;
  direccion: string | null;
  poblado: string | null;
  pide_sin_itbms: boolean;
};

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

const FECHA_CORTA = new Intl.DateTimeFormat("es-PA", {
  month: "short",
  year: "numeric",
  timeZone: "America/Panama",
});

/**
 * El código del documento.
 *
 * `COT-260826-A7F3`: fecha y cuatro caracteres del identificador. **No es
 * correlativo a propósito** — pedirle el siguiente número a la base exige
 * señal, y el vendedor cotiza donde no la hay. Y que se distinga del
 * correlativo de Zoho evita que dentro de la casa alguien confunda una con
 * otra.
 */
function codigoDe(id: string, fecha: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Panama",
  })
    .format(fecha)
    .replace(/-/g, "");
  return `COT-${p}-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function ArmarCotizacion({
  cuenta,
  empresa,
  vendedor,
  tope,
  itbmsPorcentaje,
}: {
  cuenta: Cuenta;
  empresa: Empresa;
  vendedor: { id: string; nombre: string };
  tope: number;
  itbmsPorcentaje: number;
}) {
  const router = useRouter();

  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [conItbms, setConItbms] = useState(!cuenta.pide_sin_itbms);
  const [condicion, setCondicion] = useState<CondicionPago>("contado");
  const [notas, setNotas] = useState("");

  const [busca, setBusca] = useState("");
  // Se guarda para qué texto son los resultados, y así saber si están al día
  // sin tener que vaciarlos a mano desde el efecto.
  const [hallazgo, setHallazgo] = useState<{ para: string; productos: Producto[] }>(
    { para: "", productos: [] },
  );
  const [buscando, setBuscando] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{
    url: string;
    codigo: string;
    archivo: File;
  } | null>(null);

  // Si ya lo abrió. No impide mandar —bloquearlo sería tratarlo como a un
  // niño— pero el botón lo dice: «Enviar sin verlo».
  const [visto, setVisto] = useState(false);

  // --- Buscar en el catálogo ------------------------------------------------

  const consulta = busca.trim();

  useEffect(() => {
    if (consulta.length < 2) return;
    let vivo = true;

    const t = setTimeout(async () => {
      const supabase = clienteNavegador();
      const { data } = await supabase.rpc("buscar_productos", {
        p_texto: consulta,
        p_limite: 15,
      });
      if (vivo) setHallazgo({ para: consulta, productos: (data as Producto[]) ?? [] });
    }, 250);

    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [consulta]);

  const hallados = useMemo(
    () => (hallazgo.para === consulta ? hallazgo.productos : []),
    [hallazgo, consulta],
  );

  /**
   * Agregar un producto, con **el precio que ya se le hizo a este cliente**.
   *
   * Es lo que convierte armar una cotización en cosa de un minuto: el mismo
   * rollo se vende a $21.25 y a $29.50 según a quién, así que un precio de
   * lista no sirve. Si nunca lo compró, el campo queda vacío y el vendedor lo
   * teclea de su lista.
   */
  async function agregar(p: Producto) {
    setBuscando(true);
    const supabase = clienteNavegador();

    const { data } = await supabase.rpc("precio_anterior", {
      p_cuenta: cuenta.id,
      p_item: p.item_id,
    });

    const anterior = (data as { precio: string; fecha: string }[] | null)?.[0];

    setRenglones((r) => [
      ...r,
      {
        clave: crypto.randomUUID(),
        itemId: p.item_id,
        nombre: p.nombre,
        unidad: p.unidad,
        cantidad: "1",
        precio: anterior ? String(Number(anterior.precio)) : "",
        desde: anterior
          ? FECHA_CORTA.format(new Date(`${anterior.fecha}T12:00:00Z`))
          : null,
      },
    ]);

    setBusca("");
    setHallazgo({ para: "", productos: [] });
    setBuscando(false);
  }

  function cambiar(clave: string, campo: "cantidad" | "precio", valor: string) {
    setRenglones((r) =>
      r.map((x) => (x.clave === clave ? { ...x, [campo]: valor } : x)),
    );
  }

  // --- Los números ----------------------------------------------------------

  const { subtotal, itbms, total, completos } = useMemo(() => {
    let sub = 0;
    let ok = 0;
    for (const r of renglones) {
      const c = Number(r.cantidad);
      const p = Number(r.precio);
      if (c > 0 && p >= 0 && r.precio !== "") {
        sub += c * p;
        ok += 1;
      }
    }
    const imp = conItbms ? Math.round(sub * itbmsPorcentaje) / 100 : 0;
    return { subtotal: sub, itbms: imp, total: sub + imp, completos: ok };
  }, [renglones, conItbms, itbmsPorcentaje]);

  const pasaElTope = total > tope;
  const faltanPrecios = renglones.length > 0 && completos < renglones.length;

  // --- Emitir ---------------------------------------------------------------

  async function emitir() {
    setGuardando(true);
    setError(null);

    try {
      const supabase = clienteNavegador();
      const id = crypto.randomUUID();
      const ahora = new Date();
      const codigo = codigoDe(id, ahora);

      // Primero la cotización y sus renglones. Si el PDF falla después, queda
      // como borrador y se puede reintentar sin perder lo escrito.
      const { error: falloCot } = await supabase.from("cotizaciones").insert({
        id,
        codigo,
        cuenta_id: cuenta.id,
        vendedor_id: vendedor.id,
        estado: "borrador",
        con_itbms: conItbms,
        itbms_porcentaje: itbmsPorcentaje,
        condicion_pago: condicion,
        subtotal,
        itbms,
        total,
        validez_dias: empresa.validez_dias ?? 15,
        notas: notas.trim() || null,
        created_by: vendedor.id,
      });
      if (falloCot) throw falloCot;

      const { error: falloRen } = await supabase.from("renglones_cotizacion").insert(
        renglones.map((r, i) => ({
          id: crypto.randomUUID(),
          cotizacion_id: id,
          item_id: r.itemId,
          nombre: r.nombre,
          unidad: r.unidad,
          cantidad: Number(r.cantidad),
          precio: Number(r.precio),
          orden: i,
        })),
      );
      if (falloRen) throw falloRen;

      // El logo viaja con la aplicación; se convierte a datos para meterlo.
      const respuesta = await fetch("/logo-papeleria.png");
      const bytes = await respuesta.arrayBuffer();
      const logo =
        "data:image/png;base64," +
        btoa(String.fromCharCode(...new Uint8Array(bytes)));

      const pdf = await generarCotizacion(
        {
          codigo,
          fecha: ahora,
          validezDias: empresa.validez_dias ?? 15,
          cliente: {
            nombre: cuenta.nombre,
            ruc: cuenta.ruc,
            direccion: [cuenta.direccion, cuenta.poblado]
              .filter(Boolean)
              .join(", ") || null,
          },
          vendedor: { nombre: vendedor.nombre },
          renglones: renglones.map((r) => ({
            nombre: r.nombre,
            cantidad: Number(r.cantidad),
            precio: Number(r.precio),
          })),
          conItbms,
          itbmsPorcentaje,
          condicionPago: condicion,
          notas: notas.trim() || null,
        },
        empresa,
        logo,
      );

      const ruta = `${id}/${codigo}.pdf`;
      const { error: falloSubida } = await supabase.storage
        .from("cotizaciones")
        .upload(ruta, pdf, { contentType: "application/pdf" });
      if (falloSubida) throw falloSubida;

      // Aquí es donde la base comprueba el tope. Se deja para el final a
      // propósito: si rebota, no se perdió nada de lo escrito.
      const { error: falloEmitir } = await supabase
        .from("cotizaciones")
        .update({
          estado: "emitida",
          emitida_en: ahora.toISOString(),
          pdf_path: ruta,
        })
        .eq("id", id);
      if (falloEmitir) throw falloEmitir;

      // **No se manda solo.** Antes se abría la hoja de compartir en cuanto
      // terminaba de generarse, y el vendedor acababa mandando por WhatsApp un
      // documento que no había visto. Una cotización es una promesa de precio:
      // un dígito mal puesto lo cobra el cliente, y ya salió de la casa.
      //
      // Se genera, se guarda, y se enseña. Mandar es un segundo gesto, después
      // de mirarlo.
      setListo({
        url: URL.createObjectURL(pdf),
        codigo,
        archivo: new File([pdf], `${codigo}.pdf`, { type: "application/pdf" }),
      });
      router.refresh();
    } catch (e) {
      const m = e as { message?: string };
      setError(m.message ?? "No se pudo emitir la cotización.");
    } finally {
      setGuardando(false);
    }
  }

  /** Mandar por donde el vendedor quiera: correo, WhatsApp, lo que tenga. */
  async function enviar() {
    if (!listo) return;

    if (navigator.canShare?.({ files: [listo.archivo] })) {
      try {
        await navigator.share({
          files: [listo.archivo],
          title: `Cotización ${listo.codigo}`,
          text: `Cotización para ${cuenta.nombre}`,
        });
      } catch {
        // Cancelar no es un error: el documento ya está guardado y se puede
        // reenviar desde el expediente cuando quiera.
      }
      return;
    }

    // Sin hoja de compartir —un escritorio— se abre y desde ahí se guarda.
    window.open(listo.url, "_blank");
  }

  // --- Pantalla -------------------------------------------------------------

  if (listo) {
    return (
      <Tarjeta className="flex flex-col gap-3 border-green-200 bg-green-50">
        <p className="text-base font-semibold text-texto">
          Cotización {listo.codigo}
        </p>
        <p className="text-sm text-texto-secundario">
          Guardada en el expediente de {cuenta.nombre}.
        </p>

        {/* Ver va primero, y con el peso visual: es el paso que hay que dar
            antes de mandar nada. */}
        <a
          href={listo.url}
          target="_blank"
          rel="noopener"
          onClick={() => setVisto(true)}
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-3 text-base font-medium text-white"
        >
          <FileText size={18} aria-hidden />
          Ver el PDF
        </a>

        <p className="text-xs text-texto-secundario">
          Míralo antes de mandarlo: los precios que salgan ahí son una promesa,
          y una vez enviada la cotización sale de la casa.
        </p>

        <Boton tono="secundario" onClick={enviar}>
          <span className="flex items-center justify-center gap-2">
            <Send size={16} aria-hidden />
            {visto ? "Enviar" : "Enviar sin verlo"}
          </span>
        </Boton>

        <Boton
          tono="secundario"
          onClick={() => router.push(`/cuentas/${cuenta.id}`)}
        >
          Volver al cliente
        </Boton>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- Buscar y agregar --- */}
      <Tarjeta className="flex flex-col gap-3">
        <Campo
          etiqueta="Agregar producto"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="rollo termico 80"
          ayuda="Palabras sueltas, sin acentos. Toca el que quieras."
        />

        {buscando && <Cargando texto="Buscando el precio de este cliente" />}

        {hallados.map((p) => (
          <button
            key={p.item_id}
            type="button"
            onClick={() => agregar(p)}
            className="min-h-tactil flex items-center justify-between gap-2 rounded-lg border border-borde px-3 py-2 text-left"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-texto">
              {p.nombre}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-texto-atenuado">
                {Number(p.existencia) > 0 ? `${p.existencia} disp.` : "sin exist."}
              </span>
              <Plus size={16} className="text-marca" aria-hidden />
            </span>
          </button>
        ))}
      </Tarjeta>

      {/* --- Los renglones --- */}
      {renglones.length === 0 ? (
        <Tarjeta>
          <Vacio titulo="Todavía no has puesto nada">
            Busca el producto arriba. Si este cliente ya lo compró, el precio
            sale solo — el suyo, no uno de lista.
          </Vacio>
        </Tarjeta>
      ) : (
        renglones.map((r) => (
          <Tarjeta key={r.clave} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm text-texto">{r.nombre}</p>
              <button
                type="button"
                aria-label="Quitar"
                onClick={() =>
                  setRenglones((x) => x.filter((y) => y.clave !== r.clave))
                }
                className="min-h-tactil w-11 shrink-0 text-texto-atenuado"
              >
                <Trash2 size={16} className="mx-auto" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-3 items-end gap-2">
              <Campo
                etiqueta="Cantidad"
                type="number"
                inputMode="decimal"
                min={0}
                value={r.cantidad}
                onChange={(e) => cambiar(r.clave, "cantidad", e.target.value)}
              />
              <Campo
                etiqueta="Precio"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={r.precio}
                onChange={(e) => cambiar(r.clave, "precio", e.target.value)}
              />
              <p className="pb-2 text-right font-mono text-sm text-texto">
                {r.precio === "" || r.cantidad === ""
                  ? "—"
                  : DINERO.format(Number(r.cantidad) * Number(r.precio))}
              </p>
            </div>

            {r.desde ? (
              <p className="text-xs text-texto-atenuado">
                Es el precio que le hiciste en {r.desde}. Cámbialo si subió.
              </p>
            ) : (
              <p className="text-xs text-aviso">
                Nunca le has vendido este producto: el precio lo pones tú.
              </p>
            )}
          </Tarjeta>
        ))
      )}

      {/* --- Condiciones --- */}
      <Tarjeta className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-texto">Condición de pago</p>
          <div className="mt-2 flex flex-col gap-2">
            {(Object.keys(CONDICIONES) as CondicionPago[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={condicion === c}
                onClick={() => setCondicion(c)}
                className={`min-h-tactil rounded-lg border px-3 text-left text-sm ${
                  condicion === c
                    ? "border-marca bg-marca text-white"
                    : "border-borde bg-superficie text-texto"
                }`}
              >
                {CONDICIONES[c]}
              </button>
            ))}
          </div>
        </div>

        <label className="min-h-tactil flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={conItbms}
            onChange={(e) => setConItbms(e.target.checked)}
            className="size-5"
          />
          Incluir ITBMS del {itbmsPorcentaje}%
        </label>

        {cuenta.pide_sin_itbms && (
          <p className="text-xs text-texto-atenuado">
            Este cliente pide que no se le incluya, por eso viene desmarcado.
          </p>
        )}

        <Campo
          etiqueta="Notas para el cliente"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder={empresa.nota_pie ?? ""}
        />
      </Tarjeta>

      {/* --- Totales y emisión --- */}
      <Tarjeta
        className={`flex flex-col gap-2 ${pasaElTope ? "border-aviso/50 bg-amber-50" : ""}`}
      >
        <div className="flex justify-between text-sm text-texto-secundario">
          <span>Subtotal</span>
          <span className="font-mono">{DINERO.format(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-texto-secundario">
          <span>{conItbms ? `ITBMS ${itbmsPorcentaje}%` : "Sin ITBMS"}</span>
          <span className="font-mono">{DINERO.format(itbms)}</span>
        </div>
        <div className="flex justify-between border-t border-borde pt-2 text-base font-semibold text-texto">
          <span>Total</span>
          <span className="font-mono">{DINERO.format(total)}</span>
        </div>

        {/* El tope se explica antes de que choque, no cuando ya rebotó. */}
        {pasaElTope && (
          <div className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              Pasa de {DINERO.format(tope)}, que es hasta donde puedes cotizar
              directo.
            </p>
            <p className="mt-1">
              Quita renglones, o pídesela a la oficina desde Solicitudes: ahí la
              revisan y la emiten ellos.
            </p>
          </div>
        )}

        {faltanPrecios && !pasaElTope && (
          <p className="text-xs text-aviso">
            Falta ponerle precio a algún renglón.
          </p>
        )}

        {error && <MensajeError titulo="No se pudo emitir" detalle={error} />}

        <Boton
          ancho
          onClick={emitir}
          disabled={
            guardando || renglones.length === 0 || faltanPrecios || pasaElTope
          }
        >
          <span className="flex items-center justify-center gap-2">
            <Send size={16} aria-hidden />
            {guardando ? "Generando" : "Generar la cotización"}
          </span>
        </Boton>

        <p className="text-center text-xs text-texto-atenuado">
          Se guarda en el expediente del cliente. Necesitas señal para esto.
        </p>
      </Tarjeta>
    </div>
  );
}
