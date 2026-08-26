// De dónde salen las credenciales.
//
// **Dos lugares, y el orden importa.** En la computadora del desarrollador
// están en `.env.local`, que no se sube al repositorio. En la tarea programada
// —que corre en un servidor donde no existe ese archivo— llegan como variables
// de entorno.
//
// Se prefiere el entorno sobre el archivo, no al revés: si algún día se corre
// la pasada contra producción desde una máquina que tiene su `.env.local` de
// desarrollo apuntando a `sgv-pacsa-dev`, ganar el archivo escribiría en la
// base equivocada. Es el error más caro que puede cometer este código y por eso
// se decide aquí y una sola vez.

import { readFileSync } from "node:fs";

function delArchivo(raiz) {
  try {
    const texto = readFileSync(new URL(".env.local", raiz), "utf8");
    const vars = {};
    for (const linea of texto.split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return vars;
  } catch {
    // No estar no es un error: en el servidor nunca está.
    return {};
  }
}

/**
 * Devuelve las credenciales, o corta la ejecución diciendo cuáles faltan.
 *
 * @param {string[]} requeridas Claves sin las que no se puede seguir.
 */
export function entorno(requeridas = []) {
  const archivo = delArchivo(new URL("../", import.meta.url));

  const vars = {};
  for (const clave of new Set([
    ...Object.keys(archivo),
    ...Object.keys(process.env),
  ])) {
    const valor = process.env[clave] ?? archivo[clave];
    if (valor) vars[clave] = valor;
  }

  const faltan = requeridas.filter((k) => !vars[k]);

  if (faltan.length) {
    console.error(`\n  Faltan: ${faltan.join(", ")}`);
    console.error(
      "\n  En tu máquina van en .env.local, en la raíz del proyecto.\n" +
        "  En la tarea programada, como secretos del repositorio.\n" +
        "  El paso a paso de las credenciales de Zoho está en docs/15-zoho.md.\n",
    );
    process.exit(1);
  }

  // **Seguro contra escribir en la base equivocada.**
  //
  // Cuando el piloto corra contra producción, la tarea programada va a tener
  // los secretos de producción y esta misma máquina los de desarrollo. Un
  // secreto mal pegado no da error: escribe, y escribe bien — en el proyecto
  // que no era. Se nota semanas después, cuando los números no cuadran.
  //
  // Si `SUPABASE_REF_ESPERADO` está puesto, la pasada comprueba que la
  // dirección apunte a ese proyecto y se detiene si no. Sin poner, no estorba.
  const esperado = vars.SUPABASE_REF_ESPERADO;
  const url = vars.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (esperado && !url.includes(esperado)) {
    console.error(
      `\n  ALTO: se esperaba escribir en el proyecto «${esperado}» y la` +
        "\n  dirección de Supabase apunta a otro. No se hizo nada.\n",
    );
    process.exit(1);
  }

  // **Se dice a dónde va a escribir, siempre.** En el registro de la tarea de
  // la noche es lo primero que uno quiere ver cuando algo salió raro, y el
  // código del proyecto no es un secreto: viaja en cada petición del navegador.
  const ref = url.replace(/^https:\/\//, "").replace(/\.supabase\.co.*$/, "");
  if (ref) console.log(`  Escribiendo en el proyecto ${ref}.`);

  return { ...vars, ZOHO_DOMINIO: vars.ZOHO_DOMINIO || "zoho.com" };
}

/** Las que necesita cualquier pasada que escriba en la base desde Zoho. */
export const DE_ZOHO = [
  "ZOHO_ORG_ID",
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_REFRESH_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
