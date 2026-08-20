import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError } from "@/components/ui/estados";
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

  // Cuántos perfiles ve este usuario. Es la prueba visible del RLS: un vendedor
  // ve 1, un líder ve su equipo, gerencia los ve todos.
  const { count: perfilesVisibles } = await supabase
    .from("perfiles")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3">
        <span className="text-lg font-semibold text-marca">SGV</span>
        <CerrarSesion />
      </header>

      <main className="flex flex-col gap-4 p-4">
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
          <Tarjeta>
            <p className="text-sm text-texto-secundario">Sesión iniciada como</p>
            <p className="mt-1 text-xl font-semibold text-texto">
              {perfil.nombre}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Insignia tono="info">
                {ETIQUETA_ROL[perfil.rol as Rol] ?? perfil.rol}
              </Insignia>
              {perfil.activo ? (
                <Insignia tono="ok">Activo</Insignia>
              ) : (
                <Insignia tono="aviso">Inactivo</Insignia>
              )}
            </div>

            <p className="mt-4 font-mono text-xs text-texto-atenuado">
              {user.email}
            </p>
          </Tarjeta>
        )}

        <Tarjeta>
          <p className="text-sm font-medium text-texto">
            Perfiles visibles para ti
          </p>
          <p className="mt-1 font-mono text-3xl text-marca">
            {perfilesVisibles ?? 0}
          </p>
          <p className="mt-2 text-xs text-texto-secundario">
            Este número lo decide el RLS, no la pantalla. Un vendedor ve solo el
            suyo; un líder, los de su equipo; gerencia, todos.
          </p>
        </Tarjeta>
      </main>
    </>
  );
}
