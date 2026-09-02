import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { CompararRendimiento } from "@/components/comparar-rendimiento";
import { BotonVolver } from "@/components/boton-volver";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/**
 * Comparar rendimiento — §7.10.
 *
 * Demostrar, delante del cliente, que nuestro rollo cuesta menos por metro aunque la caja sea más
 * cara. **Sin pedirle que revele lo que paga hoy**: si hubiera que exigírselo, la herramienta no
 * serviría con el cliente que no lo quiere decir, que es justo el que hay que convencer.
 *
 * Sale un `.xlsx` con fórmulas vivas que él llena por su cuenta cuando el vendedor ya no está.
 */
export default async function Comparador({ params }: PageProps<"/cuentas/[id]/comparador">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id, nombre, vendedor_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!cuenta) notFound();

  // Mismo criterio que cotizar: la hoja lleva un precio escrito a mano y el nombre de la casa, y
  // sale a nombre de quien atiende la cuenta. El líder puede verla; comparar por otro embarraría de
  // quién es la venta.
  const esMia = cuenta.vendedor_id === user.id;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/${id}`} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-marca">Comparar rendimiento</h1>
          <p className="truncate text-xs text-texto-atenuado">{cuenta.nombre}</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col p-4">
        {esMia ? (
          <CompararRendimiento cuenta={{ id: cuenta.id, nombre: cuenta.nombre }} />
        ) : (
          <p className="text-sm text-texto-secundario">
            Esta cuenta no es tuya. La comparación la hace quien la atiende, para que la venta quede
            a nombre de quien la trabajó.
          </p>
        )}
      </main>
    </>
  );
}
