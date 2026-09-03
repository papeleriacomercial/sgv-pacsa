import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import { ElegirElDia } from "@/components/elegir-el-dia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Panama",
});

/**
 * Desde cuándo se sabe qué cuenta se actualizó.
 *
 * **Antes de esta fecha el dato no existe y no se puede reconstruir.** La auditoría guardaba dos
 * campos —quién es el dueño y si pasó a cliente— y nada más; un cambio de teléfono no dejaba
 * rastro. Se amplió el 3 de septiembre de 2026, junto con esta pantalla.
 *
 * Los días anteriores muestran una raya. **Un cero diría «no hizo nada», y lo cierto es «no se
 * sabe»** — y esas dos cosas, en un reporte que se usa para evaluar a alguien, no se pueden
 * confundir.
 */
const DESDE_QUE_SE_AUDITAN_LAS_FICHAS = "2026-09-03";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

type Fila = {
  vendedor_id: string;
  nombre: string;
  rol: string;
  cuentas_creadas: number;
  cuentas_actualizadas: number;
  seguimientos_registrados: number;
  seguimientos_programados: number;
  listas_creadas: number;
  cuentas_agregadas_a_listas: number;
};

/** Las seis cifras, en el orden en que se leen: primero la cartera, después el trabajo del día. */
const CIFRAS: {
  campo: keyof Omit<Fila, "vendedor_id" | "nombre" | "rol">;
  rotulo: string;
  /** Sólo la de fichas: no existe antes de que se auditaran. */
  desde?: string;
}[] = [
  { campo: "cuentas_creadas", rotulo: "Cuentas creadas" },
  {
    campo: "cuentas_actualizadas",
    rotulo: "Cuentas actualizadas",
    desde: DESDE_QUE_SE_AUDITAN_LAS_FICHAS,
  },
  { campo: "seguimientos_registrados", rotulo: "Seguimientos registrados" },
  { campo: "seguimientos_programados", rotulo: "Seguimientos programados" },
  { campo: "listas_creadas", rotulo: "Listas creadas" },
  { campo: "cuentas_agregadas_a_listas", rotulo: "Cuentas a listas" },
];

/**
 * Quién usó la herramienta, y en qué, un día concreto — §7.1.
 *
 * Lo pidió el usuario el 3 de septiembre de 2026 y dijo para qué, que es lo que decide todo lo
 * demás: *«para entender si los vendedores están inicialmente sacando provecho de la
 * herramienta»*. **No mide ventas ni esfuerzo: mide uso.** Un vendedor puede tener un día
 * excelente en la calle y salir en cero aquí — lo que eso dice es que no lo capturó, que es
 * justamente el riesgo del arranque.
 *
 * **Vive fuera del tablero del lunes a propósito.** Aquél son tres cosas y ninguna más; una cuarta
 * lo convierte en la pantalla que se abre con desgano. Esta se abre cuando se quiere revisar la
 * adopción, que es otro momento y otra cabeza.
 *
 * Y el orden es alfabético, no por quién trabajó más. **Un reporte que se lee todos los días tiene
 * que tener a cada persona en el mismo sitio**; ordenar por actividad hace que el renglón se mueva
 * y obliga a buscar. Quien no hizo nada se distingue por su etiqueta, no por su posición.
 */
export default async function Actividad({
  searchParams,
}: PageProps<"/tablero/actividad">) {
  const params = await searchParams;
  const pedido = Array.isArray(params.dia) ? params.dia[0] : params.dia;
  const hoy = hoyEnPanama();

  // Un día que no tiene forma de día, o que todavía no pasó, se lee como hoy. La dirección la
  // escribe cualquiera y esta pantalla no debería reventar por eso.
  const dia =
    pedido && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(pedido) && pedido <= hoy
      ? pedido
      : hoy;

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  // La puerta de verdad está adentro de la función, que es security definer y la comprueba antes de
  // devolver nada. Esto es para no mostrar una pantalla que va a dar error.
  if (perfil?.rol !== "gerente") notFound();

  const { data, error } = await supabase.rpc("actividad_por_vendedor", {
    p_dia: dia,
  });

  const filas = (data ?? []) as Fila[];
  const seSabeDeFichas = dia >= DESDE_QUE_SE_AUDITAN_LAS_FICHAS;

  const totalDelDia = filas.reduce(
    (suma, f) =>
      suma +
      f.cuentas_creadas +
      f.cuentas_actualizadas +
      f.seguimientos_registrados +
      f.seguimientos_programados +
      f.listas_creadas +
      f.cuentas_agregadas_a_listas,
    0,
  );

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-2 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/tablero" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-marca">Actividad del día</h1>
          <p className="truncate text-xs text-texto-atenuado">
            {FECHA.format(new Date(`${dia}T12:00:00`))}
          </p>
        </div>
      </header>

      <ElegirElDia dia={dia} hoy={hoy} />

      <main className="flex flex-1 flex-col gap-4 p-4">
        {error && (
          <MensajeError
            titulo="No se pudo leer la actividad"
            detalle={error.message}
          />
        )}

        {/* **Qué mide, dicho antes de los números.** Sin esto, seis cifras en cero se leen como
            «este vendedor no trabajó», cuando lo que dicen es «este vendedor no lo capturó». La
            diferencia decide si la conversación que sigue es útil o injusta. */}
        <Tarjeta className="flex flex-col gap-1">
          <p className="text-sm text-texto-secundario">
            Mide <strong className="font-medium text-texto">uso de la herramienta</strong>, no
            ventas. Un día en la calle sin capturar nada sale en cero.
          </p>
          {!seSabeDeFichas && (
            <p className="text-xs text-texto-atenuado">
              Las cuentas actualizadas sólo se saben desde el 3 de septiembre de 2026. Antes de esa
              fecha van con raya, no con cero.
            </p>
          )}
        </Tarjeta>

        {filas.length === 0 && !error && (
          <Vacio titulo="No hay vendedores activos">
            Se listan los perfiles de vendedor y de líder que estén activos.
          </Vacio>
        )}

        {filas.length > 0 && totalDelDia === 0 && (
          // NO SE ESCONDE NI SE ADORNA. Que un día entero no tenga un solo movimiento es el
          // hallazgo más importante que esta pantalla puede dar, y el que hay que ver de una.
          <Tarjeta className="border-amber-200 bg-amber-50">
            <p className="text-sm font-medium text-texto">
              Nadie tocó la herramienta este día.
            </p>
            <p className="text-xs text-texto-secundario">
              Si fue feriado o fin de semana, es lo esperado. Si fue día de calle, no.
            </p>
          </Tarjeta>
        )}

        {filas.map((f) => {
          const suyo =
            f.cuentas_creadas +
            f.cuentas_actualizadas +
            f.seguimientos_registrados +
            f.seguimientos_programados +
            f.listas_creadas +
            f.cuentas_agregadas_a_listas;

          return (
            <Tarjeta key={f.vendedor_id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                  {f.nombre}
                </p>
                {f.rol === "lider" && <Insignia tono="neutro">Líder</Insignia>}
                {suyo === 0 && <Insignia tono="aviso">Sin actividad</Insignia>}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {CIFRAS.map((c) => {
                  const noSeSabe = c.desde !== undefined && dia < c.desde;

                  return (
                    <div key={c.campo} className="flex flex-col">
                      <p
                        className={`font-mono text-2xl tabular-nums ${
                          noSeSabe
                            ? "text-texto-atenuado"
                            : f[c.campo] === 0
                              ? // EL CERO SE ATENÚA, NO SE ESCONDE. Con los seis en el mismo peso
                                // la tarjeta se vuelve ruido y no se distingue de un ojeada lo que
                                // sí pasó.
                                "text-texto-atenuado"
                              : "text-texto"
                        }`}
                      >
                        {noSeSabe ? "—" : f[c.campo]}
                      </p>
                      <p className="text-xs text-texto-secundario">{c.rotulo}</p>
                    </div>
                  );
                })}
              </div>
            </Tarjeta>
          );
        })}
      </main>
    </>
  );
}
