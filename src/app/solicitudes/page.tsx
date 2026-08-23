import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { EstadoSolicitud, ResuelveSolicitud, TipoSolicitud } from "@/lib/catalogos";
import { ListaSolicitudes, type Solicitud } from "@/components/lista-solicitudes";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

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
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(cuentas: Fila["cuentas"]) {
  if (!cuentas) return "Cuenta";
  return Array.isArray(cuentas) ? (cuentas[0]?.nombre ?? "Cuenta") : cuentas.nombre;
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
      "id, cuenta_id, vendedor_id, tipo, resuelve, detalle, monto_estimado, para_cuando, estado, respuesta, horas, vencida, created_at, cuentas(nombre)",
    )
    .order("estado")
    .order("created_at", { ascending: true });

  const solicitudes: Solicitud[] = ((data ?? []) as unknown as Fila[]).map(
    (s) => ({
      id: s.id,
      cuentaId: s.cuenta_id,
      cuenta: nombreDe(s.cuentas),
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
    }),
  );

  const puedeResolver =
    perfil?.rol === "gerente" || perfil?.rol === "administracion";

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Solicitudes</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <ListaSolicitudes
          solicitudes={solicitudes}
          puedeResolver={puedeResolver}
        />
      </main>
    </>
  );
}
