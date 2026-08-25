import { clienteServidor } from "@/lib/supabase/servidor";
import type { ClaseVenta, TipoLista } from "@/lib/catalogos";

/**
 * Las listas y su contenido.
 *
 * Una lista es dónde caza; la agenda es qué debe. Un potencial no aparece en la
 * agenda hasta que se toca y deja un próximo paso — por eso los cincuenta
 * puntos del domingo no ahogan lo que hay que hacer hoy.
 */

export type Lista = {
  id: string;
  nombre: string;
  tipo: TipoLista;
  clase: ClaseVenta | null;
  poblado: string | null;
  archivada: boolean;
  total: number;
  sin_tocar: number;
  trabajadas: number;
  sin_tocar_hace_mucho: number;
  vendedor_id?: string;
};

/**
 * Las listas de alguien, o las de todo el equipo.
 *
 * **Con `vendedorId` devuelve solo las suyas, y ese es el uso normal.** El
 * RLS deja al líder ver las de su equipo, pero poder verlas no las hace
 * suyas: sin filtrar, su pantalla de planificación se llenaba de las rutas
 * de Aguadulce y Chitré de otro vendedor.
 *
 * Sin `vendedorId` devuelve todo lo que el RLS permita, que es lo que hace
 * falta cuando el líder quiere mirar cómo va el equipo.
 */
export async function cargarListas(vendedorId?: string): Promise<Lista[]> {
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("listas_resumen")
    .select(
      "id, nombre, tipo, clase, poblado, archivada, total, sin_tocar, trabajadas, sin_tocar_hace_mucho, vendedor_id",
    )
    .eq("archivada", false);

  if (vendedorId) consulta = consulta.eq("vendedor_id", vendedorId);

  const { data } = await consulta
    .order("tipo")
    .order("nombre");

  return (data ?? []) as Lista[];
}
