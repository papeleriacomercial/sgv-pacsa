import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { EstadoSolicitud, ResuelveSolicitud, TipoSolicitud } from "@/lib/catalogos";
import { esDeMiBandeja } from "@/lib/catalogos";
import { ListaSolicitudes, type Solicitud } from "@/components/lista-solicitudes";
import { Insignia } from "@/components/ui/insignia";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

type Cuenta = { nombre: string };

type Fila = {
  id: string;
  cuenta_id: string;
  vendedor_id: string;
  tipo: TipoSolicitud;
  resuelve: ResuelveSolicitud;
  detalle: string;
  monto_estimado: string | number | null;
  para_cuando: string | null;
  estado: EstadoSolicitud;
  respuesta: string | null;
  horas: number;
  vencida: boolean;
  created_at: string;
  vendedor: string;
  cuenta_ruc: string | null;
  documento_codigo: string | null;
  documento_tipo: "cotizacion" | "orden_venta" | null;
  documento_total: string | number | null;
  documento_con_itbms: boolean | null;
  documento_pdf: string | null;
  cuentas: Cuenta | Cuenta[] | null;
};

function unaCuenta(cuentas: Fila["cuentas"]): Cuenta | null {
  if (!cuentas) return null;
  return Array.isArray(cuentas) ? (cuentas[0] ?? null) : cuentas;
}

/**
 * El carril de lo que entra.
 *
 * Qué se ve aquí lo decide el RLS: el vendedor ve las suyas, administración su
 * bandeja de pedidos y cotizaciones, gerencia todo incluidos los precios.
 *
 * Va aparte de la agenda justamente porque es urgente y lo demás no lo es: un
 * pedido perdido entre lo propio es un pedido que nadie factura.
 */
export default async function Solicitudes() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  const { data } = await supabase
    .from("solicitudes_resumen")
    .select(
      "id, cuenta_id, vendedor_id, tipo, resuelve, detalle, monto_estimado, para_cuando, estado, respuesta, horas, vencida, created_at, vendedor, cuenta_ruc, documento_codigo, documento_tipo, documento_total, documento_con_itbms, documento_pdf, cuentas(nombre)",
    )
    .order("estado")
    .order("created_at", { ascending: true });

  const solicitudes: Solicitud[] = ((data ?? []) as unknown as Fila[]).map(
    (s) => ({
      id: s.id,
      cuentaId: s.cuenta_id,
      cuenta: unaCuenta(s.cuentas)?.nombre ?? "Cuenta",
      // Para quien va a facturar, el RUC es lo primero que va a buscar.
      // Que viaje con el pedido le ahorra la llamada al vendedor — y es lo
      // que hace que la factura vuelva enganchada a esta cuenta.
      ruc: s.cuenta_ruc,
      esMia: s.vendedor_id === user.id,
      tipo: s.tipo,
      resuelve: s.resuelve,
      detalle: s.detalle,
      monto: s.monto_estimado === null ? null : Number(s.monto_estimado),
      paraCuando: s.para_cuando,
      estado: s.estado,
      respuesta: s.respuesta,
      horas: Number(s.horas),
      vencida: s.vencida,
      vendedor: s.vendedor,
      documento:
        s.documento_codigo === null || s.documento_tipo === null
          ? null
          : {
              codigo: s.documento_codigo,
              tipo: s.documento_tipo,
              total: Number(s.documento_total ?? 0),
              conItbms: s.documento_con_itbms ?? true,
              ruta: s.documento_pdf,
            },
    }),
  );

  const puedeResolver =
    perfil?.rol === "gerente" || perfil?.rol === "administracion";

  // CADA QUIEN VE LO SUYO PRIMERO — 3 de septiembre de 2026.
  //
  // La consulta traía todas las solicitudes para todo el mundo, y el rol sólo decidía si se podían
  // resolver. El gerente entraba a ver precios especiales y se encontraba con pedidos, cotizaciones
  // y documentos esperando a la oficina. La regla de quién atiende qué **existía desde el primer
  // día en un comentario de la migración**, y nadie la hacía cumplir.
  const mias = solicitudes.filter((s) => esDeMiBandeja(s.tipo, perfil?.rol));
  const deOtros = solicitudes.filter((s) => !esDeMiBandeja(s.tipo, perfil?.rol));

  // LO AJENO SE PLIEGA, NO SE ESCONDE, y la razón es de piso: hoy nada garantiza que administración
  // esté mirando su bandeja. Quitárselo de la vista al gerente dejaría una solicitud sin contestar
  // **sin ningún testigo**. Plegado no compite con lo suyo y sigue estando a un clic.
  const pendientesDeOtros = deOtros.filter((s) => s.estado === "pendiente");
  const vencidasDeOtros = pendientesDeOtros.filter((s) => s.vencida);

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Solicitudes</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <ListaSolicitudes solicitudes={mias} puedeResolver={puedeResolver} />

        {deOtros.length > 0 && (
          <details className="rounded-lg border border-borde bg-superficie">
            <summary className="min-h-tactil flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-texto">
              <span className="font-medium">
                {perfil?.rol === "gerente" ? "Lo que atiende Administración" : "Lo que atiende Gerencia"}
              </span>
              <Insignia tono="neutro">{String(pendientesDeOtros.length)}</Insignia>
              {/* LA VENCIDA SÍ SE ASOMA SIN ABRIR. Es la única de la bandeja ajena que amerita que
                  el otro se entere: pasó de 24 horas y alguien la está esperando. */}
              {vencidasDeOtros.length > 0 && (
                <Insignia tono="error">{`${vencidasDeOtros.length} pasadas de 24 h`}</Insignia>
              )}
            </summary>
            <div className="border-t border-borde p-4">
              <p className="mb-3 text-xs text-texto-atenuado">
                No es tu bandeja. Está aquí para que nada se quede sin testigo, y puedes contestarla
                si hace falta.
              </p>
              <ListaSolicitudes solicitudes={deOtros} puedeResolver={puedeResolver} />
            </div>
          </details>
        )}
      </main>
    </>
  );
}
