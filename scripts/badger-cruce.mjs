// Lee el archivo de Badger y lo cruza contra las cuentas del SGV.
//
// Lo usan los dos programas de Badger —el que informa y el que carga— para que
// **la clasificación sea exactamente la misma**. Si cada uno tuviera su copia
// de las reglas, el informe diría una cosa y la carga haría otra.

import { readFileSync } from "node:fs";
import { leerOds } from "./leer-ods.mjs";

/**
 * Correo de cada vendedor en Badger, contra su perfil del SGV.
 *
 * Se escribe a mano: el correo vive en `auth.users`, al que la API de datos no
 * llega. Son tres personas.
 */
export const VENDEDORES = [
  ["papeleriacomercial.abatista@gmail.com", "9efc15ed-b081-4b5f-afd4-3b6a38ea774f"],
  ["papeleriacomercial.jarodriguez@gmail.com", "fa677652-aa5b-4353-923d-8292b27abb31"],
  ["papeleriacomercial.cguerra@gmail.com", "a82699a0-f762-4f76-842b-9e9e3b9397a5"],
];

/**
 * El vendedor del interior trabaja por pueblos; los de ciudad, por zonas.
 *
 * A Albert se le puede poner el poblado porque la dirección de Badger trae el
 * pueblo de verdad —Santiago, Aguadulce, Las Tablas—. A Javier no: sus
 * direcciones dicen «Panamá» 98 veces y «San Miguelito» 60, que no es una zona
 * de trabajo sino la ciudad entera. Ponérselo llenaría el campo de una palabra
 * inútil y, peor, haría creer que ya está resuelto.
 */
export const PONER_POBLADO = new Set(["papeleriacomercial.abatista@gmail.com"]);

/** Cuentas técnicas de Badger, no negocios. */
const TECNICA = /^\s*zzz|no borrar|do not delete/i;

const VACIAS = new Set([
  "sa", "s", "a", "srl", "corp", "corporation", "inc", "ltd", "cia", "y",
  "de", "del", "la", "el", "los", "las", "e", "en", "panama", "no",
]);

export function normalizar(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabras(t) {
  return normalizar(t).split(" ").filter((p) => p && !VACIAS.has(p));
}

/**
 * Cuánto se parecen dos nombres: 0 nada, 1 iguales.
 *
 * **Se divide entre el conjunto más grande, no entre el más pequeño.** Con el
 * más pequeño, «Pollo Asaito» contra «Asaito» daba 100 %, y «ABC Store Plus»
 * contra «ABC Store» también — dos negocios distintos cada par. Dividiendo
 * entre el más grande, lo que al otro le sobra cuenta en contra, que es lo
 * correcto: esas palabras de más suelen ser justo lo que distingue una
 * sucursal de otra.
 */
export function parecido(a, b) {
  const A = new Set(palabras(a));
  const B = new Set(palabras(b));
  if (A.size === 0 || B.size === 0) return 0;
  let comunes = 0;
  for (const p of A) if (B.has(p)) comunes += 1;
  return comunes / Math.max(A.size, B.size);
}

function comparten(a, b) {
  const B = new Set(palabras(b));
  return palabras(a).filter((p) => B.has(p)).length;
}

/** Cuántas letras hay que cambiar para pasar de una palabra a la otra. */
function distancia(x, y) {
  if (x === y) return 0;
  let previa = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const fila = [i];
    for (let j = 1; j <= y.length; j++) {
      fila[j] = Math.min(
        previa[j] + 1,
        fila[j - 1] + 1,
        previa[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    previa = fila;
  }
  return previa[y.length];
}

/**
 * Si los dos nombres, quitándoles la paja, son el mismo.
 *
 * **Se comparan las palabras que distinguen, no la cadena entera.** «RAPOPAN»
 * y «RapoPan, S.A.» son el mismo negocio, pero como cadenas normalizadas dan
 * «rapopan» contra «rapopan s a» y no coincidían — el sufijo societario
 * mandaba a revisión manual una pareja evidente. Lo mismo con «Emasal» y
 * «Emasal de Panamá S.A».
 *
 * Se admite además un dedazo: «Mini Super Valle Centro» contra «Mni Super
 * Valle Centro» está a una letra, y era un emparejamiento bueno escondido tras
 * una errata de captura.
 */
function mismoNombre(a, b) {
  const x = palabras(a).sort().join(" ");
  const y = palabras(b).sort().join(" ");
  if (!x || !y) return false;
  if (x === y) return true;
  // Un solo dedazo, y solo en nombres largos: en uno de cuatro letras, un
  // cambio ya es otra palabra.
  return Math.min(x.length, y.length) >= 10 && distancia(x, y) <= 1;
}

export function telefono(t) {
  const d = String(t ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-7) : null;
}

/**
 * El pueblo, sacado de la dirección.
 *
 * Badger escribe «Calle 5ta, Aguadulce, Provincia de Coclé, Panamá». La última
 * parte es el país y la penúltima la provincia, así que el pueblo es la
 * antepenúltima. Si la dirección es corta o son coordenadas, no hay pueblo que
 * sacar y se deja vacío — que es mejor que inventarlo.
 */
export function pobladoDe(direccion) {
  const d = String(direccion ?? "").trim();
  if (!d || /^-?\d+\.\d+\s*,/.test(d)) return null;

  const partes = d.split(",").map((s) => s.trim()).filter(Boolean);
  if (partes.length < 3) return null;

  const pueblo = partes[partes.length - 3];
  // Un número de casa o un código no es un pueblo.
  if (!pueblo || /^\d/.test(pueblo) || pueblo.length < 3) return null;
  return pueblo;
}

const LINEAS = [
  ["Interés en Rollos", "rollos_fiscales"],
  ["Interés en Bolsas", "bolsas_papel"],
  ["Interés en Resmas", "otros"],
  ["Interés en Tubos", "tubos_carton"],
];

const VOLUMEN = { alta: "alta", media: "media", baja: "baja" };

const TIPO = {
  cliente: "cliente",
  "cliente pacsa": "cliente",
  prospecto: "prospecto",
  potencial: "potencial",
};

/** Las cuentas del archivo, ya limpias y con sus campos interpretados. */
export function leerBadger(ruta) {
  const filas = leerOds(ruta);
  const cab = filas[0].map((c) => c.trim());
  const col = (n) => cab.indexOf(n);

  const i = {
    nombre: col("_Name"),
    direccion: col("_Address"),
    telefono: col("_Phone"),
    correo: col("_Email"),
    lat: col("_Latitude"),
    lng: col("_Longitude"),
    dueno: col("_AccountOwner"),
    tipo: col("Tipo Cuenta"),
    segmento: col("Segmento Cuenta"),
    categoria: col("Categoría cuenta"),
    contacto: col("Nombre Contacto"),
    titulo: col("Título"),
    proximo: col("Próximo Paso"),
  };

  const cuentas = [];
  const tecnicas = [];

  for (const f of filas.slice(1)) {
    const nombre = (f[i.nombre] ?? "").trim();
    if (!nombre) continue;

    if (TECNICA.test(nombre)) {
      tecnicas.push(nombre);
      continue;
    }

    const lat = Number(f[i.lat]);
    const lng = Number(f[i.lng]);
    const dueno = (f[i.dueno] ?? "").trim().toLowerCase();
    const direccion = (f[i.direccion] ?? "").trim();

    const interes = LINEAS.filter(([c]) => /^s/i.test((f[col(c)] ?? "").trim()))
      .map(([, valor]) => valor);

    cuentas.push({
      nombre,
      // Coordenadas solo si son números válidos. Se aceptan fuera de Panamá:
      // hay clientes reales en Puerto Rico.
      lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
      lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
      // La dirección de Badger es texto libre, o a veces las coordenadas
      // repetidas. En ese caso no es una dirección y no se guarda.
      direccion: /^-?\d+\.\d+\s*,/.test(direccion) ? null : direccion || null,
      poblado: PONER_POBLADO.has(dueno) ? pobladoDe(direccion) : null,
      telefono: (f[i.telefono] ?? "").trim() || null,
      telefonoComparable: telefono(f[i.telefono]),
      correo: (f[i.correo] ?? "").trim() || null,
      dueno,
      tipo: TIPO[normalizar(f[i.tipo] ?? "")] ?? "potencial",
      segmento: (f[i.segmento] ?? "").trim() || null,
      volumen: VOLUMEN[normalizar(f[i.categoria] ?? "")] ?? null,
      contacto: (f[i.contacto] ?? "").trim() || null,
      titulo: (f[i.titulo] ?? "").trim() || null,
      proximo: (f[i.proximo] ?? "").trim() || null,
      interes: interes.length ? interes : null,
    });
  }

  return { cuentas, tecnicas };
}

/**
 * Reparte las cuentas de Badger en seguras, dudosas y sin correspondencia.
 *
 * Para dar una pareja por segura hacen falta cuatro cosas a la vez, y es a
 * propósito: un punto en el sitio equivocado manda al vendedor a otra puerta.
 *
 *   1. Que el nombre coincida entero, o que el teléfono sea el mismo.
 *   2. Que compartan más de una palabra distintiva — con una sola, «Conway
 *      Store» encaja con «Health Store» y con «Nany Store».
 *   3. Que sea del mismo vendedor. Que Albert tenga en Badger un local que en
 *      el SGV es de Javier casi siempre significa que no es el mismo.
 *   4. Que no haya otro candidato pisándole los talones: «Super Carnes 12» y
 *      «Super Carnes 14» se parecen las dos, y por eso ninguna es segura.
 */
export function cruzar(badger, cuentas) {
  const perfilDe = new Map(VENDEDORES);

  const seguros = [];
  const dudosos = [];
  const nuevos = [];

  for (const b of badger) {
    const perfil = perfilDe.get(b.dueno) ?? null;

    const puntuadas = cuentas
      .map((c) => ({
        c,
        punto: parecido(b.nombre, c.nombre),
        mismoTel: Boolean(
          b.telefonoComparable &&
            telefono(c.contacto_telefono) === b.telefonoComparable,
        ),
        juntas: comparten(b.nombre, c.nombre),
        mismoDueno: perfil !== null && c.vendedor_id === perfil,
      }))
      .filter((x) => x.punto >= 0.6 || x.mismoTel)
      .sort(
        (a, b2) => b2.punto - a.punto || Number(b2.mismoTel) - Number(a.mismoTel),
      );

    const conPerfil = { ...b, perfil };

    if (puntuadas.length === 0) {
      nuevos.push(conPerfil);
      continue;
    }

    const mejor = puntuadas[0];
    const segundo = puntuadas[1];
    const claro = !segundo || mejor.punto - segundo.punto >= 0.25;
    const igual = mismoNombre(b.nombre, mejor.c.nombre);
    const distintivo = mejor.juntas >= 2 || igual;

    if (
      (igual || mejor.mismoTel) &&
      distintivo &&
      mejor.mismoDueno &&
      claro
    ) {
      seguros.push({ b: conPerfil, c: mejor.c, punto: mejor.punto, tel: mejor.mismoTel });
    } else {
      dudosos.push({ b: conPerfil, candidatos: puntuadas.slice(0, 3) });
    }
  }

  return { seguros, dudosos, nuevos };
}

// --- Acceso a Supabase, compartido -----------------------------------------

export function entorno() {
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const vars = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

export function conectar(env) {
  return async function sb(ruta, opciones = {}) {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, {
      ...opciones,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: opciones.prefer ?? "return=representation",
      },
    });
    const texto = await r.text();
    if (!r.ok) {
      console.error(`\n  Supabase ${r.status} en ${ruta}:\n  ${texto}\n`);
      process.exit(1);
    }
    return texto ? JSON.parse(texto) : null;
  };
}
