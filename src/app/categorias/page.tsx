import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import {
  DepurarCategorias,
  type Categoria,
} from "@/components/depurar-categorias";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/**
 * Depuración del catálogo de tipos de comercio.
 *
 * D-012 dejó el catálogo abierto —lo alimentan los vendedores escribiendo— y
 * prometió esta pantalla en la misma decisión. Sin ella, un catálogo abierto
 * solo puede crecer: nadie tenía forma de unir «Panadería» con «Panaderia» ni
 * de corregir un «mimisuper».
 *
 * Del líder y de gerencia. El líder porque revisa el trabajo del equipo cada
 * semana y ve el dedazo el viernes, no dentro de un mes.
 */
export default async function Categorias() {
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

  // La autorización de verdad la aplica el RLS y las funciones de la base; esto
  // es para no enseñar una pantalla que no va a poder usar.
  if (perfil?.rol !== "gerente" && perfil?.rol !== "lider") notFound();

  const { data } = await supabase
    .from("categorias_uso")
    .select("id, nombre, cuentas")
    .order("cuentas", { ascending: false })
    .order("nombre");

  const categorias = (data ?? []) as Categoria[];
  const clasificadas = categorias.reduce((n, c) => n + c.cuentas, 0);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/cuentas" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-marca">
            Tipos de comercio
          </h1>
          <p className="text-xs text-texto-atenuado">
            {categorias.length} en el catálogo · {clasificadas} cuentas
            clasificadas
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-sm text-texto-secundario">
          El catálogo lo escriben los vendedores en la calle. Aquí se corrige lo
          que entró mal, y toda corrección arrastra las cuentas que la usaban.
        </p>

        <DepurarCategorias categorias={categorias} />
      </main>
    </>
  );
}
