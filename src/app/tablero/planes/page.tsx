import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  day: "numeric",
  month: "long",
  timeZone: "America/Panama",
});

/** Los días en el orden en que se trabajan, no en el que el vendedor los tocó. */
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes"];

type Fila = {
  vendedor_id: string;
  semana: string;
  plan: Record<string, { listaId: string; cantidad: number }[]> | null;
  enviado_en: string | null;
  perfiles:
    | { nombre: string; rol: string }
    | { nombre: string; rol: string }[]
    | null;
};

/** El embebido llega como objeto o como arreglo de uno según la versión; se resuelve una vez. */
function quien(x: Fila["perfiles"]) {
  const p = Array.isArray(x) ? x[0] : x;
  return { nombre: p?.nombre ?? "Vendedor", rol: p?.rol ?? "vendedor" };
}

/** El plan de un cierre es el de la semana SIGUIENTE a la que se cerró. */
function semanaSiguiente(semana: string) {
  const d = new Date(`${semana}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Cómo están repartiendo la semana — §7.1.
 *
 * Lo pidió el usuario el 13 de septiembre de 2026, con el mismo motivo que la pantalla de
 * actividad: *«necesito ver este monitoreo para ver el desarrollo y el éxito de la
 * aplicación»*. **No mide resultado: mide si están planificando.** Un vendedor puede vender
 * bien y salir vacío acá, y lo que eso dice es que no está usando el plan — que en el arranque
 * es justo lo que hay que saber.
 *
 * **Vive fuera del tablero del lunes, igual que actividad y que el negocio.** El plan de tres
 * personas repartido en cinco días son quince renglones; puestos en el tablero lo convierten en
 * la pantalla que se abre con desgano.
 *
 * **Aquí se lee y nada más. No se responde**, aunque haya sitio: responder es el gesto del
 * contrato, y tener dos lugares donde contestar lo mismo termina en dos respuestas distintas al
 * mismo vendedor. El botón del final lleva allá.
 *
 * Un cierre trae el plan de la **semana entrante**, así que lo que se ve aquí es lo último que
 * cada uno propuso, con la semana que le toca dicha en letras — sin eso, un plan de hace dos
 * semanas se lee como el de ahora.
 */
export default async function PlanesDelEquipo() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: yo } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  // Misma puerta que su tablero: si aquélla no existe para ti, ésta tampoco.
  if (yo?.rol !== "gerente") notFound();

  // **`perfiles` VA CALIFICADO CON SU CLAVE.** `cierres` apunta a `perfiles` por tres caminos
  // —quién lo escribió, quién lo respondió y quién lo marcó visto—, así que un `perfiles(nombre)`
  // a secas es ambiguo y PostgREST rechaza la consulta entera con un 300. Ya costó una pantalla
  // vacía durante doce días (ver el comentario de `/contrato`).
  const { data, error } = await supabase
    .from("cierres")
    .select(
      "vendedor_id, semana, plan, enviado_en, perfiles!cierres_vendedor_id_fkey(nombre, rol)",
    )
    .not("enviado_en", "is", null)
    .is("deleted_at", null)
    .order("semana", { ascending: false })
    .limit(30);

  const filas = (data ?? []) as unknown as Fila[];

  // El último de cada quien. Vienen ordenados de la semana más nueva a la más vieja, así que el
  // primero que aparece de cada vendedor es el que manda.
  const ultimoDeCadaUno = new Map<string, Fila>();
  for (const f of filas) {
    if (!ultimoDeCadaUno.has(f.vendedor_id)) ultimoDeCadaUno.set(f.vendedor_id, f);
  }

  // Quién está activo, para poder decir «no ha planificado» de alguien que no aparece en ningún
  // cierre. Sin esto, el que no planifica es invisible — que es el caso que más importa.
  const { data: gente } = await supabase
    .from("perfiles")
    .select("id, nombre, rol")
    .eq("activo", true)
    .is("deleted_at", null)
    .in("rol", ["vendedor", "lider"]);

  const equipo = (gente ?? []) as { id: string; nombre: string; rol: string }[];

  // EL PLAN GUARDA IDENTIFICADORES, NO NOMBRES: si una lista se renombra, el plan de agosto tiene
  // que seguir apuntando a la misma. Hay que ir a buscar cómo se llaman o la pantalla muestra
  // renglones de identificadores.
  const idsDeListas = [
    ...new Set(
      [...ultimoDeCadaUno.values()].flatMap((c) =>
        Object.values(c.plan ?? {}).flatMap((puestas) =>
          puestas.map((p) => p.listaId),
        ),
      ),
    ),
  ];

  const { data: listas } = idsDeListas.length
    ? await supabase.from("listas").select("id, nombre").in("id", idsDeListas)
    : { data: [] };

  const nombreDeLista = new Map(
    ((listas ?? []) as { id: string; nombre: string }[]).map((l) => [
      l.id,
      l.nombre,
    ]),
  );

  // El líder primero: es a quien gerencia lee entero.
  const orden = [...equipo].sort((a, b) =>
    a.rol === b.rol ? a.nombre.localeCompare(b.nombre, "es") : a.rol === "lider" ? -1 : 1,
  );

  const sinPlanificar = orden.filter((p) => {
    const c = ultimoDeCadaUno.get(p.id);
    if (!c) return true;
    return DIAS.every((d) => (c.plan?.[d] ?? []).length === 0);
  }).length;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-2 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/tablero" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-marca">
            Cómo reparten la semana
          </h1>
          <p className="truncate text-xs text-texto-atenuado">
            El último plan de cada quien, día por día
          </p>
        </div>
        {sinPlanificar > 0 && (
          <span className="shrink-0 font-mono text-xs text-aviso">
            {sinPlanificar} sin plan
          </span>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {error && (
          <MensajeError
            titulo="No se pudieron leer los planes"
            detalle={error.message}
          />
        )}

        {/* **Qué mide, dicho antes de los números** — igual que en actividad. Un plan vacío no
            dice «trabajó mal»: dice «no repartió la semana», y confundir las dos cosas vuelve
            injusta la conversación que sigue. */}
        <Tarjeta className="flex flex-col gap-1">
          <p className="text-sm text-texto-secundario">
            Mide <strong className="font-medium text-texto">si están planificando</strong>,
            no cuánto venden. Cada renglón dice cuántos puntos se compromete a
            trabajar ese día, y de cuál lista.
          </p>
        </Tarjeta>

        {orden.length === 0 && !error && (
          <Vacio titulo="No hay vendedores activos">
            Se listan los perfiles de vendedor y de líder que estén activos.
          </Vacio>
        )}

        {orden.map((p) => {
          const c = ultimoDeCadaUno.get(p.id);
          const plan = DIAS.map((dia) => ({
            dia,
            puestas: (c?.plan?.[dia] ?? []).map((x) => ({
              lista: nombreDeLista.get(x.listaId) ?? "Una lista que ya no está",
              cantidad: x.cantidad,
            })),
          }));
          const vacio = plan.every((d) => d.puestas.length === 0);
          const puntos = plan.reduce(
            (n, d) => n + d.puestas.reduce((m, x) => m + x.cantidad, 0),
            0,
          );

          return (
            <Tarjeta key={p.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                  {p.nombre}
                </p>
                {p.rol === "lider" && <Insignia tono="neutro">Líder</Insignia>}
                {vacio && <Insignia tono="aviso">Sin plan</Insignia>}
              </div>

              {!c ? (
                <p className="text-sm text-texto-secundario">
                  Nunca ha entregado un cierre, así que no hay plan que leer.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-texto-secundario">
                      Semana del {FECHA.format(semanaSiguiente(c.semana))}
                    </p>
                    {!vacio && (
                      <p className="font-mono text-xs text-texto-secundario">
                        {puntos} puntos
                      </p>
                    )}
                  </div>

                  {vacio ? (
                    <p className="text-sm text-texto-secundario">
                      Entregó el cierre pero no repartió la semana por día.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {plan.map((d) => (
                        <div
                          key={d.dia}
                          className="flex items-baseline gap-2 text-sm"
                        >
                          <span className="w-20 shrink-0 capitalize text-texto-secundario">
                            {d.dia}
                          </span>
                          {d.puestas.length === 0 ? (
                            <span className="text-texto-atenuado">—</span>
                          ) : (
                            <span className="min-w-0 flex-1">
                              {d.puestas.map((x, i) => (
                                <span key={`${x.lista}-${i}`}>
                                  {i > 0 && ", "}
                                  {/* EL CERO EN ÁMBAR. Marcar la lista y dejar la cantidad en
                                      blanco es el error real, y sin señalarlo se lee como un
                                      plan hecho. */}
                                  <span
                                    className={
                                      x.cantidad > 0
                                        ? "font-mono text-texto"
                                        : "font-mono text-aviso"
                                    }
                                  >
                                    {x.cantidad}
                                  </span>{" "}
                                  <span className="text-texto-secundario">
                                    de {x.lista}
                                  </span>
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Tarjeta>
          );
        })}

        {/* Responder es el gesto del contrato, no de acá. */}
        <Link
          href="/contrato"
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde px-4 text-base font-medium text-texto"
        >
          Responderles en el contrato
        </Link>
      </main>
    </>
  );
}
