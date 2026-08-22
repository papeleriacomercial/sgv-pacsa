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
  volumen: Volumen | null;
  productos_interes: LineaProducto[] | null;
  vendedor_id: string;
  lat: number | null;
  lng: number | null;
  dias_sin_contacto: number | null;
  dias_hasta_compromiso: number | null;
  fuera_de_cadencia: boolean | null;
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
  soloSinCategoria: false,
  soloSinUbicacion: false,
  soloFueraDeCadencia: false,
  incluirDescartadas: false,
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
    (f.soloSinCategoria ? 1 : 0) +
    (f.soloSinUbicacion ? 1 : 0) +
    (f.soloFueraDeCadencia ? 1 : 0) +
    (f.incluirDescartadas ? 1 : 0)
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
  | "vendedor";

export const DIMENSIONES: Record<Dimension, string> = {
  tipo: "Tipo de cuenta",
  volumen: "Volumen",
  producto: "Producto de interés",
  categoria: "Tipo de comercio",
  poblado: "Poblado",
  sin_contacto: "Días sin contacto",
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
      sin_clasificar: COLOR.aviso,
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

  return filtros;
}

/** Solo escribe lo que no es el valor por omisión: direcciones cortas y legibles. */
export function aUrl(
  f: Filtros,
  dimension: Dimension,
  vista: "lista" | "mapa",
): string {
  const p = new URLSearchParams();

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

  if (dimension !== "tipo") p.set("color", dimension);
  p.set("vista", vista);

  return p.toString();
}
