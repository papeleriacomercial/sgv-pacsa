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
 * Las listas de una persona.
 *
 * **El dueño es obligatorio, y eso es el arreglo.** Antes se podía llamar
 * sin él y devolvía todo lo que el RLS permitiera — o sea que la opción
 * peligrosa era la que salía por omisión. Se coló tres veces: en la agenda,
 * en la pantalla de listas y en el plan de la semana, donde al líder le
 * aparecían las rutas de Aguadulce y Chitré de otro vendedor.
 *
 * Poder ver algo no lo hace tuyo. Para mirar al equipo está
 * `cargarListasDelEquipo`, que hay que pedir a propósito.
 */
export async function cargarListas(vendedorId: string): Promise<Lista[]> {
  return consultar(vendedorId);
}

/** Todo lo que el RLS permita ver. Para el líder mirando a su equipo. */
export async function cargarListasDelEquipo(): Promise<Lista[]> {
  return consultar(undefined);
}

async function consultar(vendedorId?: string): Promise<Lista[]> {
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
