import type { MotivoIncumplido, TipoAccionPlan } from "@/lib/catalogos";

/**
 * Las reglas del plan diario que no necesitan la base — docs/18-plan-diario.md.
 *
 * **Viven aparte de `plan-diario.ts` a propósito:** ese módulo abre un cliente
 * de Supabase del lado del servidor, y un módulo que importa `next/headers` no
 * se puede ejercitar con `node --test`. Lo que decide si un día está bien
 * rendido tiene que poder probarse sin levantar nada.
 */

/** Lo que el vendedor ya hizo hoy, contado por el sistema. */
export type AvanceDeHoy = {
  llamadas: number;
  visitas: number;
  cotizaciones: number;
  /** Los seguimientos que el sistema impuso: cuántos quedan y cuántos despachó. */
  seguimientosPendientes: number;
  seguimientosDespachados: number;
};

/**
 * Cuánto lleva hecho hoy una acción, o **nulo si de eso no hay registro**.
 *
 * Reparto y cobro devuelven nulo, y es la decisión que importa de esta función:
 * no existe ninguna tabla que registre una entrega ni un cobro, así que un
 * contador automático diría «0» todo el día sobre un trabajo que sí se hizo.
 *
 * **Un cero que parece un dato es peor que un hueco:** el vendedor lo ve mal y
 * deja de creerle a la pantalla, y gerencia lo lee como que no trabajó. Nulo se
 * dibuja como «—» y se pide al cerrar el día.
 */
export function avanceDe(
  tipo: TipoAccionPlan,
  avance: AvanceDeHoy,
): number | null {
  if (tipo === "llamar_frio") return avance.llamadas;
  if (tipo === "visitar") return avance.visitas;
  if (tipo === "entregar_cotizacion") return avance.cotizaciones;
  return null;
}

/** Lo que el vendedor contesta al cerrar, por cada acción. */
export type Rendicion = {
  /** Como viene del campo: texto, porque puede estar vacío o a medio escribir. */
  hizo: string;
  motivo: MotivoIncumplido | null;
  motivoOtro: string;
};

/**
 * Qué le falta a una rendición para poder cerrar el día. Nulo si está completa.
 *
 * **Una meta cumplida no pide motivo, y una incumplida sí.** Es lo único que
 * este formulario exige, y es a propósito: si cerrar el día pidiera una
 * explicación por cada línea, tomaría diez minutos y moriría en una semana —
 * que es justo lo que le pasó al cierre semanal.
 *
 * La misma regla está escrita como restricción en la base
 * (`plan_acciones_otra_cosa_se_explica`). **Están en dos sitios a propósito y no
 * por descuido:** acá para poder decirlo antes de que el vendedor toque el
 * botón, y allá porque una regla que sólo vive en la pantalla es una regla que
 * un día alguien se salta.
 */
export function faltaDeLaRendicion(
  r: Rendicion | undefined,
  meta: number,
): string | null {
  if (!r) return "Falta decir cuántas hiciste.";

  if (r.hizo.trim() === "") return "Falta decir cuántas hiciste.";

  const hizo = Number(r.hizo);
  if (!Number.isFinite(hizo) || hizo < 0) {
    return "Lo que hiciste tiene que ser un número.";
  }

  if (hizo >= meta) return null;

  if (!r.motivo) return "Falta decir qué pasó.";

  if (r.motivo === "otra_cosa" && r.motivoOtro.trim() === "") {
    return "Escribe qué fue lo que pasó.";
  }

  return null;
}

/**
 * Cuánto se arrastra al día siguiente.
 *
 * Nunca negativo: **hacer más de la meta no deja crédito para mañana.** Si
 * restara, un día bueno le regalaría el día siguiente, y el plan dejaría de
 * pedir trabajo justo cuando las cosas van bien.
 */
export function loQueQuedaDebiendo(meta: number, hizo: number): number {
  return Math.max(meta - hizo, 0);
}
