// ===========================================================================
// EL HISTÓRICO MENSUAL DE CADA VENDEDOR — docs/18-plan-diario.md §5.8
//
// Sale el día 1 de cada mes y llega al correo de gerencia. Lo pidió el usuario
// el 25 de octubre de 2026, al contestar la pregunta de si había meta por
// vendedor:
//
//     «Colocar metas es una conversación personal con cada uno, ya que son
//      circunstancias diferentes. Lo que necesito ahora mismo es el reporte
//      mensual del histórico de los vendedores con información por cada uno, lo
//      que ha logrado por mes, y luego con esa información tener una
//      conversación y establecer una meta acordada… Por el momento necesito un
//      reporte histórico que me llegue al correo todos los meses el día uno.»
//
// **El orden es el correcto y conviene no invertirlo:** primero se mira lo que
// cada uno logró, después se conversa, y recién entonces se pone una meta. Una
// meta puesta antes de mirar el histórico es un número inventado, y se descubre
// a la tercera semana.
//
// ---------------------------------------------------------------------------
// NO HAY TABLA NUEVA, Y ES LO MEJOR DE ESTE REPORTE
// ---------------------------------------------------------------------------
//
// Todo sale de lo que la pasada de Zoho ya trae cada noche:
//
//   · `ventas_del_mes`        facturado, neto y documentos por vendedor y mes
//   · `transacciones_zoho`    para contar clientes distintos, que la vista no da
//   · `comision_del_mes()`    la comisión, con la regla vigente
//
// **La comisión se pide a la base y no se recalcula acá.** Es dinero que alguien
// cobra: si la fórmula viviera en dos sitios, el día que cambie el porcentaje
// uno de los dos va a quedar viejo y nadie se va a enterar hasta el pago.
//
// ---------------------------------------------------------------------------
// QUIÉN ES VENDEDOR, SEGÚN ESTE REPORTE
// ---------------------------------------------------------------------------
//
// Quien esté en `vendedores_zoho`, o sea quien tenga ventas atribuidas en Books.
// **No se filtra por el rol del perfil**, y es a propósito: Christopher Guerra
// es `lider` y vende más que nadie. Un reporte que lo dejara fuera por su rol
// sería un reporte que miente sobre el equipo.
//
// ---------------------------------------------------------------------------
// LO QUE SE COMPARA, Y LO QUE NO
// ---------------------------------------------------------------------------
//
// El año en curso se compara contra **el mismo período** del año anterior —
// enero a octubre contra enero a octubre— y nunca contra el año anterior
// completo. Dos números ciertos puestos uno al lado del otro pueden engañar:
// «$178 000 contra $210 000» leído sin saber que uno son diez meses y el otro
// doce es una caída que no existe.
// ===========================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { jsPDF } from "jspdf";
import { entorno } from "./entorno.mjs";
import { mandarCorreo, DE_CORREO } from "./correo-enviar.mjs";

const SECO = process.argv.includes("--seco");
const MES_PEDIDO = (process.argv.find((a) => /^--mes=/.test(a)) ?? "").split("=")[1];

/** Cuántos meses se listan. Trece deja ver el mismo mes del año anterior. */
const MESES = 13;

const env = entorno(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

// ---------------------------------------------------------------------------
// La base
// ---------------------------------------------------------------------------

async function sb(ruta, opciones = {}) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, {
    ...opciones,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(opciones.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${ruta} → ${r.status} ${await r.text()}`);
  return r.json();
}

/**
 * Trae una tabla entera, de mil en mil.
 *
 * **PostgREST corta en mil filas y no avisa.** Sin esto el conteo de clientes
 * distintos saldría bien en las pruebas —pocos datos— y mal en producción, que
 * es la peor forma de equivocarse: un número más chico que el real, sin error.
 */
async function todas(ruta) {
  const filas = [];
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    const trozo = await sb(ruta, {
      headers: { Range: `${desde}-${desde + PAGINA - 1}`, "Range-Unit": "items" },
    });
    filas.push(...trozo);
    if (trozo.length < PAGINA) break;
  }
  return filas;
}

/** Los correos de verdad de cada perfil, que viven en Auth y no en `perfiles`. */
async function correosDeAuth() {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) {
    // No poder leer los correos no justifica no generar el reporte.
    console.log(`  No se pudieron leer los correos de Auth (${r.status}).`);
    return new Map();
  }
  const { users } = await r.json();
  return new Map((users ?? []).map((u) => [u.id, u.email]));
}

// ---------------------------------------------------------------------------
// Fechas y formato
// ---------------------------------------------------------------------------

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Clave AAAA-MM-01, que es como `ventas_del_mes` devuelve el mes. */
function clave(anio, mes0) {
  return `${anio}-${String(mes0 + 1).padStart(2, "0")}-01`;
}

/**
 * El último mes cerrado.
 *
 * **Corriendo el día 1, el mes cerrado es el anterior.** Si alguien corre el
 * reporte un 15 por su cuenta, sigue siendo el anterior: un mes a medias en una
 * columna que dice «mes» es el número que después nadie entiende.
 */
function mesDeCierre() {
  if (MES_PEDIDO) {
    const [a, m] = MES_PEDIDO.split("-").map(Number);
    return { anio: a, mes0: m - 1 };
  }
  const hoy = new Date();
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return { anio: anterior.getFullYear(), mes0: anterior.getMonth() };
}

const DINERO = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const CENTAVOS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Un guion y no un cero cuando el dato no existe. */
function oNada(v, formato = DINERO) {
  return v == null ? "—" : formato.format(v);
}

// ---------------------------------------------------------------------------
// Los datos
// ---------------------------------------------------------------------------

async function reunir() {
  const cierre = mesDeCierre();

  const [perfiles, mapeos, ventas, correos] = await Promise.all([
    sb("/perfiles?select=id,nombre,rol,deleted_at"),
    sb("/vendedores_zoho?select=nombre_zoho,perfil_id&deleted_at=is.null"),
    sb("/ventas_del_mes?select=*"),
    correosDeAuth(),
  ]);

  const nombre = new Map(perfiles.map((p) => [p.id, p.nombre]));
  const rol = new Map(perfiles.map((p) => [p.id, p.rol]));

  // Los vendedores son los que Books reconoce, ordenados por nombre para que el
  // reporte salga igual todos los meses y se pueda comparar con el del mes
  // pasado sin buscar.
  const vendedores = [...new Set(mapeos.map((m) => m.perfil_id))]
    .filter((id) => nombre.has(id))
    .map((id) => ({ id, nombre: nombre.get(id), rol: rol.get(id), correo: correos.get(id) ?? null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Clientes distintos por vendedor y mes. La vista no los da: contar valores
  // distintos no se puede pedir por PostgREST, así que se cuenta acá.
  const trans = await todas(
    "/transacciones_zoho?select=fecha,perfil_id,contacto_id&deleted_at=is.null&order=fecha.asc",
  );
  const clientes = new Map(); // `${perfil}|${AAAA-MM-01}` → Set de contactos
  for (const t of trans) {
    if (!t.perfil_id) continue;
    const k = `${t.perfil_id}|${t.fecha.slice(0, 7)}-01`;
    if (!clientes.has(k)) clientes.set(k, new Set());
    clientes.get(k).add(t.contacto_id);
  }

  // Desde cuándo hay datos. **Es lo que evita escribir $0 donde la verdad es
  // «no se sabe»:** un mes anterior al primer documento sale con guion.
  const primerMes = trans.length ? trans[0].fecha.slice(0, 7) + "-01" : null;

  const porVendedorMes = new Map();
  for (const v of ventas) {
    if (!v.perfil_id) continue;
    porVendedorMes.set(`${v.perfil_id}|${v.mes}`, v);
  }

  // La comisión, pedida a la base una vez por vendedor y mes listado.
  const meses = [];
  for (let i = MESES - 1; i >= 0; i--) {
    const d = new Date(cierre.anio, cierre.mes0 - i, 1);
    meses.push({ anio: d.getFullYear(), mes0: d.getMonth(), clave: clave(d.getFullYear(), d.getMonth()) });
  }

  const comisiones = new Map();
  for (const v of vendedores) {
    for (const m of meses) {
      const fila = porVendedorMes.get(`${v.id}|${m.clave}`);
      if (!fila) continue;
      const [c] = await sb("/rpc/comision_del_mes", {
        method: "POST",
        body: JSON.stringify({ p_perfil: v.id, p_mes: m.clave }),
      });
      if (c) comisiones.set(`${v.id}|${m.clave}`, c);
    }
  }

  /** Lo acumulado de un vendedor entre dos meses de un año. */
  function acumulado(perfilId, anio, hastaMes0) {
    let facturado = 0;
    let neto = 0;
    let documentos = 0;
    const contactos = new Set();
    let hubo = false;
    for (let m = 0; m <= hastaMes0; m++) {
      const k = `${perfilId}|${clave(anio, m)}`;
      const fila = porVendedorMes.get(k);
      if (fila) {
        hubo = true;
        facturado += Number(fila.total);
        neto += Number(fila.neto);
        documentos += Number(fila.documentos);
      }
      for (const c of clientes.get(k) ?? []) contactos.add(c);
    }
    if (!hubo) return null;
    return { facturado, neto, documentos, clientes: contactos.size };
  }

  const filas = vendedores.map((v) => ({
    ...v,
    meses: meses.map((m) => {
      const fila = porVendedorMes.get(`${v.id}|${m.clave}`);
      const antes = primerMes && m.clave < primerMes;
      if (antes) return { ...m, sinDatos: true };
      const facturado = fila ? Number(fila.total) : 0;
      const documentos = fila ? Number(fila.documentos) : 0;
      const com = comisiones.get(`${v.id}|${m.clave}`);
      // El mismo mes del año anterior, sólo si cae dentro de los datos.
      const anterior = clave(m.anio - 1, m.mes0);
      const filaAnt = porVendedorMes.get(`${v.id}|${anterior}`);
      const hayAnterior = !primerMes || anterior >= primerMes;
      return {
        ...m,
        facturado,
        documentos,
        clientes: (clientes.get(`${v.id}|${m.clave}`) ?? new Set()).size,
        ticket: documentos > 0 ? facturado / documentos : null,
        comision: com ? Number(com.comision) : null,
        anterior: hayAnterior ? (filaAnt ? Number(filaAnt.total) : 0) : null,
      };
    }),
    enCurso: acumulado(v.id, cierre.anio, cierre.mes0),
    mismoPeriodoAntes: acumulado(v.id, cierre.anio - 1, cierre.mes0),
  }));

  // Lo que Books no atribuye a ningún vendedor de calle. **Se muestra aparte y
  // con su nombre**, nunca sumado al equipo: son cientos de documentos al mes y
  // mezclarlos haría que cualquier porcentaje por vendedor fuera falso.
  const sinVendedor = ventas
    .filter((v) => !v.perfil_id)
    .reduce(
      (acc, v) => {
        const d = new Date(v.mes);
        if (d.getFullYear() === cierre.anio && d.getMonth() <= cierre.mes0) {
          acc.facturado += Number(v.total);
          acc.documentos += Number(v.documentos);
        }
        return acc;
      },
      { facturado: 0, documentos: 0 },
    );

  return { cierre, meses, filas, sinVendedor, primerMes };
}

// ---------------------------------------------------------------------------
// El PDF. Mismos colores y medidas que la cotización: son la misma casa.
// ---------------------------------------------------------------------------

const ANCHO = 216;
const MARGEN = 14;
const DERECHA = ANCHO - MARGEN;
const TINTA = [60, 61, 58];
const SUAVE = [120, 122, 118];
const LINEA = [200, 200, 198];
const FONDO = [245, 244, 243];
const VERDE = [21, 128, 61];
const ROJO = [185, 28, 28];

/** Las columnas, medidas desde el margen. Cuadran en 188 mm de ancho útil. */
const COL = { mes: MARGEN, facturado: 62, docs: 80, clientes: 104, ticket: 130, comision: 160, vs: DERECHA };

function titulo(doc, datos) {
  const { cierre } = datos;
  let y = 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TINTA);
  doc.text("HISTÓRICO DE VENTAS POR VENDEDOR", MARGEN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUAVE);
  y += 6;
  doc.text(
    `Cerrado a ${MES_LARGO[cierre.mes0]} de ${cierre.anio}. Para conversar la meta, no para medirla.`,
    MARGEN,
    y,
  );
  return y + 8;
}

function cabeceraTabla(doc, y) {
  doc.setFillColor(...FONDO);
  doc.rect(MARGEN - 2, y - 4.5, DERECHA - MARGEN + 4, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUAVE);
  doc.text("MES", COL.mes, y);
  doc.text("FACTURADO", COL.facturado, y, { align: "right" });
  doc.text("DOCS", COL.docs, y, { align: "right" });
  doc.text("CLIENTES", COL.clientes, y, { align: "right" });
  doc.text("TICKET", COL.ticket, y, { align: "right" });
  doc.text("COMISIÓN", COL.comision, y, { align: "right" });
  doc.text("VS. AÑO ANT.", COL.vs, y, { align: "right" });
  return y + 7;
}

function paginaDeVendedor(doc, datos, v) {
  let y = titulo(doc, datos);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TINTA);
  const titular = v.nombre.toUpperCase();
  doc.text(titular, MARGEN, y);
  if (v.rol === "lider") {
    // **El ancho se mide ANTES de cambiar el tamaño de letra.** `getTextWidth`
    // responde con el tamaño que esté puesto en ese momento, así que medirlo
    // después de bajar a 8pt daría un ancho de 8pt para un texto dibujado a
    // 13pt — y la etiqueta se montaría encima del nombre.
    const anchoDelNombre = doc.getTextWidth(titular);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.text("además coordina el equipo", MARGEN + anchoDelNombre + 4, y);
  }
  y += 9;

  y = cabeceraTabla(doc, y);

  doc.setFontSize(9);
  for (const m of v.meses) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TINTA);
    doc.text(`${MES_CORTO[m.mes0]} ${String(m.anio).slice(2)}`, COL.mes, y);

    if (m.sinDatos) {
      doc.setTextColor(...SUAVE);
      doc.text("sin datos en el sistema", COL.facturado + 6, y);
      y += 6.2;
      continue;
    }

    doc.text(DINERO.format(m.facturado), COL.facturado, y, { align: "right" });
    doc.text(String(m.documentos), COL.docs, y, { align: "right" });
    doc.text(String(m.clientes), COL.clientes, y, { align: "right" });
    doc.text(oNada(m.ticket, CENTAVOS), COL.ticket, y, { align: "right" });
    doc.text(oNada(m.comision, CENTAVOS), COL.comision, y, { align: "right" });

    if (m.anterior == null) {
      doc.setTextColor(...SUAVE);
      doc.text("—", COL.vs, y, { align: "right" });
    } else if (m.anterior === 0) {
      doc.setTextColor(...SUAVE);
      doc.text("sin base", COL.vs, y, { align: "right" });
    } else {
      const delta = (m.facturado / m.anterior - 1) * 100;
      doc.setTextColor(...(delta >= 0 ? VERDE : ROJO));
      doc.text(`${delta >= 0 ? "+" : ""}${delta.toFixed(0)} %`, COL.vs, y, { align: "right" });
    }
    y += 6.2;
  }

  // El cierre del cuadro
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y - 2, DERECHA, y - 2);
  y += 4;

  const curso = v.enCurso;
  const antes = v.mismoPeriodoAntes;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TINTA);
  const periodo = `ene–${MES_CORTO[datos.cierre.mes0]}`;
  doc.text(`${periodo} ${datos.cierre.anio}`, COL.mes, y);
  if (curso) {
    doc.text(DINERO.format(curso.facturado), COL.facturado, y, { align: "right" });
    doc.text(String(curso.documentos), COL.docs, y, { align: "right" });
    doc.text(String(curso.clientes), COL.clientes, y, { align: "right" });
    doc.text(CENTAVOS.format(curso.facturado / Math.max(curso.documentos, 1)), COL.ticket, y, { align: "right" });
  }
  y += 6.2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SUAVE);
  doc.text(`${periodo} ${datos.cierre.anio - 1}`, COL.mes, y);
  if (antes) {
    doc.text(DINERO.format(antes.facturado), COL.facturado, y, { align: "right" });
    doc.text(String(antes.documentos), COL.docs, y, { align: "right" });
    doc.text(String(antes.clientes), COL.clientes, y, { align: "right" });
    doc.text(CENTAVOS.format(antes.facturado / Math.max(antes.documentos, 1)), COL.ticket, y, { align: "right" });
    if (curso && antes.facturado > 0) {
      const delta = (curso.facturado / antes.facturado - 1) * 100;
      doc.setTextColor(...(delta >= 0 ? VERDE : ROJO));
      doc.text(`${delta >= 0 ? "+" : ""}${delta.toFixed(0)} %`, COL.vs, y, { align: "right" });
    }
  } else {
    doc.text("sin datos de ese período", COL.facturado + 6, y);
  }
  y += 12;

  // Lo que se ve de un vistazo, y que es lo que abre la conversación.
  const conDatos = v.meses.filter((m) => !m.sinDatos && m.facturado > 0);
  if (conDatos.length > 0) {
    const mejor = conDatos.reduce((a, b) => (b.facturado > a.facturado ? b : a));
    const flojo = conDatos.reduce((a, b) => (b.facturado < a.facturado ? b : a));
    const promedio = conDatos.reduce((s, m) => s + m.facturado, 0) / conDatos.length;

    doc.setFillColor(...FONDO);
    doc.rect(MARGEN - 2, y - 5, DERECHA - MARGEN + 4, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    doc.text("PARA LA CONVERSACIÓN", MARGEN, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TINTA);
    doc.text(
      `Promedio de los ${conDatos.length} meses: ${DINERO.format(promedio)}.` +
        `   Mejor: ${MES_CORTO[mejor.mes0]} ${String(mejor.anio).slice(2)} con ${DINERO.format(mejor.facturado)}.` +
        `   Más flojo: ${MES_CORTO[flojo.mes0]} ${String(flojo.anio).slice(2)} con ${DINERO.format(flojo.facturado)}.`,
      MARGEN,
      y,
    );
    y += 5.5;
    const tickets = conDatos.filter((m) => m.ticket != null).map((m) => m.ticket);
    const ticketProm = tickets.reduce((s, t) => s + t, 0) / Math.max(tickets.length, 1);
    doc.setTextColor(...SUAVE);
    doc.text(
      `Ticket promedio ${CENTAVOS.format(ticketProm)}. La palanca está en subir el ticket o en vender más veces: ` +
        "son dos conversaciones distintas.",
      MARGEN,
      y,
    );
  }
}

function paginaDelEquipo(doc, datos) {
  let y = titulo(doc, datos);
  const { cierre, filas, sinVendedor } = datos;
  const periodo = `enero a ${MES_LARGO[cierre.mes0]}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TINTA);
  doc.text("EL EQUIPO", MARGEN, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUAVE);
  doc.text(`${periodo} de ${cierre.anio}, contra el mismo período de ${cierre.anio - 1}.`, MARGEN, y);
  y += 10;

  const maximo = Math.max(...filas.map((f) => f.enCurso?.facturado ?? 0), 1);

  for (const v of filas) {
    const curso = v.enCurso;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
    doc.text(v.nombre, MARGEN, y);
    doc.text(curso ? DINERO.format(curso.facturado) : "—", 95, y, { align: "right" });

    // La barra. Es lo único que se lee sin leer: el tamaño relativo.
    const largo = ((curso?.facturado ?? 0) / maximo) * 60;
    doc.setFillColor(...TINTA);
    doc.rect(100, y - 2.6, Math.max(largo, 0.4), 3, "F");

    if (curso && v.mismoPeriodoAntes && v.mismoPeriodoAntes.facturado > 0) {
      const delta = (curso.facturado / v.mismoPeriodoAntes.facturado - 1) * 100;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...(delta >= 0 ? VERDE : ROJO));
      doc.text(`${delta >= 0 ? "+" : ""}${delta.toFixed(0)} %`, DERECHA, y, { align: "right" });
    }
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.text(
      curso
        ? `${curso.documentos} documentos · ${curso.clientes} clientes distintos · ` +
            `ticket ${CENTAVOS.format(curso.facturado / Math.max(curso.documentos, 1))}`
        : "sin ventas atribuidas en el período",
      MARGEN,
      y,
    );
    y += 9;
  }

  y += 4;
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, DERECHA, y);
  y += 8;

  // ---------------------------------------------------------------------------
  // La advertencia que hay que decir con su dueño.
  //
  // Books atribuye a un vendedor de calle una fracción de lo que la empresa
  // factura; el resto —mostrador, oficina, clientes que llaman— no es de nadie
  // en el sistema. **Decirlo es obligatorio**: sin esta línea, alguien compara
  // la suma del equipo con las ventas de la empresa y concluye que los
  // vendedores venden el 15 % de la casa, que no es lo que el número dice.
  // ---------------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUAVE);
  doc.text("LO QUE ESTE REPORTE NO CUENTA", MARGEN, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  for (const linea of doc.splitTextToSize(
    `En el mismo período, Books facturó ${DINERO.format(sinVendedor.facturado)} en ` +
      `${sinVendedor.documentos} documentos sin ningún vendedor de calle asignado: mostrador, oficina y ` +
      "clientes que compran directo. No es de ninguno de los tres y por eso no se suma acá — pero tampoco " +
      "es cero, así que queda dicho.",
    DERECHA - MARGEN,
  )) {
    doc.text(linea, MARGEN, y);
    y += 4.6;
  }
  y += 4;
  doc.setTextColor(...SUAVE);
  doc.setFontSize(8);
  for (const linea of doc.splitTextToSize(
    "La comisión sale de la base con la regla vigente, sobre el neto sin ITBMS. Las cifras de facturado " +
      "incluyen el impuesto, así que la comisión no es el porcentaje exacto de la columna de al lado.",
    DERECHA - MARGEN,
  )) {
    doc.text(linea, MARGEN, y);
    y += 4.2;
  }
}

function armarPdf(datos) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.setFont("helvetica");

  paginaDelEquipo(doc, datos);
  for (const v of datos.filas) {
    doc.addPage();
    paginaDeVendedor(doc, datos, v);
  }

  // Pie con la paginación, al final para poder decir «de cuántas».
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    doc.text("SGV · Papelería Comercial", MARGEN, 272);
    doc.text(`${i} de ${total}`, DERECHA, 272, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// Correr
// ---------------------------------------------------------------------------

const datos = await reunir();
const { cierre } = datos;
const etiqueta = `${cierre.anio}-${String(cierre.mes0 + 1).padStart(2, "0")}`;
const pdf = armarPdf(datos);

mkdirSync("reportes", { recursive: true });
const ruta = `reportes/historico-vendedores-${etiqueta}.pdf`;
writeFileSync(ruta, pdf);
console.log(`\n  ${ruta} · ${(pdf.length / 1024).toFixed(0)} kB`);
for (const v of datos.filas) {
  console.log(
    `    ${v.nombre.padEnd(22)} ${(v.enCurso ? DINERO.format(v.enCurso.facturado) : "—").padStart(10)}` +
      ` en ${v.enCurso?.documentos ?? 0} documentos`,
  );
}

if (SECO) {
  console.log("\n  --seco: no se mandó correo.\n");
} else {
  // A gerencia. El perfil de Gerencia tiene su correo en Auth; un secreto lo
  // puede sobreescribir sin tocar código.
  const gerencia = env.CORREO_GERENCIA ? [env.CORREO_GERENCIA] : [];
  if (gerencia.length === 0) {
    const perfiles = await sb("/perfiles?select=id,rol&rol=eq.gerente&deleted_at=is.null");
    const correos = await correosDeAuth();
    for (const p of perfiles) if (correos.get(p.id)) gerencia.push(correos.get(p.id));
  }

  await mandarCorreo(env, {
    para: gerencia,
    asunto: `Histórico de ventas por vendedor · cerrado a ${MES_LARGO[cierre.mes0]} ${cierre.anio}`,
    cuerpo:
      `Adjunto el histórico de los ${datos.filas.length} vendedores, cerrado a ` +
      `${MES_LARGO[cierre.mes0]} de ${cierre.anio}.\n\n` +
      datos.filas
        .map(
          (v) =>
            `  ${v.nombre}: ${v.enCurso ? DINERO.format(v.enCurso.facturado) : "—"} ` +
            `en el año, ${v.enCurso?.documentos ?? 0} documentos, ` +
            `${v.enCurso?.clientes ?? 0} clientes distintos.`,
        )
        .join("\n") +
      "\n\nEl detalle mes por mes, con comisión y comparación contra el año anterior, va en el PDF.\n" +
      "Es para conversar la meta de cada uno, no para medirla: la meta todavía no está puesta.\n\n" +
      "SGV · Papelería Comercial\n",
    adjuntos: [{ nombre: `historico-vendedores-${etiqueta}.pdf`, contenido: pdf }],
  });
}

console.log(`  Credenciales de correo: ${DE_CORREO.map((k) => `${k}=${env[k] ? "sí" : "NO"}`).join(" · ")}\n`);
