import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarCartera } from "@/lib/cartera";
import { CuentasConFiltros } from "@/components/cuentas-con-filtros";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

export default async function Mapa() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { cuentas, vendedores } = await cargarCartera();

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Mapa</h1>
      </header>

      <main className="flex flex-1 flex-col p-4">
        <CuentasConFiltros
          cuentas={cuentas}
          vendedores={vendedores}
          vistaInicial="mapa"
        />
      </main>
    </>
  );
}
