/**
 * Comparar texto como lo compara una persona.
 *
 * Gemela de `public.normalizar_texto()` en la base. Si las dos dejan de
 * coincidir, el buscador ofrecería una categoría que la base considera
 * distinta —o al revés— y volverían los duplicados.
 */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Si el texto escrito aparece en cualquier parte del candidato, sin acentos. */
export function contiene(candidato: string, escrito: string): boolean {
  return normalizar(candidato).includes(normalizar(escrito));
}

/**
 * Cuántas letras hay que cambiar para pasar de una palabra a la otra.
 *
 * Sirve para sospechar de un dedazo: «mimisuper» y «minisuper» están a una.
 * Compara ya normalizado, porque «Panadería» y «panaderia» tienen que dar
 * cero y no dos.
 */
export function distancia(a: string, b: string): number {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x === y) return 0;

  let previa = Array.from({ length: y.length + 1 }, (_, i) => i);

  for (let i = 1; i <= x.length; i++) {
    const fila = [i];
    for (let j = 1; j <= y.length; j++) {
      fila[j] = Math.min(
        previa[j] + 1,
        fila[j - 1] + 1,
        previa[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    previa = fila;
  }

  return previa[y.length];
}

/**
 * Hasta cuántos cambios se consideran un dedazo y no dos palabras distintas.
 *
 * Con 1 se escapan cosas como «mimisuper»/«minisuper» invertidas; con 3
 * empieza a emparejar «taller» con «tallercito», que no son lo mismo. Dos es
 * el punto donde la lista de sospechas todavía se revisa en un minuto.
 */
export const PARECIDO = 2;

/**
 * Pares de nombres que probablemente sean la misma cosa mal escrita.
 *
 * Además de la distancia, se marca cuando uno **contiene** al otro —«super» y
 * «supermercado»—, que no es un dedazo pero casi siempre conviene unificar.
 */
export function parecidos<T extends { nombre: string }>(lista: T[]): [T, T][] {
  const pares: [T, T][] = [];

  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = normalizar(lista[i].nombre);
      const b = normalizar(lista[j].nombre);
      const cerca = distancia(a, b) <= PARECIDO;
      const dentro = a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a));
      if (cerca || dentro) pares.push([lista[i], lista[j]]);
    }
  }

  return pares;
}
