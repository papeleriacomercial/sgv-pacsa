import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import {
  ElegirParaCruzar,
  type Candidato,
} from "@/components/elegir-para-cruzar";
import { normalizar } from "@/lib/texto";

/** El mismo umbral del expediente: la mitad o más de sus iguales la compran. */
const FUERTE = 0.5;

type Cuenta = {
  id: string;
  nombre: string;
  tipo_comercio: string | null;
  poblado: string | null;
  total_12m: string | number | null;
};

type Proporcion = {
  tipo: string;
  linea: string;
  pares_compran: number;
  pares_totales: number;
  gasto_tipico: string | number | null;
  suficiente: boolean;
};

/**
 * Agregar a la lista los clientes de la zona a los que les falta una línea.
 *
 * **La venta cruzada no es un informe, es una ruta.** Saber que a Mini Super
 * Amy le faltan rollos no sirve de nada si el martes el vendedor va a Aguadulce
 * con una lista donde no está. Aquí se escogen y entran a la misma lista de
 * siempre, junto a los potenciales.
 *
 * Van a la misma lista y no a una aparte porque **el vendedor camina una sola
 * ruta**. Que uno sea cliente y otro potencial ya lo dice la insignia de su
 * ficha, y los contadores de la lista los cuentan por separado para que el
 * compromiso de la semana no mezcle cazar con cuidar.
 */
export default async function ClientesPorCruzar({
  params,
}: PageProps<"/listas/[id]/cruzada">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: lista } = await supabase
    .from("listas")
    .select("id, nombre, poblado, vendedor_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lista) notFound();

  // Los que ya están en la lista no se vuelven a ofrecer.
  const { data: dentro } = await supabase
    .from("listas_cuentas")
    .select("cuenta_id")
    .eq("lista_id", id);

  const yaEsta = new Set((dentro ?? []).map((x) => x.cuenta_id));

  // **La cartera del dueño de la lista, no la de quien mira.** Un líder puede
  // abrir la lista de Albert; lo que se ofrece agregar sigue siendo de Albert.
  let consulta = supabase
    .from("cuentas_resumen")
    .select("id, nombre, tipo_comercio, poblado, total_12m")
    .eq("vendedor_id", lista.vendedor_id)
    .eq("tipo", "cliente")
    .not("tipo_comercio", "is", null)
    .is("deleted_at", null);

  // Una lista de zona ofrece la zona. Una de objetivo no tiene poblado, así
  // que ofrece toda la cartera y el vendedor escoge.
  if (lista.poblado) consulta = consulta.eq("poblado", lista.poblado);

  const { data: crudas } = await consulta;
  const cuentas = (crudas ?? []) as Cuenta[];

  const [{ data: compras }, { data: props }] = await Promise.all([
    supabase
      .from("compra_por_linea")
      .select("cuenta_id, linea")
      .in(
        "cuenta_id",
        cuentas.length > 0
          ? cuentas.map((c) => c.id)
          : ["00000000-0000-0000-0000-000000000000"],
      ),
    supabase.rpc("proporcion_por_tipo"),
  ]);

  const yaCompra = new Set(
    ((compras ?? []) as { cuenta_id: string; linea: string }[]).map(
      (x) => `${x.cuenta_id}|${x.linea}`,
    ),
  );

  const porTipo = new Map<string, Proporcion[]>();
  for (const p of (props ?? []) as Proporcion[]) {
    porTipo.set(p.tipo, [...(porTipo.get(p.tipo) ?? []), p]);
  }

  const LINEAS = [
    "rollos_fiscales",
    "bolsas_papel",
    "papel_antigrasa",
    "tubos_carton",
  ];

  const candidatos: Candidato[] = [];

  for (const c of cuentas) {
    if (yaEsta.has(c.id)) continue;
    // Sin una sola compra no es venta cruzada sino venta a secas.
    if (!LINEAS.some((l) => yaCompra.has(`${c.id}|${l}`))) continue;

    const faltan = (porTipo.get(normalizar(c.tipo_comercio ?? "")) ?? [])
      .filter(
        (p) =>
          p.suficiente &&
          !yaCompra.has(`${c.id}|${p.linea}`) &&
          p.pares_compran / p.pares_totales >= FUERTE,
      )
      .map((p) => ({
        linea: p.linea,
        deCada10: Math.round((p.pares_compran / p.pares_totales) * 10),
        gastoTipico: Number(p.gasto_tipico ?? 0),
      }));

    if (faltan.length === 0) continue;

    candidatos.push({
      id: c.id,
      nombre: c.nombre,
      tipoComercio: c.tipo_comercio,
      poblado: c.poblado,
      compraAlMes: c.total_12m === null ? 0 : Number(c.total_12m) / 12,
      faltan,
    });
  }

  // El que más te compra hoy es el que más probablemente te compre otra cosa.
  candidatos.sort((a, b) => b.compraAlMes - a.compraAlMes);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/listas/${id}`} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-marca">
            Clientes por cruzar
          </h1>
          <p className="truncate text-xs text-texto-atenuado">
            {lista.nombre}
            {lista.poblado && ` · ${lista.poblado}`}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {candidatos.length === 0 ? (
          <Tarjeta>
            <Vacio titulo="No hay clientes por cruzar aquí">
              {lista.poblado
                ? `Los clientes de ${lista.poblado} ya compran lo mismo que sus iguales, o todavía no tienen tipo de comercio para compararlos.`
                : "Los clientes de esta cartera ya compran lo mismo que sus iguales, o todavía no tienen tipo de comercio para compararlos."}
            </Vacio>
          </Tarjeta>
        ) : (
          <ElegirParaCruzar listaId={id} candidatos={candidatos} />
        )}
      </main>
    </>
  );
}
