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

/**
 * Qué hay que hacer con lo que quedó esperando.
 *
 * Al principio la cola solo insertaba filas, porque eso cubría el seguimiento,
 * la jornada y el alta de cuenta. **Emitir una cotización no cabe en eso**: son
 * tres pasos encadenados —guardar el borrador, subir el PDF, marcarla emitida—
 * y los tres tienen que llegar, en ese orden.
 */
export type Operacion = "insert" | "update" | "subir";

export type Pendiente = {
  /** El uuid de la fila. Es lo que vuelve idempotente el reintento. */
  id: string;
  /**
   * Qué operación es. Ausente quiere decir `insert`: así lo que ya estaba
   * guardado en el teléfono de alguien antes de este cambio se sigue enviando
   * en vez de descartarse.
   */
  operacion?: Operacion;
  tabla: string;
  fila: Record<string, unknown>;
  /** Para que el vendedor sepa qué es lo que está esperando. */
  descripcion: string;
  intentos: number;
  guardadoEn: string;

  /** Solo para `subir`: dónde va el archivo y qué archivo es. */
  bucket?: string;
  ruta?: string;
  tipo?: string;
  /**
   * El archivo en base64. Un PDF de cotización pesa decenas de kilobytes y
   * `localStorage` da unos cinco megas, así que caben de sobra los dos o tres
   * que puede haber pendientes. Si alguna vez no cupiera, se prefiere perder el
   * archivo y conservar la cotización: el cliente ya tiene su copia en la mano.
   */
  archivo?: string;
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
  // Si ya está encolada la misma operación sobre la misma fila, no se duplica:
  // puede pasar si el vendedor toca Guardar dos veces sin señal. Se compara
  // también la operación, porque una cotización tiene tres pendientes con el
  // mismo id —guardarla, subir su PDF y marcarla emitida— y son distintas.
  const op = p.operacion ?? "insert";
  if (cola.some((x) => x.tabla === p.tabla && x.id === p.id && (x.operacion ?? "insert") === op)) {
    return;
  }

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
 * Cambia una fila que ya existe, y si no hay señal lo guarda para después.
 *
 * **El orden importa y la cola lo respeta**: si la fila todavía está esperando
 * en la cola, esta actualización queda detrás y se envía después. Al vaciar, un
 * fallo de red detiene el resto en vez de saltárselo — ver `sincronizar`.
 */
export async function actualizar(
  tabla: string,
  id: string,
  cambios: Record<string, unknown>,
  descripcion: string,
): Promise<ResultadoEscritura> {
  const pendienteAntes = leer().some((p) => p.tabla === tabla && p.id === id);

  if ((typeof navigator !== "undefined" && !navigator.onLine) || pendienteAntes) {
    encolar({ id, operacion: "update", tabla, fila: cambios, descripcion });
    return { error: null, encolada: true };
  }

  const supabase = clienteNavegador();
  const { error } = await supabase.from(tabla).update(cambios).eq("id", id);

  if (!error) return { error: null, encolada: false };

  if (esFallaDeRed(error)) {
    encolar({ id, operacion: "update", tabla, fila: cambios, descripcion });
    return { error: null, encolada: true };
  }

  return { error: error.message, encolada: false };
}

/** Un archivo pasado a texto, que es lo único que `localStorage` sabe guardar. */
async function aBase64(archivo: Blob): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let s = "";
  // De a pedazos: pasarle cien mil bytes de una a `fromCharCode` desborda la
  // pila del navegador.
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

function deBase64(texto: string, tipo: string): Blob {
  const bin = atob(texto);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/** Dos megas de archivo en la cola. Ver el comentario de `Pendiente.archivo`. */
const TOPE_ARCHIVO = 2 * 1024 * 1024;

/**
 * Sube un archivo, y si no hay señal lo guarda para después.
 *
 * `id` identifica la operación dentro de la cola, no la fila: para el PDF de
 * una cotización es el id de la cotización, así que reintentar no duplica.
 */
export async function subir(
  bucket: string,
  ruta: string,
  archivo: File | Blob,
  id: string,
  descripcion: string,
): Promise<ResultadoEscritura> {
  const guardarParaDespues = async () => {
    if (archivo.size > TOPE_ARCHIVO) {
      // Se prefiere perder el archivo antes que la cotización: el cliente ya
      // tiene su copia, y el documento se puede volver a emitir.
      return { error: null, encolada: false };
    }
    encolar({
      id,
      operacion: "subir",
      tabla: bucket,
      fila: {},
      bucket,
      ruta,
      tipo: archivo.type || "application/octet-stream",
      archivo: await aBase64(archivo),
      descripcion,
    });
    return { error: null, encolada: true };
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) return guardarParaDespues();

  const supabase = clienteNavegador();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true });

  if (!error) return { error: null, encolada: false };
  if (esFallaDeRed(error as { message?: string })) return guardarParaDespues();

  return { error: error.message, encolada: false };
}

/**
 * Intenta vaciar la cola.
 *
 * Se llama al recuperar la señal y al abrir la aplicación. Devuelve cuántas
 * quedaron, para que el aviso diga la verdad.
 *
 * **Al primer fallo de red se detiene** y deja el resto para la próxima. Antes
 * seguía de largo, y con una sola operación por fila daba igual; ahora no: si
 * la cotización no llegó, marcarla emitida no encontraría nada que marcar y esa
 * actualización se descartaría por «rechazo que no va a cambiar solo». El
 * documento quedaría de borrador para siempre.
 */
type FalloSupabase = { message?: string; code?: string } | null;

/** Manda una sola pendiente, según lo que sea. Devuelve el fallo, o null. */
async function enviarUna(
  supabase: ReturnType<typeof clienteNavegador>,
  p: Pendiente,
): Promise<FalloSupabase> {
  switch (p.operacion ?? "insert") {
    case "update": {
      const { error } = await supabase.from(p.tabla).update(p.fila).eq("id", p.id);
      return error;
    }
    case "subir": {
      if (!p.bucket || !p.ruta || !p.archivo) return null; // nada que subir
      const { error } = await supabase.storage
        .from(p.bucket)
        .upload(p.ruta, deBase64(p.archivo, p.tipo ?? "application/octet-stream"), {
          contentType: p.tipo,
          upsert: true,
        });
      return error as FalloSupabase;
    }
    default: {
      const { error } = await supabase.from(p.tabla).insert(p.fila);
      return error;
    }
  }
}

export async function sincronizar(): Promise<{ enviadas: number; quedan: number }> {
  const cola = leer();
  if (cola.length === 0) return { enviadas: 0, quedan: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { enviadas: 0, quedan: cola.length };
  }

  const supabase = clienteNavegador();
  const restantes: Pendiente[] = [];
  let enviadas = 0;

  for (let i = 0; i < cola.length; i++) {
    const p = cola[i];
    const error = await enviarUna(supabase, p);

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

    // Falla de red: se conserva ésta y **todo lo que venía detrás**, sin
    // intentarlo. Adelantarse rompería el encadenamiento — ver la nota de
    // arriba sobre la cotización que quedaría de borrador para siempre.
    const intentos = p.intentos + 1;
    if (intentos < MAX_INTENTOS) restantes.push({ ...p, intentos });
    restantes.push(...cola.slice(i + 1));
    break;
  }

  escribir(restantes);
  anunciar();

  return { enviadas, quedan: restantes.length };
}
