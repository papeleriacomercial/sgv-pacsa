/**
 * Etiquetas de los catálogos cerrados de la base.
 *
 * Los valores son los del enum de Postgres; las etiquetas son lo que ve el
 * vendedor. Este archivo es el único lugar donde se traducen: si una etiqueta
 * vive en dos pantallas, en tres meses dicen cosas distintas.
 *
 * Ver docs/02-modelo-datos.md.
 */

export const ETAPAS = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  cotizado: "Cotizado",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
} as const;

export type Etapa = keyof typeof ETAPAS;

export const RESULTADOS = {
  no_estaba_encargado: "No estaba el encargado",
  pide_cotizacion: "Interesado, pide cotización",
  pide_muestra: "Interesado, pide muestra",
  stock_suficiente: "Interesado pero mantiene stock suficiente",
  quiere_precio: "Tiene proveedor, quiere precio",
  no_usa_productos: "No usa nuestros productos",
  sin_interes: "Sin interés",
  local_cerrado: "Local cerrado o no existe",
  dejo_informacion: "Solo dejé información",
} as const;

export type Resultado = keyof typeof RESULTADOS;

/**
 * Resultados que obligan a fijar fecha de recontacto.
 *
 * La base no puede imponerlo aquí: la fecha vive en `compromisos`, otra tabla,
 * y un `check` no mira más allá de su fila. Lo obliga esta pantalla.
 * Ver docs/02-modelo-datos.md.
 */
export const RESULTADOS_CON_RECONTACTO: Resultado[] = ["stock_suficiente"];

/**
 * Resultados que cierran la conversación.
 *
 * §6 obliga a que todo seguimiento deje un próximo paso, y esa regla es la que
 * evita que una cuenta se apague sin que nadie lo note. Pero con estos tres
 * resultados el próximo paso sería inventado: pedirle una fecha futura a quien
 * acaba de encontrar el local cerrado enseña a escribir cualquier cosa con tal
 * de guardar. Aquí —y solo aquí— el próximo paso es opcional.
 *
 * Son además los que presugieren descartar la cuenta cuando estaba sin
 * clasificar.
 */
export const RESULTADOS_TERMINALES: Resultado[] = [
  "local_cerrado",
  "no_usa_productos",
  "sin_interes",
];

/** Qué motivo de descarte propone cada resultado terminal. */
export const DESCARTE_SUGERIDO: Partial<Record<Resultado, MotivoDescarte>> = {
  local_cerrado: "no_existe",
  no_usa_productos: "no_usa_productos",
  sin_interes: "sin_interes",
};

export const MOTIVOS_PERDIDA = {
  precio: "Precio o mejor oferta de la competencia",
  espera_licitacion: "Esperar fecha de licitación",
  no_cumple_especificaciones: "Producto no cumple especificaciones",
  sin_interes_real: "Sin interés real",
  no_contactar: "No volver a contactar",
} as const;

export type MotivoPerdida = keyof typeof MOTIVOS_PERDIDA;

/** Motivos que devuelven el punto a la lista de trabajo en una fecha concreta. */
export const MOTIVOS_CON_RECONTACTO: MotivoPerdida[] = [
  "precio",
  "espera_licitacion",
];

export const TIPOS_INTERACCION = {
  visita: "Visita",
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  correo: "Correo",
  entrega_muestra: "Entrega de muestra",
} as const;

export type TipoInteraccion = keyof typeof TIPOS_INTERACCION;

export const LINEAS_PRODUCTO = {
  rollos_fiscales: "Rollos fiscales",
  bolsas_papel: "Bolsas de papel",
  papel_antigrasa: "Papel antigrasa",
  tubos_carton: "Tubos de cartón",
  otros: "Otros",
} as const;

export type LineaProducto = keyof typeof LINEAS_PRODUCTO;

export const ORIGENES = {
  calle: "En la calle",
  busqueda: "Búsqueda de directorio",
  referido: "Referido",
  llamada_entrante: "Llamada entrante",
  otro: "Otro",
} as const;

export type Origen = keyof typeof ORIGENES;

/** Tono de insignia para cada etapa. El color significa estado (§17). */
export const TONO_ETAPA: Record<Etapa, "ok" | "aviso" | "error" | "info" | "neutro"> = {
  nuevo: "neutro",
  contactado: "info",
  cotizado: "info",
  negociacion: "aviso",
  ganado: "ok",
  perdido: "error",
};

/**
 * Categorías de búsqueda (§7.4).
 *
 * A la izquierda, cómo piensa el negocio. A la derecha, los tipos que entiende
 * Google. **No son lo mismo y la traducción hay que revisarla con los
 * vendedores**: Google no distingue una pulpería de un minisúper, y mete las
 * dos en `convenience_store`.
 */
export const CATEGORIAS = {
  supermercado: { etiqueta: "Supermercado", tipos: ["supermarket"] },
  minisuper: { etiqueta: "Minisúper o pulpería", tipos: ["convenience_store"] },
  restaurante: { etiqueta: "Restaurante", tipos: ["restaurant"] },
  farmacia: { etiqueta: "Farmacia", tipos: ["pharmacy"] },
  panaderia: { etiqueta: "Panadería", tipos: ["bakery"] },
} as const;

export type Categoria = keyof typeof CATEGORIAS;

export const ETIQUETAS_CATEGORIA = Object.fromEntries(
  Object.entries(CATEGORIAS).map(([clave, { etiqueta }]) => [clave, etiqueta]),
) as Record<Categoria, string>;

export const MOTIVOS_DESCARTE = {
  no_existe: "No existe o está cerrado",
  muy_pequeno: "Muy pequeño, no alcanza pedido mínimo",
  no_usa_productos: "No usa nuestros productos",
  sin_interes: "Escuchó y no le interesó",
  ya_atendido: "Ya lo atiende la casa",
  otro: "Otro motivo",
} as const;

export type MotivoDescarte = keyof typeof MOTIVOS_DESCARTE;

/**
 * Ciclo de vida de la cuenta (plan v2).
 *
 *   sin_clasificar → prospecto → cliente
 *                 ↘ descartada
 *
 * Una cuenta creada desde la oficina, planificando sobre el mapa, nace
 * **sin clasificar**: nadie la ha visitado ni contactado, y llamarla prospecto
 * afirma algo que no ocurrió. El primer seguimiento la resuelve: o pasa a
 * prospecto, o se descarta con su motivo.
 *
 * De prospecto a cliente lo marca el vendedor; cuando exista la integración,
 * Zoho lo confirma o lo corrige. Ver D-010.
 */
export const TIPOS_CUENTA = {
  sin_clasificar: "Sin clasificar",
  prospecto: "Prospecto",
  cliente: "Cliente",
  descartada: "Descartada",
} as const;

export type TipoCuenta = keyof typeof TIPOS_CUENTA;

/**
 * El tono es estado, no decoración (§17).
 *
 * "Sin clasificar" va en aviso porque es trabajo pendiente, no un estado
 * estable: alguien tiene que ir a verla. "Descartada" va en neutro y no en
 * error: no es una falla, es una cuenta cerrada con su explicación.
 */
export const TONO_TIPO: Record<TipoCuenta, "ok" | "aviso" | "info" | "neutro"> = {
  sin_clasificar: "aviso",
  prospecto: "info",
  cliente: "ok",
  descartada: "neutro",
};

/** Cuentas que siguen en juego. Las descartadas no estorban el trabajo del día. */
export const TIPOS_VIVOS: TipoCuenta[] = ["sin_clasificar", "prospecto", "cliente"];

/** Volumen estimado por el vendedor (plan v2, Etapa 2). */
export const VOLUMENES = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
} as const;

export type Volumen = keyof typeof VOLUMENES;

export const TONO_VOLUMEN: Record<Volumen, "ok" | "info" | "neutro"> = {
  alta: "ok",
  media: "info",
  baja: "neutro",
};

/**
 * Cadencias sugeridas, en días.
 *
 * "Días sin contacto" por sí solo no dice si algo está bien: 20 días sin ver a
 * un restaurante que recompra cada 15 es una alarma; a una oficina que compra
 * cada tres meses, es normal. La cadencia es contra qué se mide.
 */
export const CADENCIAS = [
  { dias: 7, etiqueta: "Semanal" },
  { dias: 15, etiqueta: "Quincenal" },
  { dias: 30, etiqueta: "Mensual" },
  { dias: 90, etiqueta: "Trimestral" },
];
