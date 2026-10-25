// ===========================================================================
// EL REPORTE SEMANAL — docs/18-plan-diario.md §4.5
//
// Sale al cerrar el viernes, en una página 8½ × 11, **a gerencia y a cada
// vendedor el suyo**. Lo segundo lo pidió el usuario con sus palabras: *«debes
// enviárselo también al correo para que lo vean forzosamente en su bandeja de
// entrada de correo y hagan su propio análisis»*.
//
// ---------------------------------------------------------------------------
// EL VENDEDOR NO LO REDACTA, Y ES TODO EL CAMBIO
// ---------------------------------------------------------------------------
//
// El cierre semanal que esto reemplaza pedía tres párrafos —qué te sorprendió,
// qué te frenó, qué necesitas— y terminó lleno de frases puestas por salir del
// paso: *«yo estaba agarrando eso de poner cualquier frase ahí»*. Acá no hay
// nada que escribir: el reporte es la suma de cinco días de hechos que ya
// estaban registrados.
//
// ---------------------------------------------------------------------------
// LA SEMANA ES ENTERA, EL MES ES CALENDARIO
// ---------------------------------------------------------------------------
//
// Lo planteó el usuario: *«si el día 30 cae a media semana, cierra su número de
// la semana y al día siguiente inicia su conteo del mes siguiente, pero el
// reporte de la semana mantiene su integridad de lunes a viernes»*.
//
// La regla que lo resuelve sin excepciones: **un cierre pertenece al mes de la
// fecha de su factura.** Así la semana se cuenta entera y el acumulado del mes
// se imprime en dos renglones cuando la semana cae partida — nunca sumados en
// una sola línea, que es el número que nadie entiende tres semanas después.
//
// ---------------------------------------------------------------------------
// CLIENTES NUEVOS: LA PRIMERA COMPRA DE SU VIDA, Y SE CUENTAN
// ---------------------------------------------------------------------------
//
// Lo pidió el usuario el 25 de octubre de 2026: *«otro dato importante a
// monitorear con los vendedores son clientes nuevos… es importante entender el
// crecimiento de su cartera»*.
//
// **No se usa la fecha de alta del CRM, y por poco se usa.** Al medirlo salió
// que las 860 cuentas del sistema tienen su `created_at` dentro de las últimas
// diez semanas: esa fecha dice cuándo se cargaron los datos, no cuándo se ganó
// al cliente. Con ese campo el reporte habría dicho que cada vendedor gana
// cientos de clientes por semana.
//
// Lo que sí es cierto es la primera factura: se deduce del espejo entero, que
// arranca en marzo de 2023.
//
// **Y se cuentan, no se suman.** La primera compra de un cliente nuevo casi
// siempre es chica —$38, $20, $62 en las semanas medidas—, así que un vendedor
// que ganó cuatro clientes hizo algo muy valioso aunque la plata sea poca. En
// dinero parecería una semana flojita.
// ===========================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { jsPDF } from "jspdf";
import { entorno } from "./entorno.mjs";
import { mandarCorreo, DE_CORREO } from "./correo-enviar.mjs";
import {
  conexion,
  hoyEnPanama,
  lunesDe,
  masDias,
  primeroDelMes,
  MES_CORTO,
  MES_LARGO,
  DINERO,
  CENTAVOS,
  cumplimiento,
} from "./base-de-datos.mjs";

const SECO = process.argv.includes("--seco");
const SEMANA_PEDIDA = (process.argv.find((a) => /^--semana=/.test(a)) ?? "").split("=")[1];

/**
 * `--datos` imprime en texto todo lo que va a llevar el PDF.
 *
 * **Existe para poder contestar «¿de dónde salió este número?»** sin abrir el
 * PDF ni adivinar. Es la única forma de revisar el contenido de un reporte que
 * se dibuja en papel: mirando la página no se puede saber si un cero es un cero
 * de verdad o una consulta que salió vacía.
 */
const CON_DATOS = process.argv.includes("--datos");

const env = entorno(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const { sb, todas, correosDeAuth } = conexion(env);

const TIPOS = {
  llamar_frio: "Llamadas en frío",
  visitar: "Visitas",
  reparto: "Reparto",
  cobrar: "Cobros",
  entregar_cotizacion: "Cotizaciones entregadas",
};

/** El catálogo cerrado de por qué se pierde una cotización. Es el de `motivo_perdida`. */
const MOTIVOS_PERDIDA = {
  precio: "precio",
  espera_licitacion: "espera una licitación",
  no_cumple_especificaciones: "no cumple especificaciones",
  sin_interes_real: "no había interés real",
  no_contactar: "pidió que no lo contacten",
};

const MOTIVOS = {
  falto_tiempo: "me faltó tiempo",
  cliente_cambio_el_dia: "un cliente cambió el día",
  cliente_no_estaba: "no estaba el encargado",
  se_alargo_una_visita: "se alargó una visita",
  problema_de_vehiculo: "problema con el vehículo",
  otra_cosa: "otra cosa",
};

// ---------------------------------------------------------------------------
// Reunir
// ---------------------------------------------------------------------------

async function reunir() {
  const lunes = SEMANA_PEDIDA ? lunesDe(SEMANA_PEDIDA) : lunesDe(hoyEnPanama());
  const viernes = masDias(lunes, 4);
  const domingo = masDias(lunes, 6);

  const [perfiles, mapeos, correos] = await Promise.all([
    sb("/perfiles?select=id,nombre,rol,activo,deleted_at"),
    sb("/vendedores_zoho?select=perfil_id&deleted_at=is.null"),
    correosDeAuth(),
  ]);

  const nombre = new Map(perfiles.map((p) => [p.id, p.nombre]));
  const vendedores = [...new Set(mapeos.map((m) => m.perfil_id))]
    .filter((id) => nombre.has(id))
    .map((id) => ({ id, nombre: nombre.get(id), correo: correos.get(id) ?? null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // --- El plan diario de la semana ---------------------------------------
  const planes = await todas(
    `/planes_diarios?select=id,vendedor_id,fecha,a_tiempo,cerrado_en,` +
      `plan_acciones(tipo,lista_id,meta,logrado,motivo,motivo_otro)` +
      `&fecha=gte.${lunes}&fecha=lte.${domingo}&deleted_at=is.null`,
  );

  // --- Lo facturado, y de ahí los clientes nuevos ------------------------
  //
  // Se trae el espejo ENTERO y no sólo la semana, porque para saber si un
  // cliente es nuevo hay que saber si compró antes alguna vez. Son siete mil
  // filas: cabe de sobra en memoria y sale más barato que una consulta por
  // contacto.
  const trans = await todas(
    "/transacciones_zoho?select=fecha,perfil_id,contacto_id,cuenta_id,total" +
      "&deleted_at=is.null&order=fecha.asc",
  );

  const primeraCompraDe = new Map();
  for (const t of trans) {
    if (!primeraCompraDe.has(t.contacto_id)) primeraCompraDe.set(t.contacto_id, t.fecha);
  }

  // **El borde del espejo no se puede llamar «nuevo».** Un contacto cuya
  // primera compra conocida es el primer día importado puede ser viejísimo y su
  // historia no haber entrado. Son 181 contactos y todos de 2023.
  const bordeDelEspejo = trans.length ? trans[0].fecha : null;
  const esNuevoEnEsaFecha = (t) =>
    primeraCompraDe.get(t.contacto_id) === t.fecha && t.fecha > bordeDelEspejo;

  const clientes = await todas("/clientes_zoho?select=contacto_id,nombre&deleted_at=is.null");
  const nombreDelCliente = new Map(clientes.map((c) => [c.contacto_id, c.nombre]));

  // -------------------------------------------------------------------------
  // LA SEGUNDA PÁGINA: A QUÉ LE ESTAMOS APUNTANDO
  //
  // Lo pidió el usuario el 25 de octubre de 2026, y tenía razón de fondo:
  //
  //     «Veo los reportes, veo el resumen, pero no veo la data. No sé a qué
  //      cliente estamos apuntando… no veo qué hay pronto en cotizaciones en el
  //      canal… Eso sería parte de lo que yo tengo que comentar al final de la
  //      semana. No solamente ver unos números abstractos, sino entender qué
  //      estamos apuntando a los prospectos correctos.»
  //
  // **Es la capa del medio del marco de gestión y era la que faltaba.** De los
  // tres niveles —resultados, objetivos de mercado, actividades— el reporte
  // tenía el primero y el tercero. El del medio es el único que la gerencia
  // puede dirigir: a un vendedor no se le puede ordenar que facture más, pero sí
  // a quién le apunta.
  // -------------------------------------------------------------------------

  const [cuentas, listas, listasCuentas, cotizaciones] = await Promise.all([
    todas("/cuentas?select=id,nombre,vendedor_id,tipo_comercio&deleted_at=is.null"),
    todas("/listas?select=id,nombre,vendedor_id&deleted_at=is.null&archivada=eq.false"),
    todas("/listas_cuentas?select=lista_id,cuenta_id"),
    todas(
      "/cotizaciones?select=id,codigo,tipo,estado,total,cuenta_id,vendedor_id," +
        "emitida_en,cerrada_en,motivo_perdida,validez_dias&deleted_at=is.null",
    ),
  ]);

  const nombreDeCuenta = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const nombreDeLista = new Map(listas.map((l) => [l.id, l.nombre]));

  const listasDeCuenta = new Map();
  for (const f of listasCuentas) {
    if (!listasDeCuenta.has(f.cuenta_id)) listasDeCuenta.set(f.cuenta_id, new Set());
    listasDeCuenta.get(f.cuenta_id).add(f.lista_id);
  }

  // **Treinta días hacia atrás, no sólo la semana.** La pregunta es si el
  // vendedor tocó al cliente antes de que comprara, y una venta del lunes puede
  // venir de una visita de hace tres semanas. Con la ventana de la semana
  // cualquier venta parecería «llegó sola».
  const haceUnMes = masDias(lunes, -30);
  const seguimientos = await todas(
    `/seguimientos?select=cuenta_id,vendedor_id,fecha&deleted_at=is.null&fecha=gte.${haceUnMes}`,
  );
  const tocadas = new Set(
    seguimientos.map((s) => `${s.vendedor_id}|${s.cuenta_id}`),
  );

  // --- El mes y la comisión ----------------------------------------------
  const mesDelViernes = primeroDelMes(viernes);
  const mesDelLunes = primeroDelMes(lunes);
  const ventas = await sb("/ventas_del_mes?select=*");
  const ventasPorClave = new Map(
    ventas.filter((v) => v.perfil_id).map((v) => [`${v.perfil_id}|${v.mes}`, v]),
  );

  const anio = Number(viernes.slice(0, 4));

  const filas = [];
  for (const v of vendedores) {
    // Disciplina
    const suyos = planes.filter((p) => p.vendedor_id === v.id && p.fecha <= viernes);
    const diasConPlan = suyos.length;
    const cerrados = suyos.filter((p) => p.cerrado_en).length;
    const tarde = suyos.filter((p) => !p.a_tiempo).length;

    // Lo prometido contra lo hecho
    const porTipo = new Map();
    const motivos = new Map();
    for (const p of suyos) {
      for (const a of p.plan_acciones ?? []) {
        if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, { meta: 0, hecho: 0, sinCerrar: 0 });
        const x = porTipo.get(a.tipo);
        x.meta += Number(a.meta) || 0;
        if (a.logrado == null) x.sinCerrar += 1;
        else x.hecho += Number(a.logrado) || 0;
        if (a.motivo) motivos.set(a.motivo, (motivos.get(a.motivo) ?? 0) + 1);
      }
    }

    const motivoMasRepetido = [...motivos.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    // Lo facturado de la semana
    const deLaSemana = trans.filter(
      (t) => t.perfil_id === v.id && t.fecha >= lunes && t.fecha <= viernes,
    );
    const facturado = deLaSemana.reduce((s, t) => s + Number(t.total), 0);

    // Clientes nuevos de la semana, con sus nombres
    const nuevos = deLaSemana.filter(esNuevoEnEsaFecha).map((t) => ({
      nombre: nombreDelCliente.get(t.contacto_id) ?? "Cliente sin nombre en Books",
      monto: Number(t.total),
    }));

    // Del mes y del año
    const delAnio = trans.filter(
      (t) => t.perfil_id === v.id && t.fecha.slice(0, 4) === String(anio),
    );
    const nuevosDelMes = delAnio.filter(
      (t) => t.fecha.slice(0, 7) === viernes.slice(0, 7) && esNuevoEnEsaFecha(t),
    ).length;
    const nuevosDelAnio = delAnio.filter(esNuevoEnEsaFecha);

    // **La métrica que de verdad mide cartera:** de los que ganó este año,
    // cuántos volvieron. Un cliente que compra una vez y no regresa fue una
    // venta, no un cliente ganado.
    const comprasPorContacto = new Map();
    for (const t of trans) {
      comprasPorContacto.set(t.contacto_id, (comprasPorContacto.get(t.contacto_id) ?? 0) + 1);
    }
    const volvieron = nuevosDelAnio.filter(
      (t) => (comprasPorContacto.get(t.contacto_id) ?? 0) > 1,
    ).length;

    // ---------------------------------------------------------------------
    // A quién le vendió, con nombre
    //
    // **El nombre del CRM manda sobre el de Books.** Es el que el vendedor
    // escribió y reconoce; el de Books suele ser la razón social —«Franquicias
    // F&B Inc.»— que no le dice nada a nadie en la ruta.
    // ---------------------------------------------------------------------
    const ventas = deLaSemana
      .map((t) => ({
        cliente:
          (t.cuenta_id ? nombreDeCuenta.get(t.cuenta_id) : null) ??
          nombreDelCliente.get(t.contacto_id) ??
          "Cliente sin nombre",
        monto: Number(t.total),
        enLista: !!(t.cuenta_id && listasDeCuenta.has(t.cuenta_id)),
        tocado: !!(t.cuenta_id && tocadas.has(`${v.id}|${t.cuenta_id}`)),
      }))
      .sort((a, b) => b.monto - a.monto);

    const dentroDeLista = ventas.filter((x) => x.enLista).length;
    const sinTocar = ventas.filter((x) => !x.tocado).length;

    // ---------------------------------------------------------------------
    // El canal
    //
    // **La antigüedad es el dato, no el conteo.** Dieciséis cotizaciones vivas
    // suena a canal; dieciséis cotizaciones de hace seis semanas sin respuesta
    // es plata que se enfrió esperando una llamada. Sin los días, las dos se
    // leen igual.
    // ---------------------------------------------------------------------
    const misCotiz = cotizaciones.filter((c) => c.vendedor_id === v.id);

    const emitidasEstaSemana = misCotiz.filter(
      (c) => (c.emitida_en ?? "").slice(0, 10) >= lunes && (c.emitida_en ?? "").slice(0, 10) <= viernes,
    );
    const cerradasEstaSemana = misCotiz.filter(
      (c) => (c.cerrada_en ?? "").slice(0, 10) >= lunes && (c.cerrada_en ?? "").slice(0, 10) <= viernes,
    );

    const diasDesde = (iso) => {
      if (!iso) return null;
      const a = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
      const b = new Date(`${viernes}T12:00:00Z`);
      return Math.round((b - a) / 86400000);
    };

    const vivas = misCotiz
      .filter((c) => c.estado === "emitida" && (c.emitida_en ?? "").slice(0, 10) <= viernes)
      .map((c) => ({
        codigo: c.codigo,
        cliente: nombreDeCuenta.get(c.cuenta_id) ?? "Cuenta sin nombre",
        monto: Number(c.total),
        dias: diasDesde(c.emitida_en),
      }))
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));

    // ---------------------------------------------------------------------
    // A qué listas apuntó, según su propio plan
    //
    // **Sale del plan y no de las ventas**, y es mejor así: el plan dice a qué
    // apuntó *declarándolo hacia adelante*, y las ventas sólo permiten
    // deducirlo hacia atrás — y nada más para el 36 % de las cuentas que están
    // en alguna lista.
    // ---------------------------------------------------------------------
    const listasApuntadas = new Map();
    for (const p of suyos) {
      for (const a of p.plan_acciones ?? []) {
        if (!a.lista_id) continue;
        const nom = nombreDeLista.get(a.lista_id) ?? "Lista archivada";
        listasApuntadas.set(nom, (listasApuntadas.get(nom) ?? 0) + (Number(a.meta) || 0));
      }
    }

    const mesViernes = ventasPorClave.get(`${v.id}|${mesDelViernes}`);
    const mesLunes = ventasPorClave.get(`${v.id}|${mesDelLunes}`);

    const [comViernes] = await sb("/rpc/comision_del_mes", {
      method: "POST",
      body: JSON.stringify({ p_perfil: v.id, p_mes: mesDelViernes }),
    });

    // El mejor mes del año, para tener contra qué comparar mientras no haya meta.
    let mejor = null;
    for (const [clave, fila] of ventasPorClave) {
      const [perfil, mes] = clave.split("|");
      if (perfil !== v.id || !mes.startsWith(String(anio))) continue;
      if (!mejor || Number(fila.total) > mejor.total) {
        mejor = { mes, total: Number(fila.total) };
      }
    }

    filas.push({
      vendedor: v,
      disciplina: { diasConPlan, cerrados, tarde },
      acciones: [...porTipo.entries()].map(([tipo, x]) => ({
        tipo,
        ...x,
        porcentaje: cumplimiento(x.meta, x.hecho),
      })),
      motivoMasRepetido,
      facturado,
      documentos: deLaSemana.length,
      nuevos,
      nuevosDelMes,
      nuevosDelAnio: nuevosDelAnio.length,
      volvieron,
      mes: mesViernes
        ? { clave: mesDelViernes, total: Number(mesViernes.total), documentos: mesViernes.documentos }
        : { clave: mesDelViernes, total: 0, documentos: 0 },
      // Sólo cuando la semana cae partida entre dos meses.
      mesAnterior:
        mesDelLunes !== mesDelViernes && mesLunes
          ? { clave: mesDelLunes, total: Number(mesLunes.total) }
          : null,
      comision: comViernes ? Number(comViernes.comision) : null,
      porcentajeComision: comViernes ? Number(comViernes.porcentaje) : null,
      mejor,

      // La segunda página
      ventas,
      dentroDeLista,
      sinTocar,
      canal: {
        emitidas: emitidasEstaSemana.length,
        emitidasMonto: emitidasEstaSemana.reduce((s, c) => s + Number(c.total), 0),
        ganadas: cerradasEstaSemana.filter((c) => c.estado === "ganada"),
        perdidas: cerradasEstaSemana.filter((c) => c.estado === "perdida"),
        vivas,
        vivasMonto: vivas.reduce((s, c) => s + c.monto, 0),
        // Pasados los días de validez más treinta, el sistema deja de
        // perseguirlas. Treinta días es la frontera donde una cotización pasa de
        // «pendiente» a «se enfrió».
        frias: vivas.filter((c) => (c.dias ?? 0) > 30).length,
      },
      listasApuntadas: [...listasApuntadas.entries()].map(([nombre, meta]) => ({ nombre, meta })),
    });
  }

  return { lunes, viernes, filas };
}

// ---------------------------------------------------------------------------
// El PDF. Una página por vendedor, misma paleta que todo lo demás.
// ---------------------------------------------------------------------------

const ANCHO = 216;
const MARGEN = 16;
const DERECHA = ANCHO - MARGEN;
const TINTA = [60, 61, 58];
const SUAVE = [120, 122, 118];
const LINEA = [200, 200, 198];
const FONDO = [245, 244, 243];
const VERDE = [21, 128, 61];
const ROJO = [185, 28, 28];

function fechaLarga(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} de ${MES_LARGO[d.getUTCMonth()]}`;
}

function rotulo(doc, texto, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUAVE);
  doc.text(texto.toUpperCase(), MARGEN, y);
  return y + 6;
}

function paginaDeVendedor(doc, semana, f) {
  const { lunes, viernes } = semana;
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...TINTA);
  doc.text(
    `SEMANA DEL ${fechaLarga(lunes).toUpperCase()} AL ${fechaLarga(viernes).toUpperCase()}`,
    MARGEN,
    y,
  );

  doc.setFontSize(11);
  doc.text(f.vendedor.nombre, DERECHA, y, { align: "right" });

  y += 4;
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, DERECHA, y);
  y += 10;

  // --- Lo positivo primero ------------------------------------------------
  //
  // Pedido textual del usuario: «también hay que resaltar lo positivo». El
  // reporte abre con lo que va bien y no con lo que falta.
  doc.setFillColor(...FONDO);
  doc.rect(MARGEN - 3, y - 6, DERECHA - MARGEN + 6, 26, "F");

  y = rotulo(doc, `${MES_LARGO[Number(f.mes.clave.slice(5, 7)) - 1]}, al viernes`, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TINTA);
  doc.text(DINERO.format(f.mes.total), MARGEN, y + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUAVE);
  doc.text(`${f.mes.documentos} documentos en el mes`, MARGEN, y + 9);

  if (f.comision != null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...VERDE);
    doc.text(CENTAVOS.format(f.comision), DERECHA, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.text(
      `comisión ganada · ${f.porcentajeComision} % sin ITBMS`,
      DERECHA,
      y + 9,
      { align: "right" },
    );
  }
  y += 22;

  if (f.mesAnterior) {
    // La semana cayó partida entre dos meses. Dos renglones con su nombre, y
    // nunca sumados: dos meses a medias en una línea es el número que nadie
    // entiende tres semanas después.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TINTA);
    doc.text(
      `${MES_LARGO[Number(f.mesAnterior.clave.slice(5, 7)) - 1]} cerró con ${DINERO.format(f.mesAnterior.total)}.` +
        " La semana se cuenta entera; el mes arrancó de nuevo el día 1.",
      MARGEN,
      y,
    );
    y += 8;
  }

  // --- La semana ----------------------------------------------------------
  y = rotulo(doc, "esta semana", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  doc.text(
    `${DINERO.format(f.facturado)} facturados en ${f.documentos} ${f.documentos === 1 ? "documento" : "documentos"}.`,
    MARGEN,
    y,
  );
  y += 9;

  // --- Clientes nuevos ----------------------------------------------------
  y = rotulo(doc, "clientes nuevos", y);

  if (f.nuevos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUAVE);
    doc.text("Ninguno compró por primera vez esta semana.", MARGEN, y);
    y += 8;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
    doc.text(
      `${f.nuevos.length} ${f.nuevos.length === 1 ? "cliente nuevo" : "clientes nuevos"}`,
      MARGEN,
      y,
    );
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const n of f.nuevos) {
      doc.setTextColor(...TINTA);
      doc.text(`· ${n.nombre}`, MARGEN + 2, y);
      doc.setTextColor(...SUAVE);
      doc.text(CENTAVOS.format(n.monto), DERECHA, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUAVE);
  doc.text(
    `En el año: ${f.nuevosDelAnio} clientes nuevos, y ${f.volvieron} ya volvieron a comprar.` +
      (f.nuevosDelMes > 0 ? `  Este mes: ${f.nuevosDelMes}.` : ""),
    MARGEN,
    y,
  );
  y += 4.5;
  doc.text(
    "Un cliente que compra una vez y no regresa fue una venta; uno que vuelve es cartera.",
    MARGEN,
    y,
  );
  y += 10;

  // --- Disciplina y lo prometido -----------------------------------------
  y = rotulo(doc, "lo que prometiste y lo que hiciste", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TINTA);
  doc.text(
    `${f.disciplina.diasConPlan} de 5 días con plan · ${f.disciplina.cerrados} cerrados` +
      (f.disciplina.tarde > 0
        ? ` · ${f.disciplina.tarde} ${f.disciplina.tarde === 1 ? "arrancó" : "arrancaron"} sin plan`
        : ""),
    MARGEN,
    y,
  );
  y += 8;

  if (f.acciones.length === 0) {
    doc.setTextColor(...SUAVE);
    doc.setFontSize(9);
    doc.text(
      f.disciplina.diasConPlan === 0
        ? "No armó ningún día de esta semana, así que no hay nada prometido que medir."
        : "No se puso acciones propias: la semana fue de seguimientos.",
      MARGEN,
      y,
    );
    y += 8;
  } else {
    for (const a of f.acciones) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...TINTA);
      doc.text(TIPOS[a.tipo] ?? a.tipo, MARGEN + 2, y);
      doc.text(String(a.meta), 110, y, { align: "right" });
      doc.setTextColor(...SUAVE);
      doc.text("→", 118, y);
      doc.setTextColor(...TINTA);
      doc.text(String(a.hecho), 134, y, { align: "right" });

      if (a.porcentaje != null) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(a.porcentaje >= 100 ? VERDE : a.porcentaje >= 70 ? TINTA : ROJO));
        doc.text(`${a.porcentaje} %`, 160, y, { align: "right" });
      }

      if (a.sinCerrar > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...SUAVE);
        doc.text(
          `${a.sinCerrar} ${a.sinCerrar === 1 ? "día" : "días"} sin cerrar`,
          DERECHA,
          y,
          { align: "right" },
        );
      }
      y += 6;
    }
    y += 3;
  }

  if (f.motivoMasRepetido) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUAVE);
    doc.text(
      `Lo que más se repitió cuando no salió: ${MOTIVOS[f.motivoMasRepetido[0]]}` +
        ` (${f.motivoMasRepetido[1]} ${f.motivoMasRepetido[1] === 1 ? "vez" : "veces"}).`,
      MARGEN,
      y,
    );
    y += 9;
  }

  if (f.mejor) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUAVE);
    doc.text(
      `Tu mejor mes del año: ${MES_LARGO[Number(f.mejor.mes.slice(5, 7)) - 1]}, con ${DINERO.format(f.mejor.total)}.` +
        " Mientras no haya meta acordada, es la referencia.",
      MARGEN,
      y,
    );
    y += 10;
  }

  pie(doc, "1 de 2");
}

function pie(doc, cual) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUAVE);
  doc.text("SGV · Papelería Comercial", MARGEN, 272);
  doc.text(cual, DERECHA, 272, { align: "right" });
}

// ---------------------------------------------------------------------------
// PÁGINA 2 · A QUÉ LE APUNTAMOS
//
// **Esta es la página que se lee para comentar la semana.** El usuario lo dijo
// así: *«eso sería parte de lo que yo tengo que comentar al final de la semana.
// No solamente ver unos números abstractos, sino entender qué estamos apuntando
// a los prospectos correctos»*.
//
// Por eso el espacio de la observación se mudó acá: se escribe mirando el
// detalle, no el resumen.
//
// **Y falta el sector a propósito.** Se midió antes de escribir esto: de las 35
// ventas de la semana sólo 8 tienen giro conocido, 489 de las 860 cuentas no lo
// tienen, y el catálogo arrastra duplicados sin fusionar —«Panadería» y
// «Panaderia», «Farmacia», «Farmacias» y «FAR»—. Un reporte por sector con eso
// diría que las farmacias son tres mercados y que el 77 % de las ventas van a
// «sin dato». **Peor que no tenerlo, porque se cree.** Entra el mes que viene,
// cuando el catálogo esté limpio; es trabajo de piso, no de código.
// ---------------------------------------------------------------------------

function paginaDeApuntes(doc, semana, f) {
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...TINTA);
  doc.text("A QUÉ LE APUNTAMOS", MARGEN, y);
  doc.setFontSize(11);
  doc.text(f.vendedor.nombre, DERECHA, y, { align: "right" });

  y += 4;
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, DERECHA, y);
  y += 10;

  // --- A quién le vendió --------------------------------------------------
  y = rotulo(doc, "a quién le vendió esta semana", y);

  if (f.ventas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUAVE);
    doc.text("No facturó nada esta semana.", MARGEN, y);
    y += 9;
  } else {
    const ALA_VISTA = 10;
    const primeras = f.ventas.slice(0, ALA_VISTA);
    const resto = f.ventas.slice(ALA_VISTA);

    doc.setFontSize(9.5);
    for (const v of primeras) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TINTA);
      doc.text(v.cliente.slice(0, 52), MARGEN + 2, y);
      doc.text(CENTAVOS.format(v.monto), 165, y, { align: "right" });

      // Las marcas de la derecha son la lectura rápida: «L» si la cuenta está
      // en alguna de sus listas, y un punto si no la tocó en treinta días.
      doc.setFontSize(7.5);
      doc.setTextColor(...SUAVE);
      const marcas = [v.enLista ? "en lista" : "", v.tocado ? "" : "sin registro"]
        .filter(Boolean)
        .join(" · ");
      if (marcas) doc.text(marcas, DERECHA, y, { align: "right" });
      doc.setFontSize(9.5);
      y += 5.4;
    }

    if (resto.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SUAVE);
      doc.text(
        `y ${resto.length} ${resto.length === 1 ? "venta" : "ventas"} más`,
        MARGEN + 2,
        y,
      );
      doc.text(
        CENTAVOS.format(resto.reduce((s, v) => s + v.monto, 0)),
        165,
        y,
        { align: "right" },
      );
      y += 6;
    }

    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SUAVE);
    doc.text(
      `${f.dentroDeLista} de ${f.ventas.length} fueron a cuentas que están en alguna de sus listas.`,
      MARGEN,
      y,
    );
    y += 4.5;
    // -----------------------------------------------------------------------
    // **ESTA FRASE SE ESCRIBIÓ DOS VECES, Y LA PRIMERA ERA INJUSTA.**
    //
    // Decía «fueron a clientes que no visitó ni llamó en los últimos 30 días».
    // Al medirlo salió que es la mayoría —Javier 15 de 23, Christopher 6 de 10—
    // y entonces la frase deja de ser un dato y pasa a ser una acusación.
    //
    // Y no se puede sostener: lo que el sistema sabe es que **no hay registro**,
    // y el punto de partida de todo este rediseño es que la herramienta no se
    // está usando. Un vendedor que visitó y no lo anotó sale señalado igual que
    // uno que no visitó, y el reporte pierde credibilidad la primera vez que
    // alguien lo lea con razón para protestar.
    //
    // Mientras el registro no sea hábito, el número **mide el registro** y hay
    // que decirlo en la misma línea. Cuando el plan diario lleve dos meses
    // corriendo, este número empezará a medir la conducta — y entonces la frase
    // se podrá endurecer con base.
    // -----------------------------------------------------------------------
    doc.text(
      `${f.sinTocar} de ${f.ventas.length} fueron a clientes sin visita ni llamada registrada en 30 días.`,
      MARGEN,
      y,
    );
    y += 4.5;
    doc.text(
      "Ojo: eso mide el registro, no la ruta. Un cliente visitado y no anotado cuenta igual que uno no visitado.",
      MARGEN,
      y,
    );
    y += 10;
  }

  // --- El canal -----------------------------------------------------------
  y = rotulo(doc, "el canal: cotizaciones", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TINTA);
  doc.text(
    f.canal.emitidas === 0
      ? "Esta semana no emitió ninguna cotización."
      : `Emitió ${f.canal.emitidas} esta semana, por ${CENTAVOS.format(f.canal.emitidasMonto)}.`,
    MARGEN,
    y,
  );
  y += 6;

  if (f.canal.ganadas.length > 0 || f.canal.perdidas.length > 0) {
    doc.setTextColor(...TINTA);
    doc.text(
      `Cerró ${f.canal.ganadas.length} ganada(s) y ${f.canal.perdidas.length} perdida(s).`,
      MARGEN,
      y,
    );
    y += 5.4;
    for (const p of f.canal.perdidas) {
      doc.setFontSize(8.5);
      doc.setTextColor(...SUAVE);
      doc.text(
        `· perdida: ${p.codigo} por ${MOTIVOS_PERDIDA[p.motivo_perdida] ?? p.motivo_perdida}`,
        MARGEN + 2,
        y,
      );
      y += 4.5;
      doc.setFontSize(9.5);
    }
    y += 2;
  }

  if (f.canal.vivas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUAVE);
    doc.text("No tiene ninguna cotización viva esperando respuesta.", MARGEN, y);
    y += 9;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...(f.canal.frias > 0 ? ROJO : TINTA));
    doc.text(
      `${f.canal.vivas.length} vivas por ${CENTAVOS.format(f.canal.vivasMonto)}` +
        (f.canal.frias > 0
          ? ` · ${f.canal.frias} llevan más de un mes sin respuesta`
          : ""),
      MARGEN,
      y,
    );
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const c of f.canal.vivas.slice(0, 6)) {
      doc.setTextColor(...TINTA);
      doc.text(c.cliente.slice(0, 40), MARGEN + 2, y);
      doc.text(CENTAVOS.format(c.monto), 150, y, { align: "right" });
      doc.setTextColor(...((c.dias ?? 0) > 30 ? ROJO : SUAVE));
      doc.text(`hace ${c.dias} días`, DERECHA, y, { align: "right" });
      y += 5;
    }
    if (f.canal.vivas.length > 6) {
      doc.setTextColor(...SUAVE);
      doc.setFontSize(8.5);
      doc.text(`y ${f.canal.vivas.length - 6} más`, MARGEN + 2, y);
      y += 5;
    }
    y += 4;
  }

  // --- A qué listas apuntó ------------------------------------------------
  y = rotulo(doc, "a qué listas apuntó en su plan", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  if (f.listasApuntadas.length === 0) {
    doc.setTextColor(...SUAVE);
    doc.text(
      f.disciplina.diasConPlan === 0
        ? "No armó ningún día, así que no declaró a qué le apuntaba."
        : "Ninguna de sus acciones salió de una lista.",
      MARGEN,
      y,
    );
    y += 9;
  } else {
    for (const l of f.listasApuntadas) {
      doc.setTextColor(...TINTA);
      doc.text(`· ${l.nombre}`, MARGEN + 2, y);
      doc.setTextColor(...SUAVE);
      doc.text(`meta ${l.meta}`, DERECHA, y, { align: "right" });
      y += 5.4;
    }
    y += 4;
  }

  // --- La observación, que es para lo que se lee esta página --------------
  const yObs = Math.max(y + 4, 279 - 62);
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, yObs, DERECHA, yObs);
  let yy = rotulo(doc, "observación de gerencia", yObs + 7);

  doc.setDrawColor(230, 229, 227);
  for (let i = 0; i < 5; i++) {
    doc.line(MARGEN, yy + i * 8, DERECHA, yy + i * 8);
  }

  pie(doc, "2 de 2");
}

function armarPdf(semana, filas) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.setFont("helvetica");
  filas.forEach((f, i) => {
    if (i > 0) doc.addPage();
    paginaDeVendedor(doc, semana, f);
    doc.addPage();
    paginaDeApuntes(doc, semana, f);
  });
  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// Correr
// ---------------------------------------------------------------------------

const datos = await reunir();
const { lunes, viernes, filas } = datos;

mkdirSync("reportes", { recursive: true });

console.log(`\n  Semana del ${lunes} al ${viernes}\n`);

const yaEstaban = await sb(
  `/reportes_semanales?select=vendedor_id,enviado_en&semana=eq.${lunes}&deleted_at=is.null`,
);
const yaEnviado = new Set(
  yaEstaban.filter((r) => r.enviado_en).map((r) => r.vendedor_id),
);

const paraGerencia = [];

for (const f of filas) {
  const pdf = armarPdf(datos, [f]);
  const ruta = `reportes/semana-${lunes}-${f.vendedor.nombre.split(" ")[0].toLowerCase()}.pdf`;
  writeFileSync(ruta, pdf);

  console.log(
    `  ${f.vendedor.nombre.padEnd(22)} ${DINERO.format(f.facturado).padStart(9)}` +
      `  ${f.disciplina.diasConPlan}/5 días con plan` +
      `  ${f.nuevos.length} ${f.nuevos.length === 1 ? "nuevo" : "nuevos"}` +
      (f.vendedor.correo ? "" : "  · SIN CORREO"),
  );

  if (CON_DATOS) {
    console.log(`\n    ── lo que va en su página 2 ──`);
    console.log(`    ventas de la semana: ${f.ventas.length}`);
    for (const v of f.ventas.slice(0, 12)) {
      console.log(
        `      ${CENTAVOS.format(v.monto).padStart(11)}  ${v.cliente.slice(0, 40).padEnd(42)}` +
          `${v.enLista ? "en lista " : "         "}${v.tocado ? "" : "sin registro"}`,
      );
    }
    if (f.ventas.length > 12) console.log(`      (y ${f.ventas.length - 12} más)`);
    console.log(
      `    en alguna de sus listas: ${f.dentroDeLista}/${f.ventas.length}` +
        ` · sin registro en 30 días: ${f.sinTocar}/${f.ventas.length}`,
    );
    console.log(
      `    canal: ${f.canal.emitidas} emitidas esta semana · ${f.canal.vivas.length} vivas` +
        ` por ${CENTAVOS.format(f.canal.vivasMonto)} · ${f.canal.frias} con más de un mes`,
    );
    for (const c of f.canal.vivas.slice(0, 5)) {
      console.log(
        `      ${String(c.dias).padStart(4)} días  ${CENTAVOS.format(c.monto).padStart(10)}  ${c.cliente.slice(0, 40)}`,
      );
    }
    console.log(
      `    ganadas: ${f.canal.ganadas.length} · perdidas: ${f.canal.perdidas.length}`,
    );
    console.log(
      `    listas apuntadas en el plan: ${f.listasApuntadas.length === 0 ? "ninguna" : f.listasApuntadas.map((l) => `${l.nombre} (meta ${l.meta})`).join(", ")}`,
    );
    console.log("");
  }

  if (yaEnviado.has(f.vendedor.id)) {
    console.log(`    ya se le había enviado esta semana; no se repite.`);
    continue;
  }

  const destinos = [];
  if (f.vendedor.correo) destinos.push(f.vendedor.correo);

  let salio = false;
  if (!SECO && destinos.length > 0) {
    salio = await mandarCorreo(env, {
      para: destinos,
      asunto: `Tu semana · ${fechaLarga(lunes)} al ${fechaLarga(viernes)}`,
      cuerpo:
        `${f.vendedor.nombre},\n\n` +
        `Esta semana: ${DINERO.format(f.facturado)} en ${f.documentos} documentos.\n` +
        `${f.disciplina.diasConPlan} de 5 días con plan, ${f.disciplina.cerrados} cerrados.\n` +
        `${f.nuevos.length === 0 ? "Ningún cliente nuevo." : `${f.nuevos.length} cliente(s) nuevo(s): ${f.nuevos.map((n) => n.nombre).join(", ")}.`}\n\n` +
        `En el mes llevas ${DINERO.format(f.mes.total)}` +
        (f.comision != null ? ` y ${CENTAVOS.format(f.comision)} de comisión ganada` : "") +
        `.\n\nEl detalle va en el PDF adjunto.\n\nSGV · Papelería Comercial\n`,
      adjuntos: [{ nombre: `mi-semana-${lunes}.pdf`, contenido: pdf }],
    });
  }

  // La fila se guarda aunque el correo no haya salido: el reporte existió y la
  // observación de gerencia tiene que poder colgarse de algo.
  //
  // **Pero en seco no se escribe nada.** La primera versión guardaba igual, y la
  // primera corrida de prueba dejó tres filas en producción. `--seco` existe
  // justamente para poder mirar el reporte sin consecuencias: si deja rastro,
  // deja de servir para eso y nadie lo vuelve a usar antes de un cambio.
  if (SECO) {
    console.log("    --seco: no se guardó la fila ni se mandó correo.");
    paraGerencia.push(f);
    continue;
  }

  await sb("/reportes_semanales", {
    method: "POST",
    body: JSON.stringify({
      vendedor_id: f.vendedor.id,
      semana: lunes,
      datos: f,
      enviado_en: salio ? new Date().toISOString() : null,
      enviado_a: salio ? destinos : null,
    }),
    prefer: "return=minimal,resolution=merge-duplicates",
  }).catch((e) => console.log(`    no se pudo guardar la fila: ${e.message}`));

  paraGerencia.push(f);
}

// --- Y el consolidado para gerencia --------------------------------------
if (paraGerencia.length > 0) {
  const pdf = armarPdf(datos, filas);
  const ruta = `reportes/semana-${lunes}-equipo.pdf`;
  writeFileSync(ruta, pdf);
  console.log(`\n  ${ruta}`);

  if (!SECO) {
    const gerencia = env.CORREO_GERENCIA ? [env.CORREO_GERENCIA] : [];
    if (gerencia.length === 0) {
      const perfiles = await sb("/perfiles?select=id&rol=eq.gerente&deleted_at=is.null");
      const correos = await correosDeAuth();
      for (const p of perfiles) if (correos.get(p.id)) gerencia.push(correos.get(p.id));
    }

    await mandarCorreo(env, {
      para: gerencia,
      asunto: `La semana del equipo · ${fechaLarga(lunes)} al ${fechaLarga(viernes)}`,
      cuerpo:
        `Semana del ${fechaLarga(lunes)} al ${fechaLarga(viernes)}.\n\n` +
        filas
          .map(
            (f) =>
              `  ${f.vendedor.nombre}: ${DINERO.format(f.facturado)} · ` +
              `${f.disciplina.diasConPlan}/5 días con plan, ${f.disciplina.cerrados} cerrados · ` +
              `${f.nuevos.length} cliente(s) nuevo(s)`,
          )
          .join("\n") +
        "\n\nCada uno recibió su propia página. El consolidado va adjunto.\n" +
        "Tu observación se escribe en la aplicación y queda en el histórico.\n\n" +
        "SGV · Papelería Comercial\n",
      adjuntos: [{ nombre: `la-semana-${lunes}.pdf`, contenido: pdf }],
    });
  }
}

console.log(
  `\n  Credenciales de correo: ${DE_CORREO.map((k) => `${k}=${env[k] ? "sí" : "NO"}`).join(" · ")}\n`,
);
