import { clienteServidor } from "@/lib/supabase/servidor";
import type { ClaseVenta, TipoLista } from "@/lib/catalogos";

/**
 * Las listas y su contenido.
 *
 * Una lista es dónde caza; la agenda es qué debe. Un lead no aparece en la
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
};

/** Qué devuelve depende del RLS: el vendedor ve las suyas, el líder las de su equipo. */
export async function cargarListas(): Promise<Lista[]> {
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("listas_resumen")
    .select(
      "id, nombre, tipo, clase, poblado, archivada, total, sin_tocar, trabajadas, sin_tocar_hace_mucho",
    )
    .eq("archivada", false)
    .order("tipo")
    .order("nombre");

  return (data ?? []) as Lista[];
}
