import { clienteServidor } from "@/lib/supabase/servidor";
import type { MotivoAusencia } from "@/lib/catalogos";

/**
 * Los días que no se trabaja — docs/18-plan-diario.md §6.
 *
 * **Sin esto el esquema arranca injusto.** Un día de vacaciones se cuenta como
 * «no armó el plan», y el reporte del viernes le reclama a alguien por no
 * planificar un día que no trabajó. La métrica de disciplina —que es todo lo que
 * sostiene el rediseño— quedaría desacreditada en la primera semana.
 */

export type Ausencia = {
  id: string;
  vendedor_id: string;
  desde: string;
  hasta: string;
  motivo: MotivoAusencia;
  nota: string | null;
};

/**
 * La ausencia que cubre un día, si hay.
 *
 * **Devuelve el fallo aparte**, como la lectura del plan: si la consulta
 * revienta y se devolviera «no hay ausencia», la pantalla le ofrecería armar el
 * día a alguien que está de vacaciones. Es la misma falla que el proyecto
 * hermano lleva contada siete veces — un error que se ve igual que un «no hay».
 */
export async function ausenciaDe(
  vendedorId: string,
  dia: string,
): Promise<{ ausencia: Ausencia | null; fallo: string | null }> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("ausencias")
    .select("id, vendedor_id, desde, hasta, motivo, nota")
    .eq("vendedor_id", vendedorId)
    .lte("desde", dia)
    .gte("hasta", dia)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { ausencia: null, fallo: error.message };
  return { ausencia: (data as Ausencia) ?? null, fallo: null };
}

/** Las que vienen, para poder decir «vuelves el lunes» y para listarlas. */
export async function proximasAusencias(
  vendedorId?: string,
): Promise<Ausencia[]> {
  const supabase = await clienteServidor();
  let consulta = supabase
    .from("ausencias")
    .select("id, vendedor_id, desde, hasta, motivo, nota")
    .is("deleted_at", null)
    .order("desde", { ascending: false })
    .limit(30);

  if (vendedorId) consulta = consulta.eq("vendedor_id", vendedorId);

  const { data } = await consulta;
  return (data ?? []) as Ausencia[];
}

/**
 * Cómo se lee un rango: «hoy», «del lunes 26 al viernes 30».
 *
 * Con mediodía UTC, como todo lo que convierte fechas acá: desde medianoche, una
 * fecha de Panamá cae el día anterior y el rango sale corrido.
 */
export function rangoLegible(desde: string, hasta: string, hoy: string): string {
  if (desde === hasta) {
    return desde === hoy ? "hoy" : `el ${diaLegible(desde)}`;
  }
  return `del ${diaLegible(desde)} al ${diaLegible(hasta)}`;
}

export function diaLegible(iso: string): string {
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
