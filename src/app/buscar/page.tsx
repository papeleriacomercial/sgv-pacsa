import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BuscadorProspectos } from "@/components/buscador-prospectos";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

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
        <h1 className="text-lg font-semibold text-marca">Buscar prospectos</h1>
      </header>

      <main className="flex flex-col p-4">
        <BuscadorProspectos />
      </main>
    </>
  );
}
