const ROLES: Record<string, string> = {
  gerente: "Gerencia",
  lider: "Líder de ventas",
  vendedor: "Ventas",
  administracion: "Administración",
};

/**
 * La identidad, en todas las pantallas.
 *
 * La maqueta de referencia —`docs/sgv-preview.html`, heredada del SGP— pone la
 * marca en un bloque de la barra lateral: **Papelería Comercial** en blanco
 * sobre azul marino, y debajo «SGV · Gerencia». Aquí no hay barra lateral —esto
 * se usa con una mano en la calle— así que ese bloque se acuesta y se vuelve
 * una sola línea arriba de todo.
 *
 * **Una línea y no dos, a propósito.** La cabecera de cada pantalla ya ocupa
 * unos 48 píxeles; un bloque de marca de dos líneas encima dejaría casi cien de
 * cromo antes del primer dato, en un teléfono y a pleno sol. Treinta y dos
 * píxeles alcanzan para que la aplicación tenga nombre y dueño.
 *
 * **El filo ámbar** es la regla de §17 en su otro sentido: en el cromo el ámbar
 * significa identidad, no riesgo. Es el mismo gesto que el subrayado naranja
 * del SGP, y es lo que hace que quien usa el SGP reconozca el SGV de inmediato.
 */
export function BarraMarca({ rol }: { rol?: string }) {
  return (
    <div className="flex shrink-0 items-baseline justify-between gap-3 border-b-2 border-b-aviso bg-marca px-4 py-1.5">
      <p className="truncate text-xs font-semibold tracking-tight text-white">
        Papelería Comercial
      </p>
      <p className="shrink-0 text-[11px] text-texto-atenuado">
        SGV{rol && ROLES[rol] ? ` · ${ROLES[rol]}` : ""}
      </p>
    </div>
  );
}
