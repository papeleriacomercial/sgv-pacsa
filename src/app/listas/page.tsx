import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarListas, cargarListasDelEquipo } from "@/lib/listas";
import { CLASES_VENTA, TIPOS_LISTA, type TipoLista } from "@/lib/catalogos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/**
 * Los paquetes de potenciales, por zona y por objetivo.
 *
 * Es la pantalla de planificación, no la del día: aquí arma los grupos y ve
 * cuánto le falta de cada uno. Lo que hace hoy vive en la agenda.
 */
export default async function Listas({ searchParams }: PageProps<"/listas">) {
  const { equipo } = await searchParams;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  // Quien ve a más de uno puede mirar las del equipo, pero **lo suyo va por
  // omisión**: esta es su pantalla de planificación, no un tablero.
  const puedeVerEquipo = perfil?.rol === "lider" || perfil?.rol === "gerente";
  const verEquipo = puedeVerEquipo && equipo === "1";

  const listas = verEquipo
    ? await cargarListasDelEquipo()
    : await cargarListas(user.id);
  const nombres = verEquipo
    ? new Map(
        (
          (await supabase.from("perfiles").select("id, nombre")).data ?? []
        ).map((p) => [p.id as string, p.nombre as string]),
      )
    : new Map<string, string>();

  const porTipo = (tipo: TipoLista) => listas.filter((l) => l.tipo === tipo);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">
          {verEquipo ? "Listas del equipo" : "Listas"}
        </h1>
        <Link
          href="/listas/nueva"
          className="min-h-tactil flex items-center gap-1.5 text-sm text-texto-secundario"
        >
          <Plus size={16} aria-hidden />
          Nueva
        </Link>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {/* Solo para quien ve a más de una persona. A un vendedor,
            «las mías» y «las del equipo» son lo mismo. */}
        {puedeVerEquipo && (
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["", "Las mías"],
                ["1", "Las del equipo"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <Link
                key={etiqueta}
                href={valor ? "/listas?equipo=1" : "/listas"}
                aria-current={(equipo === "1") === Boolean(valor) ? "page" : undefined}
                className={`min-h-tactil flex items-center justify-center rounded-lg border text-sm ${
                  (equipo === "1") === Boolean(valor)
                    ? "border-marca bg-marca text-white"
                    : "border-borde bg-superficie text-texto"
                }`}
              >
                {etiqueta}
              </Link>
            ))}
          </div>
        )}

        {listas.length === 0 && (
          <Tarjeta>
            <Vacio titulo="Todavía no tienes listas">
              Una lista es un grupo de puntos por trabajar: los de un poblado, o
              las cuentas grandes que estás persiguiendo. Se arman desde el mapa
              o desde la búsqueda, y se trabajan por tandas.
            </Vacio>
          </Tarjeta>
        )}

        {(Object.keys(TIPOS_LISTA) as TipoLista[]).map((tipo) => {
          const grupo = porTipo(tipo);
          if (grupo.length === 0) return null;

          return (
            <section key={tipo} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-texto">
                {TIPOS_LISTA[tipo]}
              </h2>

              {grupo.map((l) => (
                <Link key={l.id} href={`/listas/${l.id}`} className="block">
                  <Tarjeta className="flex flex-col gap-1.5">
                    {verEquipo && l.vendedor_id && (
                      <p className="text-xs text-texto-atenuado">
                        {nombres.get(l.vendedor_id) ?? "Otro vendedor"}
                      </p>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold text-texto">
                        {l.nombre}
                      </p>
                      {l.clase && (
                        <Insignia tono={l.clase === "grande" ? "info" : "neutro"}>
                          {CLASES_VENTA[l.clase]}
                        </Insignia>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-texto-secundario">
                        {l.sin_tocar} sin tocar
                      </span>
                      <span className="font-mono text-xs text-texto-atenuado">
                        {l.trabajadas} de {l.total} trabajadas
                      </span>
                    </div>

                    {/* Un paquete permanente acumula muertos. La defensa no es
                        vencerlo por la fuerza —Aguadulce sigue siendo
                        Aguadulce— sino mostrar la antigüedad. */}
                    {l.sin_tocar_hace_mucho > 0 && (
                      <p className="text-xs text-aviso">
                        {l.sin_tocar_hace_mucho}{" "}
                        {l.sin_tocar_hace_mucho === 1
                          ? "lleva"
                          : "llevan"}{" "}
                        más de dos meses esperando
                      </p>
                    )}
                  </Tarjeta>
                </Link>
              ))}
            </section>
          );
        })}
      </main>
    </>
  );
}
