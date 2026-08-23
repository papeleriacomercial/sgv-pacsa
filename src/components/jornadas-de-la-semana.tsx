import { Truck } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  PESO_JORNADA,
  TIPOS_JORNADA,
  type DuracionJornada,
  type TipoJornada,
} from "@/lib/catalogos";
import { Tarjeta } from "@/components/ui/tarjeta";

const DIA = new Intl.DateTimeFormat("es-PA", {
  weekday: "short",
  day: "numeric",
  timeZone: "America/Panama",
});

/**
 * Devuelve el lunes de la semana en curso, en hora de Panamá.
 *
 * Se calcula en el servidor a propósito: un celular con el huso mal puesto
 * mostraría la semana equivocada, y el número que el vendedor ve tiene que ser
 * el mismo que va a ver su líder.
 */
function lunesDeEstaSemana(): string {
  const hoy = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Panama" }),
  );
  // getDay(): domingo es 0. Se corre al lunes anterior.
  const desplazamiento = (hoy.getDay() + 6) % 7;
  hoy.setDate(hoy.getDate() - desplazamiento);
  return hoy.toLocaleDateString("en-CA");
}

type Fila = {
  id: string;
  fecha: string;
  tipo: TipoJornada;
  duracion: DuracionJornada;
  desde_texto: string | null;
  hasta_texto: string | null;
};

/**
 * Lo que va de la semana en jornadas que no fueron venta.
 *
 * No es un reporte: es la devolución inmediata de lo que acaba de registrar.
 * Sin esto, el vendedor alimenta un campo y no ve nada a cambio — y la captura
 * que no devuelve nada se abandona en tres semanas.
 *
 * **Los días vendibles son la cifra que importa.** Una semana con dos
 * jornadas completas de carretera tuvo tres días de venta, no cinco, y así
 * hay que leerla. Sin eso, toda semana con logística parece un fracaso, que es
 * exactamente la injusticia que este registro existe para quitar.
 */
export async function JornadasDeLaSemana() {
  const supabase = await clienteServidor();
  const lunes = lunesDeEstaSemana();

  const { data } = await supabase
    .from("jornadas")
    .select("id, fecha, tipo, duracion, desde_texto, hasta_texto")
    .gte("fecha", lunes)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  const jornadas = (data ?? []) as Fila[];
  if (jornadas.length === 0) return null;

  const gastados = jornadas.reduce(
    (suma, j) => suma + PESO_JORNADA[j.duracion],
    0,
  );
  // Cinco días hábiles menos lo que se fue en otra cosa. Nunca por debajo de
  // cero, aunque alguien registre siete bloques en una semana.
  const vendibles = Math.max(0, 5 - gastados);

  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Truck size={18} className="mt-0.5 shrink-0 text-marca" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium text-texto">Tu semana</p>
          <p className="text-xs text-texto-secundario">
            {vendibles === 5
              ? "Sin jornadas fuera de venta todavía."
              : `${gastados} ${gastados === 1 ? "jornada" : "jornadas"} fuera de venta. Te quedan ${vendibles} días vendibles de 5.`}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {jornadas.map((j) => (
          <li
            key={j.id}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="text-texto">
              {TIPOS_JORNADA[j.tipo]}
              {j.desde_texto && j.hasta_texto && (
                <span className="text-texto-secundario">
                  {" — "}
                  {j.desde_texto} → {j.hasta_texto}
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-xs text-texto-secundario">
              {DIA.format(new Date(`${j.fecha}T12:00:00`))}
              {j.duracion === "media" ? " · ½" : " · 1"}
            </span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
