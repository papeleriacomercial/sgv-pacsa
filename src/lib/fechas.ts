/**
 * Cómo se dicen los plazos en toda la aplicación.
 *
 * Un solo lugar para que la cartera no diga «Hace 90 días» mientras la lista
 * dice «Hace 3 meses» del mismo punto. Es la misma regla de §17 que obliga a
 * un solo sistema de tokens, aplicada a las palabras.
 */

/** Desde cuántos días una espera deja de ser normal y pasa a ser un aviso. */
export const ESPERA_LARGA = 60;

/** Días completos transcurridos desde una fecha, en la zona de Panamá. */
export function diasDesde(iso: string): number {
  const zona = "America/Panama";
  const dia = (d: Date) =>
    Date.parse(
      new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d) +
        "T00:00:00Z",
    );
  return Math.max(
    0,
    Math.round((dia(new Date()) - dia(new Date(iso))) / 86_400_000),
  );
}

/**
 * «Hoy», «Ayer», «Hace 5 días», «Hace 3 semanas», «Hace 2 meses».
 *
 * Se cambia de unidad porque «Hace 97 días» no se lee: hay que restar de
 * cabeza para saber si eso es mucho. El vendedor lo mira al sol y con prisa.
 */
export function haceDias(dias: number): string {
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 14) return `Hace ${dias} días`;
  if (dias < ESPERA_LARGA) return `Hace ${Math.floor(dias / 7)} semanas`;
  return `Hace ${Math.floor(dias / 30)} meses`;
}

/**
 * Lo que lleva un potencial en su lista sin que nadie lo toque.
 *
 * Recién agregado se dice en pasado —es un hecho—; a partir del día siguiente
 * se dice en presente, porque ya es una espera. La diferencia es la que hay
 * entre «lo levanté» y «lleva ahí dos meses».
 */
export function esperaEnLista(dias: number): string {
  if (dias <= 0) return "Agregado hoy";
  if (dias === 1) return "Esperando desde ayer";
  if (dias < 14) return `Esperando ${dias} días`;
  if (dias < ESPERA_LARGA) return `Esperando ${Math.floor(dias / 7)} semanas`;
  return `Esperando ${Math.floor(dias / 30)} meses`;
}

/**
 * Correr un día calendario hacia adelante o hacia atrás, sin salirse del día.
 *
 * **La hora del mediodía es lo único que importa acá.** `new Date("2026-09-03")` es medianoche
 * UTC, que en Panamá todavía es el 2: sumar un día desde ahí devuelve el 3 cuando se pedía el 4.
 * Parado al mediodía sobran doce horas de margen para cualquier lado, y ningún salto de mes ni de
 * año cae en el borde.
 *
 * Entra y sale como `YYYY-MM-DD`, que es el formato con el que trabajan el `input type="date"` y
 * las direcciones de las pantallas.
 */
export function correrDias(dia: string, cuantos: number): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + cuantos);
  return d.toLocaleDateString("en-CA");
}
