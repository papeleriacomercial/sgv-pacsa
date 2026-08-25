import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarCartera } from "@/lib/cartera";
import { CuentasConFiltros } from "@/components/cuentas-con-filtros";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";

export default async function Mapa({ searchParams }: PageProps<"/mapa">) {
  // Se llega aquí desde el expediente con `?cuenta=<id>` para abrir el mapa
  // centrado en ese punto, y desde una lista con `?lista=<id>` para ver solo
  // los puntos de esa lista.
  const { cuenta, lista } = await searchParams;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { cuentas, vendedores } = await cargarCartera();

  // Filtrar por lista se hace aquí y no con los filtros de la cartera: la
  // pertenencia a una lista no es un atributo de la cuenta sino una relación,
  // y meterla al motor de filtros obligaría a cargarla siempre.
  let visibles = cuentas;
  let nombreLista: string | null = null;

  if (typeof lista === "string") {
    const [{ data: miembros }, { data: fila }] = await Promise.all([
      supabase.from("listas_cuentas").select("cuenta_id").eq("lista_id", lista),
      supabase.from("listas").select("nombre").eq("id", lista).maybeSingle(),
    ]);

    const ids = new Set((miembros ?? []).map((m) => m.cuenta_id as string));
    visibles = cuentas.filter((c) => ids.has(c.id));
    nombreLista = fila?.nombre ?? null;
  }

  // Los que llegaron sin coordenadas no se pueden dibujar, y decirlo es mejor
  // que un mapa vacío sin explicación.
  const sinUbicar = visibles.filter((c) => c.sin_ubicacion).length;

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">
          {nombreLista ?? "Mapa"}
        </h1>
        {nombreLista && (
          <p className="text-xs text-texto-atenuado">
            {visibles.length} de esta lista
            {sinUbicar > 0 && " · " + sinUbicar + " sin ubicación"}
          </p>
        )}
      </header>

      <main className="flex flex-1 flex-col p-4">
        {visibles.length === 0 ? (
          <Tarjeta>
            <Vacio titulo="No hay nada que dibujar">
              {nombreLista
                ? "Esta lista todavía no tiene puntos, o los que tiene llegaron sin coordenadas."
                : "Todavía no tienes cuentas con ubicación."}
            </Vacio>
          </Tarjeta>
        ) : (
          <CuentasConFiltros
            cuentas={visibles}
            vendedores={vendedores}
            vistaInicial="mapa"
            yo={user.id}
            cuentaDestacada={typeof cuenta === "string" ? cuenta : undefined}
          />
        )}
      </main>
    </>
  );
}
