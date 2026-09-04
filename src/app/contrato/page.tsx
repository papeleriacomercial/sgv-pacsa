import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lunesDeEstaSemana } from "@/lib/semana";
import { ListaCierres, type CierreDeAlguien } from "@/components/lista-cierres";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

type Fila = {
  id: string;
  vendedor_id: string;
  semana: string;
  numeros: Record<string, number> | null;
  sorprendio: string | null;
  freno: string | null;
  necesito: string | null;
  apuesta_potenciales: number | null;
  apuesta_clientes: number | null;
  enviado_en: string | null;
  respuesta: string | null;
  respondido_en: string | null;
  plan: Record<string, { listaId: string; cantidad: number }[]> | null;
  visto_en: string | null;
  perfiles: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(x: Fila["perfiles"]) {
  if (!x) return "Vendedor";
  return Array.isArray(x) ? (x[0]?.nombre ?? "Vendedor") : x.nombre;
}

/**
 * El contrato: el viernes del líder.
 *
 * Lee los cierres de su equipo y responde. **Una respuesta por vendedor, no una
 * por día** — cinco respuestas semanales por persona sería micromanejo y no lo
 * sostiene nadie.
 *
 * Puede cuestionar, preguntar y agregar objetivos. **No puede reescribir el
 * plan**, y eso no lo impide esta pantalla sino un trigger en la base: si el
 * plan se puede editar desde arriba deja de ser su plan, y el vendedor aprende
 * a proponer lo que va a ser aprobado.
 *
 * Qué cierres llegan aquí lo decide el RLS: el líder ve los de su equipo,
 * gerencia todos.
 */
export default async function Contrato() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const lunes = lunesDeEstaSemana();

  const { data } = await supabase
    .from("cierres")
    .select(
      "id, vendedor_id, semana, numeros, sorprendio, freno, necesito, plan, apuesta_potenciales, apuesta_clientes, enviado_en, respuesta, respondido_en, visto_en, perfiles(nombre)",
    )
    .neq("vendedor_id", user.id)
    .not("enviado_en", "is", null)
    .is("deleted_at", null)
    .order("semana", { ascending: false })
    .limit(12);

  const filas = (data ?? []) as unknown as Fila[];

  // EL PLAN GUARDA IDENTIFICADORES, NO NOMBRES — y con razón: si la lista se renombra, el plan de
  // agosto tiene que seguir apuntando a la misma. Pero entonces hay que ir a buscar cómo se llaman,
  // o la pantalla muestra un renglón de identificadores que no le dice nada a nadie.
  //
  // El RLS ya deja: el líder ve las listas de su equipo, gerencia las de todos. Una lista que no
  // vuelva —borrada, o de alguien que ya no es del equipo— se dibuja igual, diciendo que no está.
  const idsDeListas = [
    ...new Set(
      filas.flatMap((c) =>
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
    ((listas ?? []) as { id: string; nombre: string }[]).map((l) => [l.id, l.nombre]),
  );

  // Los días en el orden en que se trabajan. Object.keys los devuelve en el orden en que se
  // escribieron, que es el de los toques del vendedor: si marcó el jueves antes que el lunes, el
  // plan saldría en ese orden y se leería como si fuera el orden de la semana.
  const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes"];

  const cierres: CierreDeAlguien[] = filas.map(
    (c) => ({
      id: c.id,
      vendedor: nombreDe(c.perfiles),
      semana: c.semana,
      esDeEstaSemana: c.semana === lunes,
      numeros: c.numeros ?? {},
      sorprendio: c.sorprendio,
      freno: c.freno,
      necesito: c.necesito,
      apuestaPotenciales: c.apuesta_potenciales,
      apuestaClientes: c.apuesta_clientes,
      respuesta: c.respuesta,
      respondido: c.respondido_en !== null,
      visto: c.visto_en !== null,
      plan: DIAS.map((dia) => ({
        dia,
        puestas: (c.plan?.[dia] ?? []).map((p) => ({
          lista: nombreDeLista.get(p.listaId) ?? "Una lista que ya no está",
          cantidad: p.cantidad,
        })),
      })),
    }),
  );

  const sinResponder = cierres.filter((c) => !c.respondido).length;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Contrato</h1>
        {sinResponder > 0 && (
          <span className="font-mono text-xs text-aviso">
            {sinResponder} sin responder
          </span>
        )}
      </header>

      <main className="flex flex-col gap-4 p-4">
        {cierres.length === 0 ? (
          <Tarjeta>
            <Vacio titulo="Todavía no hay cierres">
              Cuando los vendedores cierren su semana, aparecen aquí con sus
              números y su plan. Una respuesta por persona, no una por día.
            </Vacio>
          </Tarjeta>
        ) : (
          <ListaCierres cierres={cierres} />
        )}
      </main>
    </>
  );
}
