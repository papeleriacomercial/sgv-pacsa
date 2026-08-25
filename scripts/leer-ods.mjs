// Lee una hoja de cálculo .ods y la devuelve como filas de texto.
//
//   import { leerOds } from "./leer-ods.mjs";
//   const filas = await leerOds("datos/Cuentas en Badger.ods");
//
// Un .ods es un zip con un `content.xml` dentro. Se descomprime con `unzip`,
// que viene con Git para Windows y con cualquier Linux — más simple que meter
// una dependencia solo para esto.
//
// **Lo que hay que respetar es la compresión de celdas repetidas.** LibreOffice
// no escribe cien celdas vacías: escribe una con `number-columns-repeated=100`.
// Leerlas sin expandir descuadra todas las columnas siguientes, y el desfase
// no se nota hasta que un teléfono aparece en la columna del correo.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENTIDADES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function texto(bruto) {
  return bruto
    .replace(/<text:s\/>/g, " ")
    .replace(/<text:s [^>]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, (e) => ENTIDADES[e] ?? e)
    .trim();
}

/** Filas de la primera hoja, cada una como arreglo de textos. */
export function leerOds(ruta) {
  const carpeta = mkdtempSync(join(tmpdir(), "ods-"));
  let xml;
  try {
    execFileSync("unzip", ["-o", "-q", ruta, "content.xml", "-d", carpeta]);
    xml = readFileSync(join(carpeta, "content.xml"), "utf8");
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }

  const filas = [];

  for (const m of xml.matchAll(
    /<table:table-row([^>]*)>([\s\S]*?)<\/table:table-row>|<table:table-row([^>]*)\/>/g,
  )) {
    const atributosFila = m[1] ?? m[3] ?? "";
    const cuerpo = m[2] ?? "";

    const celdas = [];
    // **La celda vacía va primero en la alternativa, y no es un detalle.**
    // Una celda sin contenido se escribe `<table:table-cell/>`. Si se prueba
    // antes la forma con cierre, `([^>]*)>` se come la barra del autocierre y
    // `[\s\S]*?` sigue avanzando hasta el `</table:table-cell>` de la celda
    // siguiente, que queda absorbida. La fila sale más corta y todas las
    // columnas corridas — y el desfase no se nota hasta que un teléfono
    // aparece en la columna del correo.
    for (const c of cuerpo.matchAll(
      /<table:(?:covered-)?table-cell([^>]*?)\/>|<table:(?:covered-)?table-cell([^>]*?)>([\s\S]*?)<\/table:(?:covered-)?table-cell>/g,
    )) {
      const atributos = c[1] ?? c[2] ?? "";
      const contenido = c[3] ?? "";

      const parrafos = [...contenido.matchAll(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g)]
        .map((p) => texto(p[1]))
        .filter(Boolean);

      const valor = parrafos.join(" ");

      const repite = Number(
        /table:number-columns-repeated="(\d+)"/.exec(atributos)?.[1] ?? 1,
      );

      // Un repetido enorme al final es el relleno de la hoja hasta la columna
      // 1024, no datos. Se corta.
      if (repite > 100 && !valor) break;
      for (let i = 0; i < repite; i++) celdas.push(valor);
    }

    // Las filas también se comprimen, pero solo cuando están vacías: repetir
    // una fila con datos no ocurre en una exportación.
    const repiteFila = Number(
      /table:number-rows-repeated="(\d+)"/.exec(atributosFila)?.[1] ?? 1,
    );
    if (celdas.some(Boolean)) {
      for (let i = 0; i < Math.min(repiteFila, 5); i++) filas.push(celdas);
    }
  }

  return filas;
}

// Ejecutado directamente, enseña las columnas y una muestra.
if (process.argv[1]?.endsWith("leer-ods.mjs")) {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("\n  Uso: node scripts/leer-ods.mjs <archivo.ods>\n");
    process.exit(1);
  }

  const filas = leerOds(ruta);
  const cabecera = filas[0] ?? [];

  console.log(`\n  ${filas.length - 1} filas · ${cabecera.length} columnas\n`);

  const datos = filas.slice(1);
  cabecera.forEach((nombre, i) => {
    const llenas = datos.filter((f) => (f[i] ?? "").trim()).length;
    const pct = Math.round((llenas / datos.length) * 100);
    const ejemplo = datos.find((f) => (f[i] ?? "").trim())?.[i] ?? "";
    console.log(
      `  ${String(i).padStart(2)}  ${String(pct).padStart(3)}%  ` +
        `${(nombre || "(sin título)").padEnd(22)} ${ejemplo.slice(0, 42)}`,
    );
  });
  console.log("");
}
