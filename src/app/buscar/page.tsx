import { Suspense } from "react";
import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BuscadorProspectos } from "@/components/buscador-prospectos";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { Cargando } from "@/components/ui/estados";

export default async function Buscar() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Buscar potenciales</h1>
      </header>

      {/* `flex-1` y no una altura en `vh`: la barra de marca, la cabecera y la navegación de
          abajo ocupan lo que ocupan según el teléfono, y una cuenta a mano se equivoca en alguno.
          Así el mapa se queda con lo que sobre, sea cual sea. */}
      <main className="flex flex-1 flex-col p-4">
        <Suspense fallback={<Cargando />}>
          <BuscadorProspectos />
        </Suspense>
      </main>
    </>
  );
}
