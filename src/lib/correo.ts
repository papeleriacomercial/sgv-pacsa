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

/** Un correo listo, sin decidir todavía con qué aplicación se abre. */
export type Correo = { para: string; asunto: string; cuerpo: string };

function armar(para: string, asunto: string, cuerpo: string): Correo {
  return { para, asunto, cuerpo };
}

/** El camino de siempre: se lo lleva la aplicación de correo por omisión del teléfono. */
export function enlaceMailto({ para, asunto, cuerpo }: Correo) {
  return (
    `mailto:${para}` +
    `?subject=${encodeURIComponent(asunto)}` +
    `&body=${encodeURIComponent(cuerpo)}`
  );
}

/**
 * El camino que **salta la aplicación por omisión y abre Gmail**.
 *
 * Hizo falta porque pasó: un iPhone con Apple Mail por omisión mandó una cotización desde una
 * cuenta de iCloud personal. El sistema nunca vio esa dirección ni pudo elegirla — `mailto:` le
 * entrega el correo al teléfono y el teléfono usa **su** cuenta configurada.
 *
 * Con este esquema el correo se abre en Gmail aunque Apple Mail siga siendo el de omisión.
 */
export function enlaceGmail({ para, asunto, cuerpo }: Correo) {
  return (
    `googlegmail:///co?to=${encodeURIComponent(para)}` +
    `&subject=${encodeURIComponent(asunto)}` +
    `&body=${encodeURIComponent(cuerpo)}`
  );
}

export type DatosDeCuenta = {
  nombre: string;
  ruc?: string | null;
  corregimiento?: string | null;
  distrito?: string | null;
  provincia?: string | null;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  /** Para que la oficina pueda saltar del correo al expediente. */
  url?: string;
};

/**
 * Dónde queda, escrito para alguien que no conoce el sitio.
 *
 * **Los tres niveles, y no sólo el corregimiento.** Al principio el correo llevaba únicamente el
 * fino, y el usuario lo cazó leyendo uno real: decía «Carlos Santana Ávila» —que es un
 * corregimiento de Santiago, con nombre de persona— y a quien lo recibe eso no le ubica nada. El
 * expediente ya mostraba los tres; el correo se había quedado corto.
 *
 * Cuando el corregimiento se llama igual que su distrito no se repite: «Aguadulce, Coclé» y no
 * «Aguadulce · Aguadulce, Coclé».
 */
function dondeQueda(c: DatosDeCuenta): string | null {
  if (!c.distrito) return c.corregimiento ?? null;

  const grueso = c.provincia ? `${c.distrito}, ${c.provincia}` : c.distrito;
  return c.corregimiento && c.corregimiento !== c.distrito
    ? `${c.corregimiento} · ${grueso}`
    : grueso;
}

/**
 * Lo que va en el asunto, que es lo que se lee de reojo en la bandeja.
 *
 * **El distrito y no el corregimiento**, porque el asunto se escanea: «Santiago» lo ubica
 * cualquiera, «Carlos Santana Ávila» no. El detalle completo va en el cuerpo.
 */
function dondeCorto(c: DatosDeCuenta): string {
  const sitio = c.distrito ?? c.corregimiento;
  return sitio ? ` (${sitio})` : "";
}

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
  const donde = dondeCorto(cuenta);
  const asunto = `${rotulo} — ${cuenta.nombre}${donde} — ${vendedor}`;

  const contacto = [cuenta.contactoNombre, cuenta.contactoTelefono]
    .filter(Boolean)
    .join(" · ");

  const cuerpo =
    `${rotulo.toUpperCase()}\n\n` +
    renglon("Cliente", cuenta.nombre) +
    renglon("RUC", cuenta.ruc) +
    renglon("Contacto", contacto || null) +
    renglon("Dónde", dondeQueda(cuenta)) +
    renglon("Vendedor", vendedor) +
    `\nLo que pide:\n${detalle.trim()}\n` +
    (monto ? `\nMonto estimado: ${DINERO.format(monto)}\n` : "") +
    (paraCuando
      ? `Para cuándo: ${FECHA.format(new Date(`${paraCuando}T12:00:00`))}\n`
      : "") +
    (cuenta.url ? `\nExpediente: ${cuenta.url}\n` : "") +
    `\n— Generado por el SGV. Revisa que el correo salga de tu bandeja.`;

  return armar(CORREO_DESTINO[tipo], asunto, cuerpo);
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
  const donde = dondeCorto(cuenta);
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
    renglon("Dónde", dondeQueda(cuenta)) +
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

  return armar(CORREO_DESTINO[tipo], asunto, encabezado + detalle + pie);
}

/**
 * Cuánto se espera a que Gmail responda antes de rendirse.
 *
 * Si el teléfono abre Gmail, esta pestaña se oculta y el reloj se cancela. Si Gmail no está
 * instalada, no pasa nada de nada —ni error ni aviso— así que la única señal de que falló es que
 * **seguimos aquí**. Segundo y medio: suficiente para que un teléfono lento alcance a cambiar de
 * aplicación, y poco para que el vendedor no crea que el botón no hizo nada.
 */
const ESPERA_POR_GMAIL = 1500;

/**
 * Abre el correo, prefiriendo Gmail.
 *
 * **Intenta Gmail y cae al correo por omisión si no está.** Se usa `location.href` y no una
 * ventana nueva: `window.open` con `mailto` deja una pestaña en blanco abierta en algunos
 * navegadores, y el vendedor vuelve del correo a una pantalla vacía.
 *
 * **Lo que esto NO puede hacer, y conviene saberlo:** si el vendedor no tiene la aplicación de
 * Gmail y lee su Gmail desde Apple Mail, el correo saldrá de la cuenta que Apple Mail tenga por
 * omisión. Desde la web no hay forma de elegir la cuenta remitente. El arreglo definitivo es del
 * teléfono —Ajustes › Aplicaciones › Mail › Aplicación de correo por omisión› Gmail— y por eso la
 * pantalla dice desde qué cuenta debería salir: para que la discrepancia se vea en el acto.
 */
export function abrirCorreo(correo: Correo) {
  const porOmision = enlaceMailto(correo);

  const reloj = setTimeout(() => {
    window.location.href = porOmision;
  }, ESPERA_POR_GMAIL);

  // Si el teléfono se fue a Gmail, esta pestaña pasa a segundo plano: se cancela la caída.
  const alOcultarse = () => {
    if (document.hidden) {
      clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alOcultarse);
    }
  };
  document.addEventListener("visibilitychange", alOcultarse);

  window.location.href = enlaceGmail(correo);
}
