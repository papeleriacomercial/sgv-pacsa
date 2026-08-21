import type { SupabaseClient } from "@supabase/supabase-js";

const LADO_MAXIMO = 1280;
const CALIDAD = 0.7;

/**
 * Comprime la foto en el dispositivo antes de subirla.
 *
 * No es una optimización: el vendedor del interior trabaja con mala señal y
 * una foto de cámara moderna pesa varios megabytes. Sin comprimir, la subida
 * falla o se come el plan de datos.
 */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext("2d");
  if (!contexto) return archivo;
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();

  const comprimida = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", CALIDAD),
  );

  return comprimida ?? archivo;
}

/**
 * Sube la foto de una visita y devuelve su ruta.
 *
 * La ruta empieza por el id del vendedor porque la política de Storage compara
 * ese primer segmento contra `auth.uid()`. Sin esa convención, el RLS de la
 * tabla `visitas` sería decorativo: bastaría adivinar la URL para ver la
 * evidencia de otro vendedor.
 */
export async function subirFoto(
  supabase: SupabaseClient,
  vendedorId: string,
  visitaId: string,
  archivo: File,
): Promise<string | null> {
  const comprimida = await comprimirImagen(archivo);
  const ruta = `${vendedorId}/${visitaId}.jpg`;

  const { error } = await supabase.storage
    .from("visitas")
    .upload(ruta, comprimida, { contentType: "image/jpeg" });

  if (error) return null;
  return ruta;
}
