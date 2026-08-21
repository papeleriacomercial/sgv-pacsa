import type { LineaProducto, TipoCuenta, Volumen } from "@/lib/catalogos";
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
  soloSinClasificar: boolean;
  soloSinUbicacion: boolean;
  soloFueraDeCadencia: boolean;
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
  soloSinClasificar: false,
  soloSinUbicacion: false,
  soloFueraDeCadencia: false,
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
    (f.soloSinClasificar ? 1 : 0) +
    (f.soloSinUbicacion ? 1 : 0) +
    (f.soloFueraDeCadencia ? 1 : 0)
  );
}

export function aplicar(cuentas: Cuenta[], f: Filtros): Cuenta[] {
  const texto = f.texto.trim().toLowerCase();

  return cuentas.filter((c) => {
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

    if (f.soloSinClasificar && c.tipo_comercio) return false;
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

export type Dimension = "tipo" | "volumen" | "sin_contacto" | "vendedor";

export const DIMENSIONES: Record<Dimension, string> = {
  tipo: "Tipo de cuenta",
  volumen: "Volumen",
  sin_contacto: "Días sin contacto",
  vendedor: "Vendedor",
};

/**
 * Paleta para vendedores.
 *
 * No son colores de estado: aquí el color solo distingue personas, y por eso
 * se eligieron tonos que no se confunden con el semáforo del sistema.
 */
const PALETA_VENDEDOR = [
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
    return {
      color: (c) => (c.tipo === "cliente" ? COLOR.ok : COLOR.info),
      leyenda: [
        { color: COLOR.ok, texto: "Cliente" },
        { color: COLOR.info, texto: "Prospecto" },
      ],
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

  if (dimension === "vendedor") {
    const ids = [...new Set(cuentas.map((c) => c.vendedor_id))];
    const porId = new Map(
      ids.map((id, i) => [id, PALETA_VENDEDOR[i % PALETA_VENDEDOR.length]]),
    );
    return {
      color: (c) => porId.get(c.vendedor_id) ?? COLOR.atenuado,
      leyenda: ids.map((id) => ({
        color: porId.get(id)!,
        texto: nombreVendedor(id),
      })),
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
