import { clienteServidor } from "@/lib/supabase/servidor";
import type { Cuenta } from "@/lib/filtros";

/**
 * Trae la cartera que este usuario puede ver, con sus días calculados.
 *
 * **Qué devuelve lo decide el RLS, no esta función.** Un vendedor recibe lo
 * suyo; un líder, lo de su equipo; gerencia, todo. La vista `cuentas_resumen`
 * hereda esas políticas por `security_invoker`.
 */
export async function cargarCartera(): Promise<{
  cuentas: Cuenta[];
  vendedores: { id: string; nombre: string }[];
}> {
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("cuentas_resumen")
    .select(
      "id, nombre, tipo, tipo_comercio, poblado, volumen, productos_interes, vendedor_id, lat, lng, dias_sin_contacto, dias_hasta_compromiso, fuera_de_cadencia, sin_ubicacion, oportunidades_abiertas",
    )
    .order("nombre");

  const cuentas = (data ?? []).map((c) => ({
    ...c,
    lat: c.lat === null ? null : Number(c.lat),
    lng: c.lng === null ? null : Number(c.lng),
  })) as Cuenta[];

  // Los perfiles se traen aparte porque una vista no tiene llaves foráneas y
  // PostgREST no puede deducir la relación para incrustarlos. El RLS de
  // `perfiles` hace el resto: el vendedor se ve solo a sí mismo.
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre");

  return { cuentas, vendedores: perfiles ?? [] };
}
