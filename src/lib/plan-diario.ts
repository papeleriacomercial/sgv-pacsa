import { clienteServidor } from "@/lib/supabase/servidor";
import type { MotivoIncumplido, TipoAccionPlan } from "@/lib/catalogos";
import type { AvanceDeHoy } from "@/lib/plan";

export type { AvanceDeHoy };

/**
 * El plan del día del vendedor — docs/18-plan-diario.md.
 *
 * Reemplaza al contrato semanal. El diagnóstico es del usuario, el 25 de
 * octubre de 2026: *«no hay consecuencias… y la herramienta se queda como algo
 * opcional»*. Lo que cambia no es cuánto se pide, es la frecuencia: un ritual
 * semanal compite con cinco días de ruido; uno diario es parte de empezar a
 * trabajar.
 *
 * **Todo lo que se puede contar, se cuenta acá.** El vendedor no teclea sus
 * visitas ni sus llamadas: si visitó, la visita ya está en `seguimientos`. Es
 * la misma regla que sostiene a `semana.ts`, y la razón es la de siempre — un
 * número que hay que teclear se vuelve un número redondo inventado.
 */

export type AccionDelPlan = {
  id: string;
  orden: number;
  tipo: TipoAccionPlan;
  lista_id: string | null;
  meta: number;
  logrado: number | null;
  motivo: MotivoIncumplido | null;
  motivo_otro: string | null;
  pasar_a_manana: boolean;
  /** Nombre de la lista, si la acción salió de una. */
  lista: string | null;
  /** Cuántas cuentas nombró, para saber si la meta era holgada. */
  cuentasNombradas: number;
};

export type PlanDelDia = {
  id: string;
  fecha: string;
  abierto_en: string;
  a_tiempo: boolean;
  cerrado_en: string | null;
  nota: string | null;
  nota_cuenta_id: string | null;
  acciones: AccionDelPlan[];
};

/**
 * Lo que devuelve la lectura del plan, con el fallo aparte.
 *
 * **`plan: null` y `fallo` son dos cosas distintas, y mezclarlas es el error
 * que el proyecto hermano lleva contado siete veces**: una consulta que revienta
 * se ve igual que «no hay». Acá sería peor que en un reporte — la pantalla le
 * ofrecería «Armar mi día» a quien ya lo armó, y al guardar chocaría contra la
 * llave única con un mensaje de Postgres que no explica nada.
 */
export type LecturaDelPlan = {
  plan: PlanDelDia | null;
  fallo: string | null;
};

/**
 * El plan de hoy, con sus acciones. `plan` nulo si todavía no lo armó.
 *
 * **Nulo es exactamente lo que la pantalla necesita ver**: es lo que dispara el
 * botón de «Armar mi día». No se devuelve un plan vacío de relleno, porque
 * entonces la Agenda no podría distinguir «no planificó» de «planificó sin
 * acciones propias», que son dos cosas distintas — la segunda es legítima si el
 * día se va entero en seguimientos.
 */
export async function cargarPlanDeHoy(
  vendedorId: string,
  hoy: string,
): Promise<LecturaDelPlan> {
  const supabase = await clienteServidor();

  const { data, error } = await supabase
    .from("planes_diarios")
    .select(
      "id, fecha, abierto_en, a_tiempo, cerrado_en, nota, nota_cuenta_id, " +
        "plan_acciones(id, orden, tipo, lista_id, meta, logrado, motivo, motivo_otro, pasar_a_manana, listas(nombre), plan_accion_cuentas(cuenta_id))",
    )
    .eq("vendedor_id", vendedorId)
    .eq("fecha", hoy)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { plan: null, fallo: error.message };
  if (!data) return { plan: null, fallo: null };

  type Cruda = {
    id: string;
    orden: number;
    tipo: TipoAccionPlan;
    lista_id: string | null;
    meta: number;
    logrado: number | null;
    motivo: MotivoIncumplido | null;
    motivo_otro: string | null;
    pasar_a_manana: boolean;
    listas: { nombre: string } | { nombre: string }[] | null;
    plan_accion_cuentas: { cuenta_id: string }[] | null;
  };

  const acciones = (((data as unknown as Record<string, unknown>)
    .plan_acciones ?? []) as Cruda[])
    .map((a) => ({
      id: a.id,
      orden: a.orden,
      tipo: a.tipo,
      lista_id: a.lista_id,
      meta: a.meta,
      logrado: a.logrado,
      motivo: a.motivo,
      motivo_otro: a.motivo_otro,
      pasar_a_manana: a.pasar_a_manana,
      lista: Array.isArray(a.listas)
        ? (a.listas[0]?.nombre ?? null)
        : (a.listas?.nombre ?? null),
      cuentasNombradas: (a.plan_accion_cuentas ?? []).length,
    }))
    .sort((a, b) => a.orden - b.orden);

  const p = data as unknown as PlanDelDia;
  return { plan: { ...p, acciones }, fallo: null };
}

/**
 * Lo que el vendedor ya hizo hoy, para que los contadores suban solos.
 *
 * Las tres consultas van juntas porque se dibujan juntas: pedirlas por separado
 * en una pantalla que ya hace siete consultas sólo agrega latencia.
 */
export async function cargarAvanceDeHoy(
  vendedorId: string,
  hoy: string,
): Promise<AvanceDeHoy> {
  const supabase = await clienteServidor();

  // `fecha` es un `timestamptz`, así que el día de Panamá va de su medianoche a
  // la siguiente. Comparar contra el texto `hoy` a secas dejaría fuera todo lo
  // registrado después de las 7 p.m., que es cuando el vendedor cierra el día.
  const desde = `${hoy}T00:00:00-05:00`;
  const hasta = `${hoy}T23:59:59.999-05:00`;

  const [llamadas, visitas, cotizaciones, pendientes, despachados] = await Promise.all([
    supabase
      .from("seguimientos")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", vendedorId)
      .eq("tipo", "llamada")
      .is("deleted_at", null)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("seguimientos")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", vendedorId)
      .eq("tipo", "visita")
      .is("deleted_at", null)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("cotizaciones")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", vendedorId)
      .is("deleted_at", null)
      .gte("emitida_en", desde)
      .lte("emitida_en", hasta),

    // Los seguimientos que el sistema impone: lo que vence hoy **y lo que ya
    // venció**. Los vencidos van primero en la pantalla por la misma razón por
    // la que entran al plan: una oportunidad abierta convierte mucho mejor que
    // un contacto frío, así que prospectar con el embudo sucio es trabajar por
    // lo más caro.
    supabase
      .from("compromisos")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", vendedorId)
      .is("deleted_at", null)
      .is("cumplido_en", null)
      .lte("fecha_compromiso", hoy),

    supabase
      .from("compromisos")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", vendedorId)
      .is("deleted_at", null)
      .gte("cumplido_en", desde)
      .lte("cumplido_en", hasta),
  ]);

  return {
    llamadas: llamadas.count ?? 0,
    visitas: visitas.count ?? 0,
    cotizaciones: cotizaciones.count ?? 0,
    seguimientosPendientes: pendientes.count ?? 0,
    seguimientosDespachados: despachados.count ?? 0,
  };
}

/** La línea de cada quien, la misma que ve gerencia. */
export type LineaDelDia = {
  vendedor_id: string;
  nombre: string;
  abierto_en: string | null;
  a_tiempo: boolean | null;
  cerrado: boolean | null;
  acciones: number;
  acciones_cumplidas: number;
};

/**
 * El resumen de una línea por persona.
 *
 * Sale de una función `security definer` de la base y no de la tabla, porque la
 * tabla está cerrada: **los pares se ven la línea y nunca el detalle.** Lo que
 * sostiene la disciplina en un equipo de tres no es el castigo, es que lo que
 * prometí ayer lo vea alguien hoy; el detalle entre pares invita a copiarse las
 * metas y es de quien supervisa.
 */
export async function cargarLineasDelDia(
  fecha?: string,
): Promise<LineaDelDia[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("plan_del_dia_resumen", {
    p_fecha: fecha ?? null,
  });
  return (data ?? []) as LineaDelDia[];
}
