import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Los reportes semanales y la observación de gerencia — docs/18-plan-diario.md §4.5.
 *
 * **La observación es la única parte del reporte que escribe una persona.** Todo
 * lo demás lo arma la tarea del viernes a partir de hechos; esto es el juicio
 * de quien supervisa, y el usuario pidió expresamente que quedara guardado:
 * *«no haría ningún tipo de intervención diaria sobre el reporte, pero sí en
 * base a un reporte semanal poder hacer mis observaciones generales… y que eso
 * vaya quedando dentro de la herramienta como histórico»*.
 */

/**
 * La forma de `datos`, que la escribe `scripts/reporte-semanal.mjs`.
 *
 * **Es un contrato entre un script de Node y esta pantalla**, y por eso vive
 * declarado acá: el script no tiene tipos, así que si alguien le cambia un
 * nombre de campo nada falla hasta que la pantalla dibuja un hueco. Cuando se
 * agregue algo al reporte, se agrega también aquí.
 *
 * Los campos van opcionales a propósito: **los reportes viejos no tienen los
 * campos nuevos.** Un reporte de octubre no sabe de la página 2, y la pantalla
 * tiene que poder abrirlo igual.
 */
export type DatosDelReporte = {
  vendedor?: { id: string; nombre: string; correo: string | null };
  disciplina?: { diasConPlan: number; cerrados: number; tarde: number };
  acciones?: {
    tipo: string;
    meta: number;
    hecho: number;
    sinCerrar: number;
    porcentaje: number | null;
  }[];
  motivoMasRepetido?: [string, number] | null;
  facturado?: number;
  documentos?: number;
  nuevos?: { nombre: string; monto: number }[];
  nuevosDelMes?: number;
  nuevosDelAnio?: number;
  volvieron?: number;
  mes?: { clave: string; total: number; documentos: number };
  mesAnterior?: { clave: string; total: number } | null;
  comision?: number | null;
  porcentajeComision?: number | null;
  mejor?: { mes: string; total: number } | null;

  // La página 2
  ventas?: { cliente: string; monto: number; enLista: boolean; tocado: boolean }[];
  dentroDeLista?: number;
  sinTocar?: number;
  canal?: {
    emitidas: number;
    emitidasMonto: number;
    ganadas: { codigo: string }[];
    perdidas: { codigo: string; motivo_perdida: string }[];
    vivas: { codigo: string; cliente: string; monto: number; dias: number | null }[];
    vivasMonto: number;
    frias: number;
  };
  listasApuntadas?: { nombre: string; meta: number }[];
};

export type ReporteSemanal = {
  id: string;
  vendedor_id: string;
  semana: string;
  datos: DatosDelReporte;
  enviado_en: string | null;
  enviado_a: string[] | null;
  observacion: string | null;
  observado_por: string | null;
  observado_en: string | null;
  /** El nombre del vendedor, que no vive en `datos` de los reportes viejos. */
  nombre: string;
};

const COLUMNAS =
  "id, vendedor_id, semana, datos, enviado_en, enviado_a, observacion, observado_por, observado_en," +
  // **El embebido va calificado con el nombre de la llave**, no como
  // `perfiles(nombre)` a secas. La tabla apunta a `perfiles` dos veces —el
  // vendedor y quien observó— así que sin calificar PostgREST no sabe cuál es y
  // la consulta falla al abrir la pantalla, no al compilar. Ya pasó dos veces en
  // este proyecto.
  " perfiles!reportes_semanales_vendedor_id_fkey(nombre)";

function mapear(row: Record<string, unknown>): ReporteSemanal {
  const p = row.perfiles as { nombre: string } | { nombre: string }[] | null;
  const nombre = Array.isArray(p) ? (p[0]?.nombre ?? "") : (p?.nombre ?? "");
  return { ...(row as unknown as ReporteSemanal), nombre };
}

/**
 * Los reportes que puede ver quien pregunta.
 *
 * **El RLS decide, no esta función.** El vendedor ve los suyos, el líder los de
 * su equipo y gerencia todos: está escrito como política en la base, así que no
 * hay forma de equivocarse acá y mostrarle a alguien lo que no le toca.
 */
export async function cargarReportes(limite = 24): Promise<ReporteSemanal[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("reportes_semanales")
    .select(COLUMNAS)
    .is("deleted_at", null)
    .order("semana", { ascending: false })
    .limit(limite);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapear);
}

export async function cargarReporte(id: string): Promise<ReporteSemanal | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("reportes_semanales")
    .select(COLUMNAS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return data ? mapear(data as unknown as Record<string, unknown>) : null;
}

/** El último reporte de una persona, para enlazarlo desde su Agenda. */
export async function ultimoReporteDe(
  vendedorId: string,
): Promise<ReporteSemanal | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("reportes_semanales")
    .select(COLUMNAS)
    .eq("vendedor_id", vendedorId)
    .is("deleted_at", null)
    .order("semana", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapear(data as unknown as Record<string, unknown>) : null;
}

/**
 * Cómo se lee una semana: «del 19 al 23 de octubre».
 *
 * **Se arma con mediodía UTC**, como todo lo que convierte fechas en este
 * proyecto: a partir de medianoche, una fecha de Panamá cae el día anterior y la
 * semana sale corrida.
 */
export function semanaLegible(lunes: string): string {
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const a = new Date(`${lunes}T12:00:00Z`);
  const b = new Date(a);
  b.setUTCDate(b.getUTCDate() + 4);

  const mesA = MESES[a.getUTCMonth()];
  const mesB = MESES[b.getUTCMonth()];

  if (mesA === mesB) {
    return `del ${a.getUTCDate()} al ${b.getUTCDate()} de ${mesB}`;
  }
  // La semana partida entre dos meses se dice con los dos nombres. Es el caso
  // que el usuario planteó: el día 30 cayendo a media semana.
  return `del ${a.getUTCDate()} de ${mesA} al ${b.getUTCDate()} de ${mesB}`;
}
