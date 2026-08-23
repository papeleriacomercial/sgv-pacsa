"use client";

import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Cola local de escrituras pendientes.
 *
 * **La captura ocurre justo donde no hay señal.** El bloque de jornada se
 * registra manejando de Natá a Santiago; el seguimiento, dentro de un local con
 * techo de zinc. Si la aplicación exige conexión para guardar, el dato se
 * pierde y el hábito se muere en la primera semana.
 *
 * Esto no es una arquitectura sin conexión completa: es lo barato que cubre el
 * caso que de verdad pasa —perder la señal un rato— y no el que casi nunca
 * pasa: trabajar días enteros desconectado. Guarda, reintenta y avisa.
 *
 * **Los identificadores se generan en el cliente desde el día uno** (§16)
 * precisamente para esto: un reintento manda la misma fila con la misma llave,
 * así que si la primera sí llegó, la segunda choca contra la llave primaria y
 * se descarta sin duplicar nada.
 */

const CLAVE = "sgv.cola";
const MAX_INTENTOS = 20;

export type Pendiente = {
  /** El uuid de la fila. Es lo que vuelve idempotente el reintento. */
  id: string;
  tabla: string;
  fila: Record<string, unknown>;
  /** Para que el vendedor sepa qué es lo que está esperando. */
  descripcion: string;
  intentos: number;
  guardadoEn: string;
};

function leer(): Pendiente[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Pendiente[]) : [];
  } catch {
    // Un localStorage corrupto no puede tumbar la aplicación: se descarta.
    return [];
  }
}

function escribir(cola: Pendiente[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch {
    // Sin espacio no hay nada que hacer, pero tampoco hay que reventar: el
    // usuario ya recibió el error de red que lo trajo hasta aquí.
  }
}

export function pendientes(): Pendiente[] {
  return leer();
}

/** Avisa a la interfaz que la cola cambió, sin tener que pasar estado por todos lados. */
function anunciar() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sgv:cola"));
}

function encolar(p: Omit<Pendiente, "intentos" | "guardadoEn">) {
  const cola = leer();
  // Si ya está encolada la misma fila, no se duplica: puede pasar si el
  // vendedor toca Guardar dos veces sin señal.
  if (cola.some((x) => x.tabla === p.tabla && x.id === p.id)) return;

  cola.push({ ...p, intentos: 0, guardadoEn: new Date().toISOString() });
  escribir(cola);
  anunciar();
}

/**
 * Distingue "no llegó" de "llegó y la base dijo que no".
 *
 * Reintentar un rechazo de la base —una restricción violada, un permiso— es
 * inútil y llenaría la cola de basura para siempre. Solo se encola lo que
 * parece falla de red.
 */
function esFallaDeRed(error: { message?: string; code?: string } | null) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("timeout")
  );
}

export type ResultadoEscritura = {
  /** Null si guardó o si quedó encolada; el mensaje si la base la rechazó. */
  error: string | null;
  /** True cuando quedó esperando señal. El vendedor tiene que saberlo. */
  encolada: boolean;
};

/**
 * Inserta, y si no hay señal lo guarda para después.
 *
 * La fila **debe traer su `id`**: es la llave que hace idempotente el
 * reintento. Todas las pantallas ya lo generan con `crypto.randomUUID()`.
 */
export async function insertar(
  tabla: string,
  fila: Record<string, unknown>,
  descripcion: string,
): Promise<ResultadoEscritura> {
  const id = fila.id as string | undefined;

  if (typeof navigator !== "undefined" && !navigator.onLine && id) {
    encolar({ id, tabla, fila, descripcion });
    return { error: null, encolada: true };
  }

  const supabase = clienteNavegador();
  const { error } = await supabase.from(tabla).insert(fila);

  if (!error) return { error: null, encolada: false };

  if (id && esFallaDeRed(error)) {
    encolar({ id, tabla, fila, descripcion });
    return { error: null, encolada: true };
  }

  return { error: error.message, encolada: false };
}

/**
 * Intenta vaciar la cola.
 *
 * Se llama al recuperar la señal y al abrir la aplicación. Devuelve cuántas
 * quedaron, para que el aviso diga la verdad.
 */
export async function sincronizar(): Promise<{ enviadas: number; quedan: number }> {
  const cola = leer();
  if (cola.length === 0) return { enviadas: 0, quedan: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { enviadas: 0, quedan: cola.length };
  }

  const supabase = clienteNavegador();
  const restantes: Pendiente[] = [];
  let enviadas = 0;

  for (const p of cola) {
    const { error } = await supabase.from(p.tabla).insert(p.fila);

    if (!error) {
      enviadas++;
      continue;
    }

    // 23505: llave duplicada. La fila ya había llegado en un intento anterior
    // que se cortó al recibir la respuesta. Se da por enviada.
    if (error.code === "23505") {
      enviadas++;
      continue;
    }

    if (!esFallaDeRed(error)) {
      // La base la rechazó por una razón que no va a cambiar sola. Se descarta
      // en vez de reintentarla mil veces: quedaría atascada para siempre y el
      // contador de pendientes dejaría de significar algo.
      console.warn(`SGV: descartada de la cola (${p.tabla})`, error.message);
      continue;
    }

    const intentos = p.intentos + 1;
    if (intentos < MAX_INTENTOS) restantes.push({ ...p, intentos });
  }

  escribir(restantes);
  anunciar();

  return { enviadas, quedan: restantes.length };
}
