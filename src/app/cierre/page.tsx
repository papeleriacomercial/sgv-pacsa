import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarSemana, lunesDeEstaSemana } from "@/lib/semana";
import { cargarListas } from "@/lib/listas";
import { FormularioCierre } from "@/components/formulario-cierre";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

/** El lunes de la semana entrante, que es la que se planifica. */
function proximoLunes(lunes: string): string {
  const d = new Date(`${lunes}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-CA");
}

/**
 * El cierre de la semana.
 *
 * Cuatro pasos, quince minutos: confirma sus números —que ya están calculados—,
 * cuenta qué pasó, reparte las rutas de la semana entrante y envía.
 *
 * **Es un formulario, no una pantalla.** Se usa una vez a la semana; darle un
 * lugar permanente en la barra sería estorbar el otro noventa por ciento de los
 * días.
 */
export default async function Cierre() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const semanaActual = lunesDeEstaSemana();

  const [semana, listas, { data: previo }] = await Promise.all([
    cargarSemana(user.id),
    // **Las suyas, no las que puede ver.** El plan de la semana es donde el
    // vendedor reparte sus rutas por día; al líder le aparecían las de
    // Aguadulce y Chitré, que son de Albert. El RLS deja verlas porque es su
    // equipo — pero planificar con la ruta de otro no significa nada.
    cargarListas(user.id),
    supabase
      .from("cierres")
      .select("id, sorprendio, freno, necesito, plan, apuesta_potenciales, apuesta_clientes, enviado_en")
      .eq("vendedor_id", user.id)
      .eq("semana", semanaActual)
      .maybeSingle(),
  ]);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/?vista=semana" />
        <h1 className="text-lg font-semibold text-marca">Cerrar la semana</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <FormularioCierre
          vendedorId={user.id}
          semana={semanaActual}
          semanaEntrante={proximoLunes(semanaActual)}
          numeros={semana}
          listas={listas}
          previo={previo ?? null}
        />
      </main>
    </>
  );
}
