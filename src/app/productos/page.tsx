import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BuscadorProductos } from "@/components/buscador-productos";
import { BotonVolver } from "@/components/boton-volver";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/**
 * El catálogo, para consultar en la calle.
 *
 * Contesta las dos preguntas que hoy obligan a llamar a la oficina: **¿lo
 * tienen?** y **¿a cómo?** Con el cliente delante y sin colgar el teléfono.
 *
 * Es de solo consulta. Cotizar desde el SGV vendrá después y es otra decisión:
 * implica escribir en la contabilidad, que hasta hoy nunca se ha tocado.
 */
export default async function Productos() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { count } = await supabase
    .from("productos_zoho")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("activo", true)
    .eq("se_vende", true);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-marca">Productos</h1>
          <p className="text-xs text-texto-atenuado">
            {count ?? 0} a la venta · precios y existencia de Zoho
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col p-4">
        <BuscadorProductos />
      </main>
    </>
  );
}
