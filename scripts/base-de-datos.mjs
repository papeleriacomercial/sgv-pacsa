// ---------------------------------------------------------------------------
// Hablar con la base desde una tarea programada.
//
// **Es `fetch` contra PostgREST y no el cliente de Supabase**, igual que las dos
// pasadas de Zoho: estas tareas corren en Node pelado y no importan ni una
// dependencia, así que la primera vez arrancan sin instalar nada.
//
// Entra con la llave de servicio, que **se salta el RLS por diseño**: una tarea
// que corre de noche no tiene sesión de nadie, y lo que tiene que leer es el
// trabajo de todos.
// ---------------------------------------------------------------------------

/** Cuántas filas devuelve PostgREST por página, y por tanto de cuánto en cuánto se pide. */
export const PAGINA = 1000;

export function conexion(env) {
  async function sb(ruta, opciones = {}) {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, {
      ...opciones,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: opciones.prefer ?? "return=representation",
        ...(opciones.headers ?? {}),
      },
    });
    if (!r.ok) throw new Error(`${ruta} → ${r.status} ${await r.text()}`);
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  }

  /**
   * Trae una tabla entera, de mil en mil.
   *
   * **PostgREST corta en mil filas y no avisa.** Sin esto, cualquier conteo
   * sobre una tabla grande saldría bien en las pruebas —pocos datos— y corto en
   * producción: un número más chico que el real, sin ningún error. Es la peor
   * forma de equivocarse.
   */
  async function todas(ruta) {
    const filas = [];
    for (let desde = 0; ; desde += PAGINA) {
      const trozo = await sb(ruta, {
        headers: { Range: `${desde}-${desde + PAGINA - 1}`, "Range-Unit": "items" },
      });
      filas.push(...trozo);
      if (trozo.length < PAGINA) break;
    }
    return filas;
  }

  /**
   * Los correos de verdad de cada perfil.
   *
   * **Viven en Auth y no en `perfiles`**, y es lo correcto: es la dirección con
   * la que cada uno entra a la aplicación, así que nadie tiene que mantenerla al
   * día en dos sitios. Si algún día un vendedor entra con una dirección que no
   * lee, ahí sí hará falta un campo aparte.
   *
   * **No poder leerlos no justifica no generar el reporte.** Devuelve un mapa
   * vacío y quien llama decide; un reporte sin enviar sigue sirviendo, y un
   * reporte que no se generó no sirve de nada.
   */
  async function correosDeAuth() {
    try {
      const r = await fetch(
        `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=200`,
        {
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (!r.ok) {
        console.log(`  No se pudieron leer los correos de Auth (${r.status}).`);
        return new Map();
      }
      const { users } = await r.json();
      return new Map((users ?? []).map((u) => [u.id, u.email]));
    } catch (e) {
      console.log(`  No se pudieron leer los correos de Auth (${e.message}).`);
      return new Map();
    }
  }

  return { sb, todas, correosDeAuth };
}

// ---------------------------------------------------------------------------
// Semanas y meses, en hora de Panamá
// ---------------------------------------------------------------------------

export const MES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Hoy, en Panamá. `new Date()` en el servidor de la tarea es UTC. */
export function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

/**
 * El lunes de la semana a la que pertenece una fecha.
 *
 * **Se calcula con mediodía UTC a propósito.** Partiendo de medianoche, una
 * fecha de Panamá cae el día anterior en UTC y el lunes sale corrido una semana
 * — un error que sólo aparece en las fechas de lunes, que es justo donde más
 * duele.
 */
export function lunesDe(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

/** Sumarle días a una fecha en texto, sin tocar husos. */
export function masDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** El primero del mes de una fecha, como lo devuelve `ventas_del_mes`. */
export function primeroDelMes(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export const DINERO = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const CENTAVOS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Un porcentaje de cumplimiento, o nulo cuando no hay contra qué.
 *
 * **Nulo y no cero cuando la meta es cero**: sin meta no hay cumplimiento del
 * 0 % ni del 100 %, no hay cumplimiento. Un cero ahí se leería como que no hizo
 * nada.
 */
export function cumplimiento(meta, hecho) {
  if (!(meta > 0)) return null;
  return Math.round((hecho / meta) * 100);
}
