import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
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

      <main className="flex flex-1 flex-col gap-3 p-4">
        {/* BUSCAR POTENCIALES VIVE AQUÍ, y la barra de navegación ya lo decía desde antes:
            «Buscar sale de la barra: es la misma acción que el mapa —encontrar puntos nuevos— con
            otra forma de hacerla, y se llega desde ahí y desde una lista.» Se había decidido y
            nunca se puso; quedó colgado en la pantalla de Cuentas, donde «Buscar» sólo se puede
            leer como buscar entre las cuentas propias.

            SE DICE «POTENCIALES» Y NO «PROSPECTOS» porque es lo que se crea: estos puntos entran
            sin tipo, o sea como potenciales. Un prospecto es un potencial que ya se visitó, y
            llamarle así a un punto que salió de un mapa adelanta un trabajo que no se hizo.

            Y SI SE VIENE MIRANDO UNA LISTA, la búsqueda arranca apuntando a ella: lo que se
            encuentre cae dentro en vez de soltarse en la cartera. No hubo que construir nada — el
            mapa ya sabe qué lista muestra y la búsqueda ya sabe recibirla. */}
        <Link
          href={typeof lista === "string" ? `/buscar?lista=${lista}` : "/buscar"}
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-4 text-base font-medium text-texto"
        >
          <Search size={18} aria-hidden />
          {nombreLista ? `Buscar potenciales para ${nombreLista}` : "Buscar potenciales"}
        </Link>

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
