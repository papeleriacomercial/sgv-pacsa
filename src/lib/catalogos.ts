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
  compro: "Compró",
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
/** Con este resultado la visita terminó en venta: se pide el pedido y la cuenta pasa a cliente. */
export const RESULTADO_VENTA: Resultado = "compro";

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
  reunion: "Reunión",
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
 * Lo que le llega al vendedor y necesita que alguien más actúe.
 *
 * No es un seguimiento: un seguimiento es algo que él hizo o prometió. Esto es
 * un encargo con destinatario y con reloj. Si cae en la agenda se pierde entre
 * lo suyo y nadie de la oficina se entera de que hay un pedido esperando.
 */
export const TIPOS_SOLICITUD = {
  pedido: "Pedido",
  cotizacion: "Cotización",
  muestra: "Muestra",
  precio: "Precio o condición especial",
} as const;

export type TipoSolicitud = keyof typeof TIPOS_SOLICITUD;

/** Quién atiende cada clase de encargo. */
export const ATIENDE: Record<TipoSolicitud, string> = {
  pedido: "Administración",
  cotizacion: "Administración",
  muestra: "Administración",
  precio: "Gerencia",
};

/**
 * Quién lo resuelve.
 *
 * Los dos caminos son reales y ninguno es el excepcional: el pedido lo puede
 * facturar él con su talonario, o mandarlo a la oficina cuando el cliente
 * necesita factura fiscal.
 */
export const RESUELVE = {
  yo: "Yo mismo",
  oficina: "La oficina",
} as const;

export type ResuelveSolicitud = keyof typeof RESUELVE;

export const ESTADOS_SOLICITUD = {
  pendiente: "Pendiente",
  resuelta: "Resuelta",
  rechazada: "Rechazada",
} as const;

export type EstadoSolicitud = keyof typeof ESTADOS_SOLICITUD;

export const TONO_SOLICITUD: Record<EstadoSolicitud, "aviso" | "ok" | "error"> = {
  pendiente: "aviso",
  resuelta: "ok",
  rechazada: "error",
};

/**
 * Qué clase de lista es.
 *
 * Las dos usan el mismo mecanismo y no se parecen por dentro: la de zona se
 * arma barriendo el mapa y tiene veinte o treinta locales; la de objetivos se
 * arma por nombre —uno ya sabe cuáles son los bancos— y tiene diez o quince,
 * casi todos oficinas de negociación.
 */
export const TIPOS_LISTA = {
  zona: "Zona",
  objetivo: "Objetivos",
} as const;

export type TipoLista = keyof typeof TIPOS_LISTA;

/**
 * Qué espera de esa lista al armarla.
 *
 * No es lo mismo que resultó —eso sale de la fecha de cierre de cada venta—
 * y las dos conviven a propósito: sin la marca en la lista, la mezcla solo se
 * puede mirar hacia atrás, y la mezcla es una decisión que se toma antes de
 * empezar. Cuando lo esperado y lo real no coinciden, es un hallazgo de
 * mercado y no un error de captura.
 */
export const CLASES_VENTA = {
  rapida: "Ventas rápidas",
  grande: "Ventas grandes",
} as const;

export type ClaseVenta = keyof typeof CLASES_VENTA;

export const AYUDA_CLASE: Record<ClaseVenta, string> = {
  rapida: "Cierran en semanas. Pagan el mes",
  grande: "Tardan meses. Construyen el año",
};

/**
 * Por qué el comercio le compra al competidor y no a nosotros.
 *
 * **Lista provisional.** Se arrancó con una propuesta para poder mostrar la
 * aplicación funcionando; se afina con los tres vendedores usando sus propias
 * palabras.
 *
 * Importa más de lo que parece: estos valores son las únicas preguntas que la
 * empresa va a poder contestar en dos años. Si "paisanaje" no estuviera,
 * nunca se podría demostrar que existe; si precio y crédito fueran uno solo,
 * nunca se sabría cuál de los dos está matando la venta.
 */
export const MOTIVOS_COMPETENCIA = {
  precio: "Se lo dan más barato",
  credito: "Le dan crédito o plazo",
  paisanaje: "Le compra a su paisano",
  cercania: "El proveedor le queda cerca",
  entrega: "Le entregan más rápido o más seguido",
  especificacion: "Prefiere ese producto",
  pedido_minimo: "Nuestro pedido mínimo es muy alto",
  otro: "Otra razón",
} as const;

export type MotivoCompetencia = keyof typeof MOTIVOS_COMPETENCIA;

/**
 * Resultados que implican que hay un competidor detrás.
 *
 * La ficha de competencia solo aparece con estos tres. Pedirla en toda visita
 * duplicaría el tiempo de captura y enseñaría al vendedor a elegir resultados
 * que no la disparan — que es exactamente cómo se corrompe un catálogo.
 */
/**
 * Resultados donde puede haber una venta que tome tiempo.
 *
 * El bloque para abrirla aparece con estos tres y es opcional. El vendedor de
 * ruta casi siempre lo salta —vende en una o dos visitas, y eso es un pedido—
 * y el líder casi siempre lo toma.
 *
 * La regla: si vas a volver más de una vez por la misma venta, es una venta.
 */
export const RESULTADOS_CON_VENTA_LARGA: Resultado[] = [
  "pide_cotizacion",
  "quiere_precio",
  "pide_muestra",
];

export const RESULTADOS_CON_COMPETENCIA: Resultado[] = [
  "quiere_precio",
  "stock_suficiente",
  "sin_interes",
];

/**
 * En qué se fue el tiempo que no fue vender.
 *
 * La lista incluye a propósito lo que de verdad pasa y no solo lo que uno
 * quisiera: el día que no se pudo salir por calles cerradas es tan real como
 * el viaje de carga, y si no tiene dónde registrarse, la semana aparece como
 * flojera. **Provisional hasta validarla con los tres vendedores.**
 */
export const TIPOS_JORNADA = {
  viaje_mercancia: "Viaje por mercancía",
  entrega: "Entrega a clientes",
  entrega_urgente: "Entrega urgente imprevista",
  no_pudo_salir: "No se pudo salir",
  administrativo: "Administrativo",
  personal: "Personal o incapacidad",
} as const;

export type TipoJornada = keyof typeof TIPOS_JORNADA;

/**
 * Media jornada de resolución alcanza.
 *
 * La pregunta de negocio es si la logística se come el 30% o el 60% de la
 * semana, no una planilla de nómina. Pedirle horas exactas a alguien que está
 * cargando un camión produce números inventados.
 */
export const DURACIONES_JORNADA = {
  media: "Media jornada",
  completa: "Jornada completa",
} as const;

export type DuracionJornada = keyof typeof DURACIONES_JORNADA;

/** Cuánto descuenta cada bloque de los días vendibles de la semana. */
export const PESO_JORNADA: Record<DuracionJornada, number> = {
  media: 0.5,
  completa: 1,
};

/** Qué clase de punto es la cuenta (docs/13-flujo-lider.html). */
export const TIPOS_PUNTO = {
  local: "Local comercial",
  oficina: "Oficina de negociación",
} as const;

export type TipoPunto = keyof typeof TIPOS_PUNTO;

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
