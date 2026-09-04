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
export default async function Cierre({ searchParams }: PageProps<"/cierre">) {
  const params = await searchParams;
  const pedida = Array.isArray(params.semana) ? params.semana[0] : params.semana;

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const semanaActual = lunesDeEstaSemana();

  // **EL SEGUNDO CERROJO, QUITADO.** Esta pantalla abría siempre la semana en curso, así que el
  // domingo a medianoche el cierre de la semana anterior quedaba fuera de alcance — estuviera
  // revisado o no. **Eso trababa el plan por una razón que nadie decidió**, y contradecía la regla
  // que sí se acordó el 4 de septiembre de 2026: el plan se traba **cuando alguien lo lee**.
  //
  // Lo destapó el caso real: viernes a las cinco y media, dos cierres mandados con el plan sin
  // repartir, y los vendedores de vuelta el lunes — cuando esta pantalla ya no los alcanzaba.
  //
  // Ahora se puede pedir una semana anterior por la dirección, y **se acepta sólo si ese cierre es
  // suyo y nadie lo ha marcado como visto**. Cualquier otra cosa cae en la semana en curso: la
  // dirección la escribe cualquiera y no puede abrir lo que la regla ya cerró.
  const { data: abierto } = pedida
    ? await supabase
        .from("cierres")
        .select("semana")
        .eq("vendedor_id", user.id)
        .eq("semana", pedida)
        .is("visto_en", null)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  const semanaActiva = abierto?.semana ?? semanaActual;
  const esDeAntes = semanaActiva !== semanaActual;

  const [semana, listas, { data: previo }] = await Promise.all([
    cargarSemana(user.id),
    // **Las suyas, no las que puede ver.** El plan de la semana es donde el
    // vendedor reparte sus rutas por día; al líder le aparecían las de
    // Aguadulce y Chitré, que son de Albert. El RLS deja verlas porque es su
    // equipo — pero planificar con la ruta de otro no significa nada.
    cargarListas(user.id),
    supabase
      .from("cierres")
      .select("id, numeros, sorprendio, freno, necesito, plan, apuesta_potenciales, apuesta_clientes, enviado_en, visto_en, respuesta")
      .eq("vendedor_id", user.id)
      .eq("semana", semanaActiva)
      .maybeSingle(),
  ]);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/?vista=semana" />
        <div>
          <h1 className="text-lg font-semibold text-marca">
            {esDeAntes ? "Corregir la semana pasada" : "Cerrar la semana"}
          </h1>
          {/* Sin esto, corregir la semana pasada se ve idéntico a cerrar la de hoy, y el vendedor
              termina planificando la semana equivocada sin enterarse. */}
          {esDeAntes && (
            <p className="font-mono text-xs text-texto-atenuado">
              Semana del {semanaActiva} · plan para el{" "}
              {proximoLunes(semanaActiva)}
            </p>
          )}
        </div>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {/* **LOS NÚMEROS DE UNA SEMANA VIEJA SON LOS CONGELADOS, NO LOS DE HOY.** `cargarSemana`
            siempre calcula la semana en curso; usarla para corregir la anterior le mostraría al
            vendedor las cifras equivocadas y, al reenviar, **le reescribiría el histórico** — que
            es justo lo que el congelado existe para impedir. */}
        <FormularioCierre
          vendedorId={user.id}
          semana={semanaActiva}
          semanaEntrante={proximoLunes(semanaActiva)}
          numeros={
            esDeAntes && previo?.numeros
              ? (previo.numeros as typeof semana)
              : semana
          }
          listas={listas}
          previo={previo ?? null}
        />
      </main>
    </>
  );
}
