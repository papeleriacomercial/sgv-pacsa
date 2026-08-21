import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
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

export default async function Inicio() {
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

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3">
        <span className="text-lg font-semibold text-marca">SGV</span>
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
