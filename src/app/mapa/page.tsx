import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Etapa, LineaProducto } from "@/lib/catalogos";
import { MapaConFiltros } from "@/components/mapa-con-filtros";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

export default async function Mapa() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // Qué puntos devuelve esta consulta lo decide el RLS, no la pantalla: un
  // vendedor ve los suyos, un líder los de su equipo, gerencia todos.
  const { data } = await supabase
    .from("prospectos")
    .select("id, nombre, lat, lng, etapa, tipo_comercio, productos_interes")
    .is("deleted_at", null)
    .not("lat", "is", null)
    .not("lng", "is", null);

  const puntos = (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    lat: Number(p.lat),
    lng: Number(p.lng),
    etapa: p.etapa as Etapa,
    tipoComercio: p.tipo_comercio,
    productos: (p.productos_interes as LineaProducto[]) ?? [],
  }));

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Mapa</h1>
      </header>

      <main className="flex flex-1 flex-col p-4">
        <MapaConFiltros puntos={puntos} />
      </main>
    </>
  );
}
