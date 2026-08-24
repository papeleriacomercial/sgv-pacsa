import { CerrarSesion } from "@/components/cerrar-sesion";

const ROLES: Record<string, string> = {
  gerente: "Gerencia",
  lider: "Líder de ventas",
  vendedor: "Vendedor",
  administracion: "Administración",
};

/**
 * La identidad y la sesión, en todas las pantallas.
 *
 * La maqueta de referencia —`docs/sgv-preview.html`, heredada del SGP— pone la
 * marca en un bloque de la barra lateral: **Papelería Comercial** en blanco
 * sobre azul marino, y debajo el sistema. Aquí no hay barra lateral —esto se usa
 * con una mano en la calle— así que ese bloque se acuesta.
 *
 * **A la izquierda, de quién es la aplicación**, con el nombre al mismo tamaño
 * que los títulos de pantalla: si el dueño se lee más chico que la palabra
 * «Cuentas», no es identidad, es un pie de página.
 *
 * **A la derecha, quién está dentro y cómo salir**, juntos. Salir estaba como
 * botón en la cabecera de Agenda y de Cuentas —dos pantallas de nueve— y en
 * ninguna al lado del nombre del que había entrado. Nadie lo busca ahí: se
 * busca donde dice quién eres.
 *
 * **El filo ámbar** es la regla de §17 en su otro sentido: en el cromo el ámbar
 * significa identidad, no riesgo. Es el mismo gesto que el subrayado naranja del
 * SGP, y es lo que hace que quien usa el SGP reconozca el SGV de inmediato.
 */
export function BarraMarca({
  nombre,
  rol,
}: {
  nombre?: string | null;
  rol?: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-b-aviso bg-marca px-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold leading-tight tracking-tight text-white">
          Papelería Comercial
        </p>
        <p className="truncate text-[11px] leading-tight text-texto-atenuado">
          Sistema de Gestión de Ventas
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="max-w-[7.5rem] text-right">
          <p className="truncate text-xs leading-tight text-white">
            {nombre ?? "Sesión abierta"}
          </p>
          {rol && ROLES[rol] && (
            <p className="truncate text-[11px] leading-tight text-texto-atenuado">
              {ROLES[rol]}
            </p>
          )}
        </div>
        <CerrarSesion compacta />
      </div>
    </div>
  );
}
