// El correo que la aplicación le deja escrito al vendedor.
//
// **Decisión del 13 de septiembre de 2026 (D-071): la oficina sale del sistema.** Verónica y
// gerencia dejan de tener bandeja; las solicitudes viajan por correo, como antes de que existiera
// el SGV. Lo que cambia es que ya nadie las escribe a mano.
//
// ============================================================================================
// POR QUÉ SE ABRE SU GMAIL Y NO LO MANDA LA APLICACIÓN
// ============================================================================================
//
// Se evaluaron las tres formas. La que manda el correo desde un servidor da constancia de envío y
// permite adjuntar el PDF, pero exige una contraseña de aplicación guardada, una ruta que
// mantener, y hace que el correo llegue de un remitente nuevo. La hoja de compartir del teléfono
// lleva el archivo de verdad, **pero no deja fijar el destinatario y ni siquiera dice qué escogió
// el vendedor** — podría mandarle al cliente lo que iba a la oficina.
//
// Se escogió abrir su propio Gmail con todo escrito, y la razón de fondo la dio el usuario:
// **«Verónica no tendrá confusión de a quién responderle»**. El correo sale de la dirección del
// vendedor, así que responder es apretar «Responder». Eso ninguna de las otras dos lo da.
//
// **El precio está aceptado como política, no como descuido:** la aplicación no puede saber si el
// correo salió. *«El vendedor deberá asegurarse a través de su aplicación de Gmail que el correo
// fue enviado o no; no queda en manos de la aplicación.»*
//
// El PDF viaja como **enlace y no como adjunto**, porque `mailto` no admite archivos. Es un enlace
// firmado que dura un año: Verónica lo abre, lo imprime, y puede volver a abrirlo meses después si
// el cliente reclama — sin tener cuenta en el sistema.

/**
 * A dónde va cada clase de encargo.
 *
 * **Son las direcciones que la oficina ya usaba antes del SGV**, no unas nuevas: el objetivo del
 * cambio es que nadie tenga que aprender nada. Las muestras van con las cotizaciones porque las
 * atiende la misma persona.
 */
export const CORREO_DESTINO = {
  cotizacion: "papeleria.comercial.cotizaciones@gmail.com",
  muestra: "papeleria.comercial.cotizaciones@gmail.com",
  pedido: "papeleria.comercial.ordenes@gmail.com",
  orden_venta: "papeleria.comercial.ordenes@gmail.com",
  precio: "papeleria.comercial@gmail.com",
} as const;

export type DestinoCorreo = keyof typeof CORREO_DESTINO;

/** Un año. Lo pidió el usuario para poder reabrir el documento cuando un cliente reclame. */
export const DURACION_DEL_ENLACE = 60 * 60 * 24 * 365;

/**
 * Hasta dónde se escribe el detalle en el cuerpo.
 *
 * `mailto` no tiene un límite de norma, pero los teléfonos y los clientes de correo cortan por
 * su cuenta alrededor de los dos mil caracteres, **y cortan en silencio**. Con quince o veinte
 * renglones un pedido pasa de ahí, así que el cuerpo lleva el resumen y el enlace, y el detalle
 * completo vive en el documento. Más vale un correo corto y entero que uno largo y mutilado.
 */
const TOPE_DEL_CUERPO = 1600;

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

const FECHA = new Intl.DateTimeFormat("es-PA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Panama",
});

function renglon(etiqueta: string, valor: string | null | undefined) {
  return valor ? `${etiqueta}: ${valor}\n` : "";
}

/** Arma la dirección `mailto:` con todo puesto. Abrirla es cosa de quien la llame. */
function mailto(para: string, asunto: string, cuerpo: string) {
  return (
    `mailto:${para}` +
    `?subject=${encodeURIComponent(asunto)}` +
    `&body=${encodeURIComponent(cuerpo)}`
  );
}

export type DatosDeCuenta = {
  nombre: string;
  ruc?: string | null;
  poblado?: string | null;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  /** Para que la oficina pueda saltar del correo al expediente. */
  url?: string;
};

/**
 * El correo de una muestra o de un precio especial — lo que se pide con el formulario.
 *
 * No lleva documento porque no hay ninguno todavía: **el cuerpo es todo el contenido**, y por eso
 * el detalle que escribió el vendedor va entero y sin recortar.
 */
export function correoDeSolicitud({
  tipo,
  rotulo,
  cuenta,
  vendedor,
  detalle,
  monto,
  paraCuando,
}: {
  tipo: "muestra" | "precio";
  /** Cómo se llama el tipo en la interfaz, para que el asunto hable el mismo idioma. */
  rotulo: string;
  cuenta: DatosDeCuenta;
  vendedor: string;
  detalle: string;
  monto?: number | null;
  paraCuando?: string | null;
}) {
  const donde = cuenta.poblado ? ` (${cuenta.poblado})` : "";
  const asunto = `${rotulo} — ${cuenta.nombre}${donde} — ${vendedor}`;

  const contacto = [cuenta.contactoNombre, cuenta.contactoTelefono]
    .filter(Boolean)
    .join(" · ");

  const cuerpo =
    `${rotulo.toUpperCase()}\n\n` +
    renglon("Cliente", cuenta.nombre) +
    renglon("RUC", cuenta.ruc) +
    renglon("Contacto", contacto || null) +
    renglon("Dónde", cuenta.poblado) +
    renglon("Vendedor", vendedor) +
    `\nLo que pide:\n${detalle.trim()}\n` +
    (monto ? `\nMonto estimado: ${DINERO.format(monto)}\n` : "") +
    (paraCuando
      ? `Para cuándo: ${FECHA.format(new Date(`${paraCuando}T12:00:00`))}\n`
      : "") +
    (cuenta.url ? `\nExpediente: ${cuenta.url}\n` : "") +
    `\n— Generado por el SGV. Revisa que el correo salga de tu bandeja.`;

  return mailto(CORREO_DESTINO[tipo], asunto, cuerpo);
}

/**
 * El correo de una cotización o una orden ya armada — lo que nace del documento.
 *
 * Aquí sí hay PDF, y va como enlace. **El detalle se recorta si hace falta** y el enlace nunca,
 * porque sin el enlace el correo no sirve para nada y sin dos renglones de detalle sí sirve.
 */
export function correoDeDocumento({
  tipo,
  rotulo,
  codigo,
  cuenta,
  vendedor,
  renglones,
  total,
  condicion,
  notas,
  enlace,
}: {
  tipo: "cotizacion" | "orden_venta";
  rotulo: string;
  codigo: string;
  cuenta: DatosDeCuenta;
  vendedor: string;
  renglones: { cantidad: number; unidad?: string | null; nombre: string }[];
  total: number;
  condicion?: string | null;
  notas?: string | null;
  /** Enlace firmado al PDF. Si no se pudo generar va vacío y el cuerpo lo dice. */
  enlace: string | null;
}) {
  const donde = cuenta.poblado ? ` (${cuenta.poblado})` : "";
  const asunto = `${rotulo} ${codigo} — ${cuenta.nombre}${donde} — ${vendedor}`;

  const contacto = [cuenta.contactoNombre, cuenta.contactoTelefono]
    .filter(Boolean)
    .join(" · ");

  const lista = renglones
    .map(
      (r) =>
        `  ${r.cantidad} ${r.unidad ?? "und"} — ${r.nombre}`.slice(0, 90),
    )
    .join("\n");

  const encabezado =
    `${rotulo.toUpperCase()} ${codigo}\n\n` +
    renglon("Cliente", cuenta.nombre) +
    renglon("RUC", cuenta.ruc) +
    renglon("Contacto", contacto || null) +
    renglon("Dónde", cuenta.poblado) +
    renglon("Vendedor", vendedor) +
    renglon("Condición", condicion);

  const pie =
    `\nTotal: ${DINERO.format(total)}  (${renglones.length} ${
      renglones.length === 1 ? "renglón" : "renglones"
    })\n` +
    (notas?.trim() ? `\nNota del vendedor:\n${notas.trim()}\n` : "") +
    (enlace
      ? `\nVer el documento (enlace válido por un año):\n${enlace}\n`
      : `\nEl documento está en el expediente del cliente, en el SGV.\n`) +
    (cuenta.url ? `\nExpediente: ${cuenta.url}\n` : "") +
    `\n— Generado por el SGV. Revisa que el correo salga de tu bandeja.`;

  // El detalle es lo único que se puede recortar sin romper el correo.
  const espacio = TOPE_DEL_CUERPO - encabezado.length - pie.length;
  const detalle =
    lista.length <= espacio
      ? `\nLo que lleva:\n${lista}\n`
      : `\nLo que lleva: ${renglones.length} renglones — el detalle completo va en el documento.\n`;

  return mailto(CORREO_DESTINO[tipo], asunto, encabezado + detalle + pie);
}

/**
 * Abre el correo en la aplicación del teléfono.
 *
 * Se usa `location.href` y no una ventana nueva: `window.open` con `mailto` deja una pestaña en
 * blanco abierta en algunos navegadores, y el vendedor vuelve del correo a una pantalla vacía.
 */
export function abrirCorreo(direccion: string) {
  window.location.href = direccion;
}
