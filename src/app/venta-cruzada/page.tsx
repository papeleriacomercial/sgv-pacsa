import { redirect } from "next/navigation";
import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { FiltroVendedor, type Vendedor } from "@/components/filtro-vendedor";
import { TriangleAlert } from "lucide-react";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";
import { normalizar } from "@/lib/texto";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Cuántos de cada diez comercios iguales tienen que comprar la línea para que
 * valga la pena ofrecerla. Es el mismo umbral de la tarjeta del expediente.
 */
const FUERTE = 0.5;

type Cuenta = {
  id: string;
  nombre: string;
  tipo_comercio: string | null;
  poblado: string | null;
  vendedor_id: string;
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

type Hueco = {
  cuenta: Cuenta;
  fuerza: number;
  gastoTipico: number;
};

/**
 * Qué le falta comprar a la cartera, línea por línea.
 *
 * **Es la lista de trabajo más barata que tiene el vendedor.** Cada nombre de
 * aquí es un cliente que ya lo conoce, ya le compra y ya le paga, y al que le
 * está vendiendo una sola de las cuatro cosas que la fábrica hace.
 *
 * Se agrupa por línea y no por cliente porque así es como se trabaja: «esta
 * semana salgo a ofrecer rollos» es una ruta; «a este cliente le falta rollos y
 * a este otro bolsas» es una lista que no se puede caminar.
 *
 * Solo aparece la línea que compran **la mitad o más** de los comercios del
 * mismo tipo. Que una panadería no compre tubos de cartón no dice nada si
 * ninguna panadería los compra; que no compre rollos cuando ocho de cada diez
 * sí, es una visita.
 */
export default async function VentaCruzadaCartera({
  searchParams,
}: PageProps<"/venta-cruzada">) {
  const params = await searchParams;
  const v = Array.isArray(params.v) ? params.v[0] : params.v;

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .in("rol", ["vendedor", "lider"])
    .is("deleted_at", null)
    .order("nombre");

  const vendedores = (perfiles ?? []) as Vendedor[];
  const nombres = new Map(vendedores.map((x) => [x.id, x.nombre]));

  const propio = nombres.has(user.id) ? user.id : "todos";
  const elegido =
    vendedores.length > 1 && (v === "todos" || (v && nombres.has(v))) ? v : propio;
  const ids = elegido === "todos" ? vendedores.map((x) => x.id) : [elegido];

  // Los tres conjuntos: mis cuentas, qué compra cada una, y qué compran los de
  // su tipo. Los dos primeros los recorta el RLS; el tercero es agregado y
  // cruza a propósito — ver la migración `20260827010000_cruzada_sin_fuga`.
  const { data: crudas } = await supabase
    .from("cuentas_resumen")
    .select("id, nombre, tipo_comercio, poblado, vendedor_id, total_12m")
    .in("vendedor_id", ids)
    .eq("tipo", "cliente")
    .not("tipo_comercio", "is", null)
    .is("deleted_at", null);

  const cuentas = (crudas ?? []) as Cuenta[];

  // **Lo que hace corta esta lista no es que no haya huecos.** De los 233
  // clientes que compran algo, 177 llegaron de Zoho sin tipo de comercio, y
  // sin tipo no hay con quién compararlos. Decirlo aquí convierte el límite
  // en una tarea; callarlo hace pensar que la cartera está completa.
  const { count: sinTipo } = await supabase
    .from("cuentas_resumen")
    .select("id", { count: "exact", head: true })
    .in("vendedor_id", ids)
    .eq("tipo", "cliente")
    .is("tipo_comercio", null)
    .not("ultima_compra", "is", null)
    .is("deleted_at", null);

  const [{ data: compras }, { data: props }] = await Promise.all([
    supabase
      .from("compra_por_linea")
      .select("cuenta_id, linea")
      .in(
        "cuenta_id",
        // Sin cuentas no hay nada que preguntar, y un `in` vacío devuelve todo.
        cuentas.length > 0 ? cuentas.map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"],
      ),
    supabase.rpc("proporcion_por_tipo"),
  ]);

  const yaCompra = new Set(
    ((compras ?? []) as { cuenta_id: string; linea: string }[]).map(
      (x) => `${x.cuenta_id}|${x.linea}`,
    ),
  );

  const proporciones = (props ?? []) as Proporcion[];
  const porTipo = new Map<string, Proporcion[]>();
  for (const p of proporciones) {
    porTipo.set(p.tipo, [...(porTipo.get(p.tipo) ?? []), p]);
  }

  // Para cada línea, los clientes a los que les falta y a cuyos iguales no.
  const huecos = new Map<string, Hueco[]>();

  for (const c of cuentas) {
    // Sin una sola compra no es venta cruzada sino venta a secas, y esa
    // conversación es otra: no se sabe si el cliente compra en otro lado o si
    // simplemente todavía no ha comprado nada.
    if (!yaCompra.has(`${c.id}|rollos_fiscales`) &&
        !yaCompra.has(`${c.id}|bolsas_papel`) &&
        !yaCompra.has(`${c.id}|papel_antigrasa`) &&
        !yaCompra.has(`${c.id}|tubos_carton`)) {
      continue;
    }

    for (const p of porTipo.get(normalizar(c.tipo_comercio ?? "")) ?? []) {
      if (!p.suficiente) continue;
      if (yaCompra.has(`${c.id}|${p.linea}`)) continue;

      const fuerza = p.pares_compran / p.pares_totales;
      if (fuerza < FUERTE) continue;

      huecos.set(p.linea, [
        ...(huecos.get(p.linea) ?? []),
        { cuenta: c, fuerza, gastoTipico: Number(p.gasto_tipico ?? 0) },
      ]);
    }
  }

  // El cliente que más te compra hoy es el que más probablemente te compre
  // otra cosa: ya te conoce, ya te paga y ya tiene la puerta abierta.
  for (const [, lista] of huecos) {
    lista.sort((a, b) => Number(b.cuenta.total_12m ?? 0) - Number(a.cuenta.total_12m ?? 0));
  }

  const ordenadas = [...huecos.entries()].sort((a, b) => b[1].length - a[1].length);
  const total = [...huecos.values()].reduce((s, l) => s + l.length, 0);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/oportunidades" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-marca">Lo que no te compran</h1>
          <p className="text-xs text-texto-atenuado">
            {total === 0
              ? "Sin huecos por ahora"
              : `${total} ${total === 1 ? "hueco" : "huecos"} en ${ordenadas.length} ${ordenadas.length === 1 ? "línea" : "líneas"}`}
          </p>
        </div>
      </header>

      <FiltroVendedor
        vendedores={vendedores}
        elegido={elegido}
        yo={user.id}
        href={(valor) => (valor === propio ? "/venta-cruzada" : `/venta-cruzada?v=${valor}`)}
      />

      <main className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-sm text-texto-secundario">
          Clientes que ya te compran una línea y no otra que sí compra la mitad
          o más de los comercios de su mismo tipo.
        </p>

        {sinTipo !== null && sinTipo > 0 && (
          <Link href="/cuentas?soloSinCategoria=1" className="block">
            <Tarjeta className="flex items-start gap-2 border-aviso/40">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-aviso" aria-hidden />
              <div>
                <p className="text-sm text-texto">
                  {sinTipo} {sinTipo === 1 ? "cliente que compra no tiene" : "clientes que compran no tienen"}{" "}
                  tipo de comercio.
                </p>
                <p className="text-xs text-texto-secundario">
                  Sin eso no hay con quién compararlos y no aparecen aquí.
                  Ponérselo es un toque en su expediente.
                </p>
              </div>
            </Tarjeta>
          </Link>
        )}

        {ordenadas.length === 0 && (
          <Tarjeta>
            <Vacio titulo="No hay huecos que ofrecer">
              O tus clientes ya te compran todo lo que compran sus iguales, o
              todavía no hay suficientes clientes del mismo tipo para
              compararlos.
            </Vacio>
          </Tarjeta>
        )}

        {ordenadas.map(([linea, lista]) => (
          <section key={linea} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-texto">
                {LINEAS_PRODUCTO[linea as LineaProducto] ?? linea}
              </h2>
              <span className="font-mono text-xs text-texto-secundario">
                {lista.length} {lista.length === 1 ? "cliente" : "clientes"}
              </span>
            </div>

            {lista.map(({ cuenta, fuerza, gastoTipico }) => (
              <Link key={cuenta.id} href={`/cuentas/${cuenta.id}`} className="block">
                <Tarjeta className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-texto">
                      {cuenta.nombre}
                    </p>
                    <p className="truncate text-xs text-texto-secundario">
                      {cuenta.tipo_comercio}
                      {cuenta.poblado && ` · ${cuenta.poblado}`}
                      {elegido === "todos" &&
                        ` · ${nombres.get(cuenta.vendedor_id) ?? ""}`}
                    </p>
                    <p className="text-xs text-texto-atenuado">
                      {Math.round(fuerza * 10)} de cada 10 lo compran
                    </p>
                  </div>
                  {gastoTipico > 0 && (
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm text-texto">
                        ~{DINERO.format(gastoTipico)}
                      </span>
                      <span className="block text-xs text-texto-atenuado">
                        al mes
                      </span>
                    </span>
                  )}
                </Tarjeta>
              </Link>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
