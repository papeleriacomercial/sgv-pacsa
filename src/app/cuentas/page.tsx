import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, Plus, Search, Tags } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarCartera } from "@/lib/cartera";
import { CuentasConFiltros } from "@/components/cuentas-con-filtros";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError, Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { CerrarSesion } from "@/components/cerrar-sesion";

type Rol = "gerente" | "lider" | "vendedor" | "administracion";

const ETIQUETA_ROL: Record<Rol, string> = {
  gerente: "Gerente",
  lider: "Líder de ventas",
  vendedor: "Vendedor",
  administracion: "Administración",
};

/**
 * La cartera.
 *
 * Dejó de ser la pantalla de inicio: el día empieza en la Agenda, y esta pasa a
 * ser lo que en realidad es — la pantalla de consulta. Buscar un cliente,
 * corregir datos, revisar un expediente.
 *
 * **Los leads no se ven aquí.** Un lead es abundante y desechable; una cuenta
 * es escasa y permanente, y mezclarlos hace que la segunda se pierda: veinte
 * puntos de Aguadulce un día, veinte de Chitré al otro, y en un mes hay cien
 * sin clasificar tapando las treinta que de verdad se trabajan.
 *
 * Escondidos no es lo mismo que ocultos: arriba se dice cuántos hay y dónde
 * están, y el panel de filtros los trae con un interruptor.
 */
export default async function Cuentas() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El proxy ya redirige, pero la comprobación de verdad va aquí: la
  // autorización nunca se delega al proxy (docs/03-seguridad-rls.md).
  if (!user) redirect("/entrar");

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("nombre, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  const { cuentas, vendedores } = await cargarCartera();

  // Se cuentan aquí y no en el cliente porque el aviso tiene que aparecer
  // aunque el filtro los esté escondiendo — que es siempre.
  const leads = cuentas.filter((c) => c.tipo === "sin_clasificar").length;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Cuentas</h1>
        <CerrarSesion />
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {error && (
          <MensajeError
            titulo="No se pudo leer el perfil"
            detalle={error.message}
          />
        )}

        {!error && !perfil && (
          <MensajeError
            titulo="Tu usuario no tiene perfil"
            detalle="La cuenta existe pero le falta su fila en la tabla de perfiles. Pídele a gerencia que la cree."
          />
        )}

        {perfil && (
          <Tarjeta className="flex items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-texto">
                {perfil.nombre}
              </p>
              <p className="font-mono text-xs text-texto-atenuado">
                {user.email}
              </p>
            </div>
            <Insignia tono="info">
              {ETIQUETA_ROL[perfil.rol as Rol] ?? perfil.rol}
            </Insignia>
          </Tarjeta>
        )}

        {(perfil?.rol === "gerente" || perfil?.rol === "lider") && (
          <Link
            href="/categorias"
            className="flex min-h-tactil items-center gap-3 rounded-lg border border-borde bg-superficie px-4 py-2 text-sm text-texto"
          >
            <Tags size={18} className="shrink-0 text-texto-atenuado" aria-hidden />
            <span>Depurar los tipos de comercio</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/cuentas/nuevo"
            className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-4 text-base font-medium text-white"
          >
            <Plus size={18} aria-hidden />
            Nueva cuenta
          </Link>
          <Link
            href="/buscar"
            className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-4 text-base font-medium text-texto"
          >
            <Search size={18} aria-hidden />
            Buscar
          </Link>
        </div>

        {leads > 0 && (
          <Link
            href="/listas"
            className="flex min-h-tactil items-center gap-3 rounded-lg border border-borde bg-superficie px-4 py-2 text-sm text-texto"
          >
            <ListChecks size={18} className="shrink-0 text-texto-atenuado" aria-hidden />
            <span>
              <strong className="font-mono">{leads}</strong>
              {leads === 1 ? " lead sin clasificar" : " leads sin clasificar"}
              {" — no se muestran aquí. Están en tus listas."}
            </span>
          </Link>
        )}

        {cuentas.length === 0 ? (
          <Tarjeta>
            <Vacio titulo="Todavía no tienes cuentas">
              Crea la primera con el botón de arriba, o búscalas en el mapa.
            </Vacio>
          </Tarjeta>
        ) : (
          <CuentasConFiltros cuentas={cuentas} vendedores={vendedores} />
        )}
      </main>
    </>
  );
}
