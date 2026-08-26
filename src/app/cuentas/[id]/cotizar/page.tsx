import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { ArmarCotizacion, type Cuenta } from "@/components/armar-cotizacion";
import { BotonVolver } from "@/components/boton-volver";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import type { Empresa } from "@/lib/cotizacion-pdf";

/**
 * Armar una cotización para este cliente.
 *
 * El vendedor escoge productos del catálogo, pone cantidades y precios, y sale
 * un PDF con el formato de la casa que puede mandar por donde quiera. Queda
 * guardado en el expediente como constancia.
 *
 * **Hasta cierto monto.** Por encima del tope la cotización se le pide a la
 * oficina, que es donde alguien mira el precio antes de que el cliente lo vea.
 * No es una regla nueva: es la que ya existe con la libreta.
 */
export default async function Cotizar({ params }: PageProps<"/cuentas/[id]/cotizar">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: cuenta }, { data: perfil }, { data: empresa }, { data: umbrales }] =
    await Promise.all([
      supabase
        .from("cuentas")
        .select("id, nombre, ruc, direccion, poblado, pide_sin_itbms, vendedor_id")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.from("perfiles").select("id, nombre").eq("id", user.id).maybeSingle(),
      supabase
        .from("empresa")
        .select(
          "nombre, ruc, direccion, telefono, correo, web, terminos, nota_pie, validez_dias",
        )
        .maybeSingle(),
      supabase.from("parametros").select("clave, valor"),
    ]);

  if (!cuenta) notFound();

  // Cotizar es escribir en nombre de alguien: solo el dueño de la cuenta.
  // El líder puede verla, pero cotizar por otro embarraría de quién es la
  // venta y a quién se le mide.
  if (cuenta.vendedor_id !== user.id) {
    return (
      <>
        <AvisoSinConexion />
        <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
          <BotonVolver alterno={`/cuentas/${id}`} />
          <h1 className="text-lg font-semibold text-marca">Cotizar</h1>
        </header>
        <main className="p-4">
          <p className="text-sm text-texto-secundario">
            Esta cuenta no es tuya. La cotización la hace quien la atiende, para
            que la venta quede a nombre de quien la trabajó.
          </p>
        </main>
      </>
    );
  }

  const valor = (clave: string, siNo: number) =>
    Number(
      (umbrales ?? []).find((u) => u.clave === clave)?.valor ?? siNo,
    );

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/${id}`} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-marca">Cotizar</h1>
          <p className="truncate text-xs text-texto-atenuado">{cuenta.nombre}</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col p-4">
        <ArmarCotizacion
          cuenta={cuenta as Cuenta}
          empresa={(empresa ?? { nombre: "Papelería Comercial, S.A." }) as Empresa}
          vendedor={{ id: user.id, nombre: perfil?.nombre ?? "Vendedor" }}
          tope={valor("cotizacion_tope", 500)}
          itbmsPorcentaje={valor("itbms_porcentaje", 7)}
        />
      </main>
    </>
  );
}
