import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { TipoSolicitud } from "@/lib/catalogos";
import { CORREO_DESTINO } from "@/lib/correo";
import { RegistroSolicitudes, type Pedida } from "@/components/registro-solicitudes";
import { Tarjeta } from "@/components/ui/tarjeta";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

type Cuenta = { nombre: string };

type Fila = {
  id: string;
  cuenta_id: string;
  tipo: TipoSolicitud;
  detalle: string;
  monto_estimado: string | number | null;
  created_at: string;
  documento_codigo: string | null;
  documento_pdf: string | null;
  cuentas: Cuenta | Cuenta[] | null;
};

function unaCuenta(cuentas: Fila["cuentas"]): Cuenta | null {
  if (!cuentas) return null;
  return Array.isArray(cuentas) ? (cuentas[0] ?? null) : cuentas;
}

/**
 * Lo que le pediste a la oficina.
 *
 * **Dejó de ser una bandeja el 13 de septiembre de 2026** (D-071). Antes administración y gerencia
 * entraban aquí a leer y contestar los encargos; ahora los reciben por correo, en las direcciones
 * que ya usaban antes de que existiera el SGV, y esta pantalla se quedó sólo del lado del
 * vendedor — como **registro de lo que ha mandado**.
 *
 * Por eso no muestra estados: nadie los va a cambiar. Lo que contesta es «¿qué le mandé a la
 * oficina?», y desde cada renglón se llega a la cuenta o se reabre el documento.
 */
export default async function Solicitudes() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // **Las suyas y nada más.** Antes la consulta traía lo que el RLS permitiera y el rol decidía
  // qué se podía resolver; hoy no hay nada que resolver, así que traer las ajenas sería enseñarle
  // a alguien el trabajo de otro sin que pueda hacer nada con él.
  const { data } = await supabase
    .from("solicitudes_resumen")
    .select(
      "id, cuenta_id, tipo, detalle, monto_estimado, created_at, documento_codigo, documento_pdf, cuentas(nombre)",
    )
    .eq("vendedor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const pedidas: Pedida[] = ((data ?? []) as unknown as Fila[]).map((s) => ({
    id: s.id,
    cuentaId: s.cuenta_id,
    cuenta: unaCuenta(s.cuentas)?.nombre ?? "Cuenta",
    tipo: s.tipo,
    detalle: s.detalle,
    monto: s.monto_estimado === null ? null : Number(s.monto_estimado),
    cuando: s.created_at,
    documento:
      s.documento_codigo === null
        ? null
        : { codigo: s.documento_codigo, ruta: s.documento_pdf },
  }));

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Lo que has pedido</h1>
        <p className="text-xs text-texto-atenuado">
          Se manda por correo. Revisa en tu Gmail que haya salido.
        </p>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {/* **DÓNDE ESTÁ LA RESPUESTA, DICHO ANTES DE LA LISTA.** Sin esto, un vendedor que no
            encuentra el estado de su pedido lo busca en esta pantalla hasta rendirse. La
            respuesta llega a su correo, porque el correo salió de su cuenta. */}
        <Tarjeta className="flex flex-col gap-1">
          <p className="text-sm text-texto-secundario">
            La oficina te responde <strong className="font-medium text-texto">por correo</strong>,
            a la misma dirección desde la que mandaste. Aquí queda anotado lo que pediste, para
            que no tengas que buscarlo.
          </p>
          <p className="text-xs text-texto-atenuado">
            Cotizaciones y muestras a {CORREO_DESTINO.cotizacion} · órdenes a{" "}
            {CORREO_DESTINO.pedido} · precios a {CORREO_DESTINO.precio}
          </p>
        </Tarjeta>

        <RegistroSolicitudes pedidas={pedidas} />
      </main>
    </>
  );
}
