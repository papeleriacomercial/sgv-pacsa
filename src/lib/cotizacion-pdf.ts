import { jsPDF } from "jspdf";

export type Empresa = {
  nombre: string;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  web: string | null;
  terminos: string | null;
  nota_pie: string | null;
  validez_dias?: number | null;
};

export type Renglon = {
  nombre: string;
  cantidad: number;
  precio: number;
};

export type Cotizacion = {
  codigo: string;
  fecha: Date;
  validezDias: number;
  cliente: { nombre: string; ruc: string | null; direccion: string | null };
  vendedor: { nombre: string; telefono?: string | null };
  renglones: Renglon[];
  conItbms: boolean;
  itbmsPorcentaje: number;
  condicionPago: CondicionPago;
  notas: string | null;
};

export type CondicionPago = "contado" | "abono_50" | "credito_30";

/**
 * Cómo se paga, en las palabras de la casa.
 *
 * Al leer la plantilla di por hecho que los términos eran un párrafo igual
 * para todos. No lo son: son tres opciones, y cada cotización lleva la que
 * se acordó. Ponerlas las tres en el pie dejaría al cliente eligiendo la que
 * más le convenga.
 */
export const CONDICIONES: Record<CondicionPago, string> = {
  contado: "Contado",
  abono_50: "Contado. 50% Abono, 50% Contra Entrega",
  credito_30: "Crédito 30 días",
};

// Medidas en milímetros sobre carta, tomadas de la plantilla de la oficina.
const ANCHO = 216;
const MARGEN = 12;
const DERECHA = ANCHO - MARGEN;

// Las columnas de la tabla, en el mismo orden y proporción que la plantilla.
const COL_CANT = 132;
const COL_TARIFA = 158;
const COL_TOTAL = DERECHA;

// Alto de cada línea dentro de una descripción, y el aire a cada lado de la
// raya que separa filas. Explícitos porque de ellos depende que la raya caiga
// en el hueco y no encima del texto.
const INTERLINEA = 4;
const AIRE_ABAJO = 2.5;
const AIRE_ARRIBA = 4;

const TINTA = [60, 61, 58] as const;
const SUAVE = [120, 122, 118] as const;
const LINEA = [200, 200, 198] as const;
const FONDO = [245, 244, 243] as const;

const DINERO = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * La fecha en día/mes/año, armada a mano.
 *
 * `Intl` con `es-PA` debería bastar, pero **no siempre está esa configuración
 * regional**: en un tiempo de ejecución sin los datos completos cae a inglés y
 * escribe 08/26/2026 en un documento panameño. Armarla por partes cuesta tres
 * líneas y no depende de qué tenga instalado el teléfono.
 */
const PARTES = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Panama",
});

function fecha(d: Date): string {
  const [anio, mes, dia] = PARTES.format(d).split("-");
  return `${dia}/${mes}/${anio}`;
}

const UNIDADES = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho",
  "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
  "diecisiete", "dieciocho", "diecinueve", "veinte",
];
const DECENAS = [
  "", "", "veinti", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta",
  "ochenta", "noventa",
];
const CIENTOS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

/**
 * El importe en letras, que la plantilla de la oficina lleva.
 *
 * No es adorno: es lo que hace que un número no se pueda alterar a mano
 * después de impreso, y por eso está en cualquier documento comercial serio.
 */
function enLetras(n: number): string {
  const entero = Math.floor(n);
  const centavos = Math.round((n - entero) * 100);

  const tres = (x: number): string => {
    if (x === 0) return "";
    if (x === 100) return "cien";
    const c = Math.floor(x / 100);
    const r = x % 100;
    const resto =
      r <= 20
        ? UNIDADES[r]
        : r < 30
          ? DECENAS[2] + UNIDADES[r - 20]
          : DECENAS[Math.floor(r / 10)] + (r % 10 ? " y " + UNIDADES[r % 10] : "");
    return (CIENTOS[c] + " " + resto).trim();
  };

  let texto: string;
  if (entero === 0) texto = "cero";
  else if (entero < 1000) texto = tres(entero);
  else {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    texto =
      (miles === 1 ? "mil" : tres(miles) + " mil") +
      (resto ? " " + tres(resto) : "");
  }

  const capital = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${capital} con ${String(centavos).padStart(2, "0")}/100 balboas`;
}

/**
 * La cotización, en el formato de la casa.
 *
 * Sigue la plantilla que emite la oficina —encabezado, «Cotizado a», la tabla
 * con Descripción · Cant. · Tarifa · Cantidad, totales, importe en letras y
 * términos— porque el cliente puede recibir el martes una del vendedor y el
 * jueves una de la oficina. **Si no se parecen, lo que percibe es desorden.**
 *
 * Lo único que se distingue a propósito es el código: `COT-260826-A7F3` contra
 * el correlativo de Zoho. Dentro de la casa nunca hay duda de cuál salió de
 * dónde.
 */
export async function generarCotizacion(
  c: Cotizacion,
  empresa: Empresa,
  logo?: string,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.setFont("helvetica");

  let y = MARGEN;

  // --- Encabezado: la casa a la izquierda, el título a la derecha ----------

  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGEN, y, 42, 14.4);
    } catch {
      /* sin logo se sigue: el documento vale igual */
    }
  }

  doc.setFontSize(19);
  doc.setTextColor(...TINTA);
  doc.text("Cotización", DERECHA, y + 8, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(...SUAVE);
  doc.text(c.codigo, DERECHA, y + 13, { align: "right" });

  y += 20;

  doc.setFontSize(9.5);
  doc.setTextColor(...TINTA);
  doc.text(empresa.nombre, MARGEN, y);

  y += 4.5;
  doc.setFontSize(8);
  doc.setTextColor(...SUAVE);
  for (const linea of [
    empresa.ruc ? `RUC ${empresa.ruc}` : null,
    empresa.direccion,
    empresa.telefono ? `Teléfono ${empresa.telefono}` : null,
    empresa.correo,
    empresa.web,
  ].filter(Boolean) as string[]) {
    for (const trozo of doc.splitTextToSize(linea, 95)) {
      doc.text(trozo, MARGEN, y);
      y += 3.8;
    }
  }

  // --- A quién, y los datos del documento ----------------------------------

  const yBloque = MARGEN + 24;

  doc.setFontSize(9);
  doc.setTextColor(...SUAVE);
  doc.text("Cotizado a", MARGEN, Math.max(y, yBloque) + 6);

  let yCliente = Math.max(y, yBloque) + 12;
  doc.setFontSize(13);
  doc.setTextColor(...TINTA);
  doc.text(c.cliente.nombre, MARGEN, yCliente);

  yCliente += 5;
  doc.setFontSize(8);
  doc.setTextColor(...SUAVE);
  for (const linea of [
    c.cliente.ruc ? `RUC ${c.cliente.ruc}` : null,
    c.cliente.direccion,
  ].filter(Boolean) as string[]) {
    for (const trozo of doc.splitTextToSize(linea, 95)) {
      doc.text(trozo, MARGEN, yCliente);
      yCliente += 3.8;
    }
  }

  const vence = new Date(c.fecha);
  vence.setDate(vence.getDate() + c.validezDias);

  let yDatos = Math.max(y, yBloque) + 6;
  doc.setFontSize(8.5);
  for (const [etiqueta, valor] of [
    ["Fecha de cotización", fecha(c.fecha)],
    ["Válida hasta", fecha(vence)],
    ["Vendedor", c.vendedor.nombre],
  ] as const) {
    doc.setTextColor(...SUAVE);
    doc.text(etiqueta, 130, yDatos);
    doc.setTextColor(...TINTA);
    doc.text(valor, DERECHA, yDatos, { align: "right" });
    yDatos += 5;
  }
  if (c.vendedor.telefono) {
    doc.setTextColor(...SUAVE);
    doc.text(`Cel. ${c.vendedor.telefono}`, DERECHA, yDatos, { align: "right" });
    yDatos += 5;
  }

  y = Math.max(yCliente, yDatos) + 8;

  // --- La tabla ------------------------------------------------------------

  doc.setFillColor(...FONDO);
  doc.rect(MARGEN, y - 4, DERECHA - MARGEN, 7, "F");

  doc.setFontSize(8.5);
  doc.setTextColor(...SUAVE);
  doc.text("Descripción", MARGEN + 2, y);
  doc.text("Cant.", COL_CANT, y, { align: "right" });
  doc.text("Tarifa", COL_TARIFA, y, { align: "right" });
  doc.text("Cantidad", COL_TOTAL - 2, y, { align: "right" });

  y += 7;
  doc.setFontSize(8);

  let subtotal = 0;
  for (const r of c.renglones) {
    const total = r.cantidad * r.precio;
    subtotal += total;

    const lineas = doc.splitTextToSize(r.nombre, 112) as string[];

    // Si el renglón no cabe, hoja nueva con su encabezado de tabla.
    if (y + lineas.length * INTERLINEA > 250) {
      doc.addPage();
      y = MARGEN + 8;
      doc.setFillColor(...FONDO);
      doc.rect(MARGEN, y - 4, DERECHA - MARGEN, 7, "F");
      doc.setTextColor(...SUAVE);
      doc.text("Descripción", MARGEN + 2, y);
      doc.text("Cant.", COL_CANT, y, { align: "right" });
      doc.text("Tarifa", COL_TARIFA, y, { align: "right" });
      doc.text("Cantidad", COL_TOTAL - 2, y, { align: "right" });
      y += 7;
    }

    doc.setTextColor(...TINTA);
    lineas.forEach((linea, i) => doc.text(linea, MARGEN + 2, y + i * INTERLINEA));
    doc.text(String(r.cantidad), COL_CANT, y, { align: "right" });
    doc.text(DINERO.format(r.precio), COL_TARIFA, y, { align: "right" });
    doc.text(DINERO.format(total), COL_TOTAL - 2, y, { align: "right" });

    // **La raya va en el hueco entre filas, y hay que ponerla ahí a mano.**
    // Antes se avanzaba la `y` a la fila siguiente y se dibujaba restando 1,5:
    // eso la dejaba 1,5 mm por encima de esa línea base, o sea atravesando las
    // mayúsculas del renglón de abajo. Lo delataba la geometría del PDF, no la
    // vista: en pantalla parecía un subrayado.
    y += (lineas.length - 1) * INTERLINEA; // línea base de la última línea
    y += AIRE_ABAJO;

    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.1);
    doc.line(MARGEN, y, DERECHA, y);

    y += AIRE_ARRIBA; // línea base de la fila siguiente
  }

  // --- Totales -------------------------------------------------------------

  const itbms = c.conItbms ? Math.round(subtotal * c.itbmsPorcentaje) / 100 : 0;
  const total = subtotal + itbms;

  y += 4;
  doc.setFontSize(8.5);
  for (const [etiqueta, valor, fuerte] of [
    ["Subtotal", subtotal, false],
    [
      c.conItbms ? `ITBMS ${c.itbmsPorcentaje}%` : "ITBMS no aplica",
      itbms,
      false,
    ],
    ["Total", total, true],
  ] as const) {
    doc.setFontSize(fuerte ? 10.5 : 8.5);
    const tono = fuerte ? TINTA : SUAVE;
    doc.setTextColor(tono[0], tono[1], tono[2]);
    doc.text(etiqueta, COL_TARIFA, y, { align: "right" });
    doc.setTextColor(...TINTA);
    doc.text(DINERO.format(valor), COL_TOTAL - 2, y, { align: "right" });
    y += fuerte ? 7 : 5;
  }

  doc.setFontSize(8);
  doc.setTextColor(...SUAVE);
  doc.text("Importe en letras", MARGEN, y);
  doc.setTextColor(...TINTA);
  doc.text(enLetras(total), MARGEN + 32, y);
  y += 9;

  // --- Notas y términos ----------------------------------------------------

  const pie = (titulo: string, cuerpo: string | null) => {
    if (!cuerpo?.trim()) return;
    doc.setFontSize(9);
    doc.setTextColor(...TINTA);
    doc.text(titulo, MARGEN, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    for (const parrafo of cuerpo.split("\n")) {
      for (const linea of doc.splitTextToSize(parrafo, DERECHA - MARGEN) as string[]) {
        doc.text(linea, MARGEN, y);
        y += 3.6;
      }
    }
    y += 5;
  };

  pie("Notas", c.notas ?? empresa.nota_pie);

  // La condición acordada va primero y en su propia línea: es lo que el
  // cliente busca cuando recibe el papel.
  pie(
    "Términos y condiciones",
    [CONDICIONES[c.condicionPago], empresa.terminos]
      .filter(Boolean)
      .join("\n"),
  );

  // Que quede claro qué es esto y qué no es. Sin esta línea, un documento con
  // el logo de la casa y un total se puede confundir con una factura.
  doc.setFontSize(7);
  doc.setTextColor(...SUAVE);
  doc.text(
    "Este documento es una cotización y no constituye factura.",
    MARGEN,
    272,
  );

  return doc.output("blob");
}
