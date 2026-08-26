import {
  LINEAS_PRODUCTO,
  TIPOS_CUENTA,
  type LineaProducto,
  type TipoCuenta,
  type Volumen,
} from "@/lib/catalogos";
import { COLOR } from "@/lib/marcadores";

/**
 * Motor de filtros de la cartera (plan v2, Etapa 3).
 *
 * Un solo modelo para la lista y para el mapa. Si cada vista tuviera el suyo,
 * en tres meses filtrarían distinto por el mismo criterio y nadie sabría cuál
 * creer.
 */

export type Cuenta = {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  tipo_comercio: string | null;
  poblado: string | null;
  /** Nombres de las listas a las que pertenece. Las llena `cargarCartera`. */
  listas?: string[];
  volumen: Volumen | null;
  productos_interes: LineaProducto[] | null;
  vendedor_id: string;
  lat: number | null;
  lng: number | null;
  dias_sin_contacto: number | null;
  dias_hasta_compromiso: number | null;
  fuera_de_cadencia: boolean | null;
  /**
   * Días de producto que le quedan según su propio ritmo de compra.
   *
   * Negativo quiere decir que ya se le acabó. Nulo, que no hay ritmo
   * medible todavía — hacen falta tres compras para que dos intervalos
   * sean un ritmo.
   */
  dias_para_reponer: number | null;
  sin_ubicacion: boolean;
  oportunidades_abiertas: number;
};

export type Filtros = {
  texto: string;
  tipos: TipoCuenta[];
  categorias: string[];
  poblados: string[];
  productos: LineaProducto[];
  volumenes: Volumen[];
  vendedores: string[];
  /** Cuentas sin contactar hace más de N días. */
  sinContactoDesde: number | null;
  /** Cuentas con compromiso dentro de los próximos N días, vencidos incluidos. */
  compromisoEnDias: number | null;
  /**
   * Cuentas a las que se les acaba el producto dentro de N días.
   *
   * **Incluye a las que ya se les acabó**, y no por descuido: si se va a
   * armar la ruta de la semana, el que se quedó sin nada hace un mes va en
   * la misma lista que el que se queda sin nada el jueves — y va primero.
   *
   * Con 0 el filtro dice exactamente «ya se le acabó».
   */
  porReponerEnDias: number | null;
  /** Cuentas a las que nadie les puso tipo de comercio. */
  soloSinCategoria: boolean;
  soloSinUbicacion: boolean;
  soloFueraDeCadencia: boolean;
  /**
   * Las descartadas se esconden por omisión.
   *
   * No se borran —saber que se fue a ver y no sirvió evita que otro repita el
   * viaje— pero tampoco estorban el trabajo del día. Se ven pidiéndolas.
   */
  incluirDescartadas: boolean;
  /**
   * Los potenciales tampoco se ven aquí por omisión.
   *
   * **Es la mitad que faltaba de las listas.** Separarlos en su pantalla no
   * sirvió de nada mientras seguían cayendo en la cartera: veinte puntos
   * escogidos un domingo, veinte más el martes en Chitré, y en un mes hay cien
   * potenciales tapando las treinta cuentas reales que se trabajan.
   *
   * Un potencial es abundante y desechable; una cuenta es escasa y permanente. La
   * cartera es de las segundas. Los potenciales viven en sus listas hasta que
   * alguien los toque — y ahí dejan de ser potenciales.
   */
  incluirPotenciales: boolean;
};

export const FILTROS_VACIOS: Filtros = {
  texto: "",
  tipos: [],
  categorias: [],
  poblados: [],
  productos: [],
  volumenes: [],
  vendedores: [],
  sinContactoDesde: null,
  compromisoEnDias: null,
  porReponerEnDias: null,
  soloSinCategoria: false,
  soloSinUbicacion: false,
  soloFueraDeCadencia: false,
  incluirDescartadas: false,
  incluirPotenciales: false,
};

export function contarActivos(f: Filtros): number {
  return (
    (f.texto.trim() ? 1 : 0) +
    f.tipos.length +
    f.categorias.length +
    f.poblados.length +
    f.productos.length +
    f.volumenes.length +
    f.vendedores.length +
    (f.sinContactoDesde !== null ? 1 : 0) +
    (f.compromisoEnDias !== null ? 1 : 0) +
    (f.porReponerEnDias !== null ? 1 : 0) +
    (f.soloSinCategoria ? 1 : 0) +
    (f.soloSinUbicacion ? 1 : 0) +
    (f.soloFueraDeCadencia ? 1 : 0) +
    (f.incluirDescartadas ? 1 : 0) +
    (f.incluirPotenciales ? 1 : 0)
  );
}

export function aplicar(cuentas: Cuenta[], f: Filtros): Cuenta[] {
  const texto = f.texto.trim().toLowerCase();

  return cuentas.filter((c) => {
    // Las descartadas salen del conjunto antes que nada, salvo que se pidan
    // expresamente —con el interruptor o eligiéndolas en el filtro de tipo—.
    if (
      c.tipo === "descartada" &&
      !f.incluirDescartadas &&
      !f.tipos.includes("descartada")
    ) {
      return false;
    }

    // Los potenciales, igual. La cartera es de cuentas que alguien ya trabajó.
    if (
      c.tipo === "potencial" &&
      !f.incluirPotenciales &&
      !f.tipos.includes("potencial")
    ) {
      return false;
    }

    if (texto && !c.nombre.toLowerCase().includes(texto)) return false;
    if (f.tipos.length && !f.tipos.includes(c.tipo)) return false;
    if (f.vendedores.length && !f.vendedores.includes(c.vendedor_id)) return false;

    if (f.categorias.length && !f.categorias.includes(c.tipo_comercio ?? ""))
      return false;

    if (f.poblados.length && !f.poblados.includes(c.poblado ?? "")) return false;

    if (f.volumenes.length && (!c.volumen || !f.volumenes.includes(c.volumen)))
      return false;

    if (
      f.productos.length &&
      !f.productos.some((p) => (c.productos_interes ?? []).includes(p))
    ) {
      return false;
    }

    // Nunca contactada cuenta como "hace mucho": es el caso más urgente, no el
    // menos. Tratarla como nula la escondería justo del filtro que la busca.
    if (f.sinContactoDesde !== null) {
      const dias = c.dias_sin_contacto ?? Infinity;
      if (dias < f.sinContactoDesde) return false;
    }

    if (f.compromisoEnDias !== null) {
      if (c.dias_hasta_compromiso === null) return false;
      if (c.dias_hasta_compromiso > f.compromisoEnDias) return false;
    }

    // Sin ritmo medible no se puede decir nada, así que queda fuera del
    // filtro en vez de colarse como «le queda mucho». Prometer que se sabe
    // cuándo vuelve a comprar quien solo compró una vez es peor que callar.
    if (f.porReponerEnDias !== null) {
      if (c.dias_para_reponer === null) return false;
      if (c.dias_para_reponer > f.porReponerEnDias) return false;
    }

    if (f.soloSinCategoria && c.tipo_comercio) return false;
    if (f.soloSinUbicacion && !c.sin_ubicacion) return false;
    if (f.soloFueraDeCadencia && c.fuera_de_cadencia !== true) return false;

    return true;
  });
}

// ===========================================================================
// Colorización
//
// D-013: en el mapa el color codifica la variable que el usuario eligió, y la
// leyenda es obligatoria. Fuera del mapa, el color sigue significando estado.
// ===========================================================================

/**
 * Las dimensiones de color son **las mismas variables que se pueden filtrar**.
 * Si se pudiera colorear por algo que no se puede filtrar, o al revés, el
 * vendedor tendría que aprender dos vocabularios para la misma cartera.
 */
export type Dimension =
  | "tipo"
  | "volumen"
  | "producto"
  | "categoria"
  | "poblado"
  | "sin_contacto"
  | "reponer"
  | "vendedor";

export const DIMENSIONES: Record<Dimension, string> = {
  tipo: "Tipo de cuenta",
  volumen: "Volumen",
  producto: "Producto de interés",
  categoria: "Tipo de comercio",
  poblado: "Poblado",
  sin_contacto: "Días sin contacto",
  reponer: "Cuánto producto le queda",
  vendedor: "Vendedor",
};

const ETIQUETA_PRODUCTO: Record<string, string> = LINEAS_PRODUCTO;

/**
 * Paleta para las dimensiones de valor abierto.
 *
 * No son colores de estado: aquí el color solo distingue valores entre sí, y
 * por eso se eligieron tonos que no se confunden con el semáforo del sistema.
 */
const PALETA_VALORES = [
  "#7C3AED",
  "#0891B2",
  "#DB2777",
  "#65A30D",
  "#EA580C",
  "#4F46E5",
];

/** De ámbar claro a rojo oscuro, para los rangos numéricos. */
function gradiente(proporcion: number): string {
  const claro = { r: 253, g: 230, b: 138 };
  const oscuro = { r: 153, g: 27, b: 27 };
  const t = Math.min(1, Math.max(0, proporcion));
  const c = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${c(claro.r, oscuro.r)}, ${c(claro.g, oscuro.g)}, ${c(claro.b, oscuro.b)})`;
}

export type EntradaLeyenda = { color: string; texto: string };

/**
 * Devuelve el color de cada cuenta y la leyenda que lo explica.
 *
 * Las dos cosas salen juntas a propósito: una vista coloreada sin leyenda
 * incumple §17, y separarlas invita a olvidar la segunda.
 */
export function colorizar(
  cuentas: Cuenta[],
  dimension: Dimension,
  nombreVendedor: (id: string) => string,
): { color: (c: Cuenta) => string; leyenda: EntradaLeyenda[] } {
  if (dimension === "tipo") {
    const tonos: Record<TipoCuenta, string> = {
      potencial: COLOR.aviso,
      prospecto: COLOR.info,
      cliente: COLOR.ok,
      descartada: COLOR.atenuado,
    };

    // La leyenda solo nombra los tipos que están en pantalla: con las
    // descartadas escondidas, ofrecer su color sería explicar algo que no se ve.
    const presentes = (Object.keys(TIPOS_CUENTA) as TipoCuenta[]).filter((t) =>
      cuentas.some((c) => c.tipo === t),
    );

    return {
      color: (c) => tonos[c.tipo] ?? COLOR.atenuado,
      leyenda: presentes.map((t) => ({
        color: tonos[t],
        texto: TIPOS_CUENTA[t],
      })),
    };
  }

  if (dimension === "volumen") {
    const tonos: Record<Volumen, string> = {
      alta: COLOR.ok,
      media: COLOR.info,
      baja: COLOR.atenuado,
    };
    return {
      color: (c) => (c.volumen ? tonos[c.volumen] : COLOR.atenuado),
      leyenda: [
        { color: COLOR.ok, texto: "Alta" },
        { color: COLOR.info, texto: "Media" },
        { color: COLOR.atenuado, texto: "Baja o sin definir" },
      ],
    };
  }

  // Dimensiones de valor abierto: vendedor, categoría, poblado y producto. Se
  // resuelven igual —tantos colores como valores distintos haya— porque
  // ninguna tiene una lista fija conocida de antemano.
  if (
    dimension === "vendedor" ||
    dimension === "categoria" ||
    dimension === "poblado" ||
    dimension === "producto"
  ) {
    const claveDe = (c: Cuenta): string | null => {
      if (dimension === "vendedor") return c.vendedor_id;
      if (dimension === "categoria") return c.tipo_comercio;
      if (dimension === "poblado") return c.poblado;
      // Una cuenta puede interesarse en varias líneas. Se colorea por la
      // primera, y la leyenda lo dice para que nadie lea de más.
      return c.productos_interes?.[0] ?? null;
    };

    const etiquetaDe = (clave: string) =>
      dimension === "vendedor"
        ? nombreVendedor(clave)
        : dimension === "producto"
          ? (ETIQUETA_PRODUCTO[clave] ?? clave)
          : clave;

    const claves = [
      ...new Set(cuentas.map(claveDe).filter((v): v is string => v !== null)),
    ].sort();

    const porClave = new Map(
      claves.map((k, i) => [k, PALETA_VALORES[i % PALETA_VALORES.length]]),
    );

    const leyenda: EntradaLeyenda[] = claves.map((k) => ({
      color: porClave.get(k)!,
      texto: etiquetaDe(k),
    }));

    const haySinValor = cuentas.some((c) => claveDe(c) === null);
    if (haySinValor) {
      leyenda.push({ color: COLOR.atenuado, texto: "Sin definir" });
    }

    return {
      color: (c) => {
        const k = claveDe(c);
        return k ? (porClave.get(k) ?? COLOR.atenuado) : COLOR.atenuado;
      },
      leyenda,
    };
  }

  // Cuánto producto le queda: **tramos fijos, no gama relativa.**
  //
  // Aquí la diferencia es absoluta y no comparativa: «ya se le acabó» y «le
  // quedan treinta días» son estados distintos, no dos puntos de una escala.
  // Una gama relativa haría que en una cartera toda al día el menos bueno se
  // pintara de rojo, que es exactamente la alarma falsa que hace que la gente
  // deje de mirar los colores.
  //
  // Es de las pocas veces que el color del mapa coincide con el semáforo de
  // §17, y está bien: aquí el color **es** el estado.
  if (dimension === "reponer") {
    const tramo = (d: number | null) => {
      if (d === null) return 3;
      if (d < 0) return 0;
      if (d <= 7) return 1;
      if (d <= 30) return 2;
      return 4;
    };

    const tonos = [COLOR.error, COLOR.aviso, COLOR.info, COLOR.atenuado, COLOR.ok];
    const textos = [
      "Ya se le acabó",
      "Se le acaba esta semana",
      "Le queda el mes",
      "Sin ritmo medible",
      "Le queda de sobra",
    ];

    const presentes = [
      ...new Set(cuentas.map((c) => tramo(c.dias_para_reponer))),
    ].sort((a, b) => a - b);

    return {
      color: (c) => tonos[tramo(c.dias_para_reponer)],
      leyenda: presentes.map((i) => ({ color: tonos[i], texto: textos[i] })),
    };
  }

  // Días sin contacto: gama de claro a oscuro sobre el rango real de lo que se
  // está viendo. Una escala fija haría que en una cartera fresca todo se viera
  // igual de claro y no se distinguiera nada.
  const dias = cuentas
    .map((c) => c.dias_sin_contacto)
    .filter((d): d is number => d !== null);

  const maximo = dias.length ? Math.max(...dias) : 0;
  const minimo = dias.length ? Math.min(...dias) : 0;
  const rango = Math.max(1, maximo - minimo);

  return {
    // Nunca contactada es el caso más urgente: se pinta del tono más oscuro.
    color: (c) =>
      c.dias_sin_contacto === null
        ? gradiente(1)
        : gradiente((c.dias_sin_contacto - minimo) / rango),
    leyenda: [
      { color: gradiente(0), texto: `${minimo} días` },
      { color: gradiente(0.5), texto: `${Math.round((minimo + maximo) / 2)} días` },
      { color: gradiente(1), texto: `${maximo} días o nunca` },
    ],
  };
}

// ===========================================================================
// Serialización a la dirección
//
// Los filtros viven en la URL y no en el estado de React. Sin esto, entrar a
// una cuenta y volver atrás pierde todo: quien esté corrigiendo cuentas sin
// clasificar tendría que rearmar el filtro después de cada una.
//
// De paso, la vista queda enlazable: un líder puede mandarle a un vendedor la
// dirección exacta de lo que está mirando.
// ===========================================================================

const LISTAS = [
  "tipos",
  "categorias",
  "poblados",
  "productos",
  "volumenes",
  "vendedores",
] as const;

const BANDERAS = [
  "soloSinCategoria",
  "soloSinUbicacion",
  "soloFueraDeCadencia",
  "incluirDescartadas",
  "incluirPotenciales",
] as const;

export function desdeUrl(p: URLSearchParams): Filtros {
  const filtros: Filtros = { ...FILTROS_VACIOS, texto: p.get("q") ?? "" };

  LISTAS.forEach((clave) => {
    const valor = p.get(clave);
    if (valor) {
      // @ts-expect-error todas las listas son de cadenas en la dirección
      filtros[clave] = valor.split(",");
    }
  });

  BANDERAS.forEach((clave) => {
    if (p.get(clave) === "1") filtros[clave] = true;
  });

  const sin = p.get("sinContacto");
  if (sin) filtros.sinContactoDesde = Number(sin);

  const comp = p.get("compromiso");
  if (comp !== null) filtros.compromisoEnDias = Number(comp);

  const rep = p.get("reponer");
  if (rep !== null) filtros.porReponerEnDias = Number(rep);

  return filtros;
}

/** Solo escribe lo que no es el valor por omisión: direcciones cortas y legibles. */
export function aUrl(
  f: Filtros,
  dimension: Dimension,
  vista: "lista" | "mapa",
  /**
   * Parámetros de la dirección que no son filtros y hay que conservar.
   *
   * "lista" y "cuenta" los pone la pantalla, no el panel. Sin esto, tocar un
   * filtro en el mapa de una lista reescribía la dirección sin la lista y
   * aparecía la cartera entera.
   */
  conservar?: URLSearchParams,
): string {
  const p = new URLSearchParams();

  for (const clave of ["lista", "cuenta"]) {
    const valor = conservar?.get(clave);
    if (valor) p.set(clave, valor);
  }

  if (f.texto.trim()) p.set("q", f.texto.trim());
  LISTAS.forEach((clave) => {
    const lista = f[clave] as string[];
    if (lista.length) p.set(clave, lista.join(","));
  });
  BANDERAS.forEach((clave) => {
    if (f[clave]) p.set(clave, "1");
  });
  if (f.sinContactoDesde !== null) p.set("sinContacto", String(f.sinContactoDesde));
  if (f.compromisoEnDias !== null) p.set("compromiso", String(f.compromisoEnDias));
  if (f.porReponerEnDias !== null) p.set("reponer", String(f.porReponerEnDias));

  if (dimension !== "tipo") p.set("color", dimension);
  p.set("vista", vista);

  return p.toString();
}
