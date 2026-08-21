import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { type Etapa } from "@/lib/catalogos";
import { FichaPunto } from "@/components/ficha-punto";
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

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

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

  const { data: prospectos } = await supabase
    .from("prospectos")
    .select("id, nombre, tipo_comercio, etapa")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Última interacción de cada punto, para la línea de abajo de la ficha.
  const { data: visitas } = await supabase
    .from("visitas")
    .select("prospecto_id, fecha")
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  const ultimaPorProspecto = new Map<string, string>();
  visitas?.forEach((v) => {
    if (!ultimaPorProspecto.has(v.prospecto_id)) {
      ultimaPorProspecto.set(v.prospecto_id, v.fecha);
    }
  });

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

        <Link
          href="/prospectos/nuevo"
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-4 text-base font-medium text-white"
        >
          <Plus size={18} aria-hidden />
          Nuevo prospecto
        </Link>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Mis prospectos</h2>

          {!prospectos?.length && (
            <Tarjeta>
              <Vacio titulo="Todavía no tienes prospectos">
                Crea el primero desde el botón de arriba. Se registra en menos
                de 30 segundos.
              </Vacio>
            </Tarjeta>
          )}

          {prospectos?.map((p) => {
            const ultima = ultimaPorProspecto.get(p.id);
            return (
              <FichaPunto
                key={p.id}
                id={p.id}
                nombre={p.nombre}
                tipoComercio={p.tipo_comercio}
                etapa={p.etapa as Etapa}
                potencial={null}
                ultimaInteraccion={ultima ? FECHA.format(new Date(ultima)) : null}
              />
            );
          })}
        </section>
      </main>
    </>
  );
}
