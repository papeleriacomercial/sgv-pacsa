import { clienteServidor } from "@/lib/supabase/servidor";
import {
  PESO_JORNADA,
  RESULTADO_VENTA,
  type DuracionJornada,
  type TipoInteraccion,
} from "@/lib/catalogos";

/**
 * Cómo va la semana del vendedor.
 *
 * Es la devolución que hace que valga la pena registrar: **lo ve él antes que
 * nadie**. Un vendedor que el jueves ve que le faltan seis clientes por
 * visitar, los visita el viernes — y eso ocurre sin que el líder intervenga.
 *
 * Todo se calcula aquí. El vendedor no escribe ni un número: si tuviera que
 * contar sus visitas o sumar sus leads, el cierre del viernes se volvería una
 * hora de trabajo administrativo y en tres semanas estaría inventando cifras
 * redondas.
 *
 * Los cuatro bloques son los mismos de docs/09-medicion-y-gestion.md, y de los
 * mismos hechos salen números distintos que no se confunden: **interacciones**
 * mide esfuerzo, **cuentas tocadas** mide cobertura.
 */

export type Semana = {
  desde: string;
  /** Esfuerzo: cuánto se movió. */
  interacciones: number;
  visitas: number;
  verificadas: number;
  fueraDelLocal: number;
  llamadas: number;
  cuentasTocadas: number;
  jornadasGastadas: number;
  diasVendibles: number;
  /** Caza: qué está construyendo. */
  cuentasNuevas: number;
  aProspecto: number;
  aCliente: number;
  descartadas: number;
  /** Cuidado: qué está protegiendo. */
  clientes: number;
  enCadencia: number;
  fueraDeCadencia: { id: string; nombre: string; dias: number | null }[];
  compromisosCumplidos: number;
  compromisosVencidos: number;
  /** Ventas: lo que entró, sin esperar la factura. */
  pedidos: number;
  montoPedidos: number;
};

/** El lunes de esta semana, en hora de Panamá y calculado en el servidor. */
export function lunesDeEstaSemana(): string {
  const hoy = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Panama" }),
  );
  const desplazamiento = (hoy.getDay() + 6) % 7;
  hoy.setDate(hoy.getDate() - desplazamiento);
  return hoy.toLocaleDateString("en-CA");
}

export function hoyEnPanama(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

export async function cargarSemana(vendedorId: string): Promise<Semana> {
  const supabase = await clienteServidor();
  const desde = lunesDeEstaSemana();
  const desdeISO = `${desde}T00:00:00`;

  const [
    { data: seguimientos },
    { data: jornadas },
    { data: cuentas },
    { data: compromisos },
    { data: solicitudes },
  ] = await Promise.all([
    supabase
      .from("seguimientos_resumen")
      .select("cuenta_id, tipo, resultado, verificada, fuera_del_local, fecha")
      .eq("vendedor_id", vendedorId)
      .gte("fecha", desdeISO),
    supabase
      .from("jornadas")
      .select("duracion")
      .eq("vendedor_id", vendedorId)
      .gte("fecha", desde)
      .is("deleted_at", null),
    supabase
      .from("cuentas_resumen")
      .select("id, nombre, tipo, created_at, fuera_de_cadencia, dias_sin_contacto")
      .eq("vendedor_id", vendedorId),
    supabase
      .from("compromisos")
      .select("cumplido_en, fecha_compromiso")
      .eq("vendedor_id", vendedorId)
      .is("deleted_at", null),
    supabase
      .from("solicitudes")
      .select("tipo, monto_estimado, created_at")
      .eq("vendedor_id", vendedorId)
      .eq("tipo", "pedido")
      .is("deleted_at", null)
      .gte("created_at", desdeISO),
  ]);

  const segs = (seguimientos ?? []) as {
    cuenta_id: string;
    tipo: TipoInteraccion;
    resultado: string;
    verificada: boolean;
    fuera_del_local: boolean;
  }[];

  const gastadas = ((jornadas ?? []) as { duracion: DuracionJornada }[]).reduce(
    (suma, j) => suma + PESO_JORNADA[j.duracion],
    0,
  );

  const todas = (cuentas ?? []) as {
    id: string;
    nombre: string;
    tipo: string;
    created_at: string;
    fuera_de_cadencia: boolean | null;
    dias_sin_contacto: number | null;
  }[];

  const clientes = todas.filter((c) => c.tipo === "cliente");
  const fuera = clientes.filter((c) => c.fuera_de_cadencia === true);

  const comps = (compromisos ?? []) as {
    cumplido_en: string | null;
    fecha_compromiso: string;
  }[];

  const hoy = hoyEnPanama();
  const pedidos = (solicitudes ?? []) as {
    monto_estimado: string | number | null;
  }[];

  return {
    desde,
    interacciones: segs.length,
    visitas: segs.filter((s) => s.tipo === "visita").length,
    verificadas: segs.filter((s) => s.verificada).length,
    fueraDelLocal: segs.filter((s) => s.fuera_del_local).length,
    llamadas: segs.filter((s) => s.tipo !== "visita").length,
    // Cuentas distintas, no interacciones: tres llamadas al mismo cliente son
    // tres interacciones y un solo cliente atendido.
    cuentasTocadas: new Set(segs.map((s) => s.cuenta_id)).size,
    jornadasGastadas: gastadas,
    diasVendibles: Math.max(0, 5 - gastadas),

    cuentasNuevas: todas.filter((c) => c.created_at >= desdeISO).length,
    aProspecto: segs.filter((s) => s.resultado !== RESULTADO_VENTA).length,
    aCliente: segs.filter((s) => s.resultado === RESULTADO_VENTA).length,
    descartadas: todas.filter((c) => c.tipo === "descartada").length,

    clientes: clientes.length,
    enCadencia: clientes.length - fuera.length,
    fueraDeCadencia: fuera
      .sort((a, b) => (b.dias_sin_contacto ?? 0) - (a.dias_sin_contacto ?? 0))
      .slice(0, 8)
      .map((c) => ({ id: c.id, nombre: c.nombre, dias: c.dias_sin_contacto })),
    compromisosCumplidos: comps.filter(
      (c) => c.cumplido_en !== null && c.cumplido_en >= desdeISO,
    ).length,
    compromisosVencidos: comps.filter(
      (c) => c.cumplido_en === null && c.fecha_compromiso < hoy,
    ).length,

    pedidos: pedidos.length,
    montoPedidos: pedidos.reduce(
      (suma, p) => suma + Number(p.monto_estimado ?? 0),
      0,
    ),
  };
}
