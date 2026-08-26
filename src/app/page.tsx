import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  Clock,
  MapPin,
  PackageOpen,
  Phone,
  Radar,
  Users,
} from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cargarSemana, hoyEnPanama, lunesDeEstaSemana } from "@/lib/semana";
import { cargarListas } from "@/lib/listas";
import {
  TIPOS_INTERACCION,
  TIPOS_SOLICITUD,
  type TipoInteraccion,
  type TipoSolicitud,
} from "@/lib/catalogos";
import { MiSemana } from "@/components/mi-semana";
import { ReprogramarCompromiso } from "@/components/reprogramar-compromiso";
import { CambiarElDia } from "@/components/cambiar-el-dia";
import { RegistrarJornada } from "@/components/registrar-jornada";
import { JornadasDeLaSemana } from "@/components/jornadas-de-la-semana";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

/** Las que exigen estar ahí. El resto se hace desde donde sea. */
const DE_CALLE: TipoInteraccion[] = ["visita", "entrega_muestra"];

type Compromiso = {
  id: string;
  cuenta_id: string;
  descripcion: string;
  fecha_compromiso: string;
  tipo_accion: TipoInteraccion;
  veces_movido: number;
  cuentas: { nombre: string } | { nombre: string }[] | null;
  oportunidades: { nombre: string } | { nombre: string }[] | null;
};

type Pendiente = {
  id: string;
  cuenta_id: string;
  tipo: TipoSolicitud;
  detalle: string;
  horas: number;
  vencida: boolean;
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(x: { nombre: string } | { nombre: string }[] | null) {
  if (!x) return null;
  return Array.isArray(x) ? (x[0]?.nombre ?? null) : x.nombre;
}

/**
 * La Agenda: la pantalla de todo el día.
 *
 * Dos pestañas. **Hoy** es donde trabaja —paradas, llamadas y lo que espera de
 * la oficina— y **Mi semana** es cómo va.
 *
 * Los tres grupos de Hoy están siempre a la vista porque el día se intercala:
 * maneja, visita, visita, se estaciona a las diez y media y hace tres llamadas.
 * **Si a esa hora tiene que cambiar de pantalla para ver a quién llamar, no
 * llama** — y por eso las llamadas están aquí aunque sean de otro pueblo. Una
 * llamada no tiene pueblo.
 */
type PorReponer = {
  id: string;
  nombre: string;
  dias_para_reponer: number;
  cadencia_observada: number;
  poblado: string | null;
};

export default async function Agenda({ searchParams }: PageProps<"/">) {
  const { vista } = await searchParams;
  const enSemana = vista === "semana";

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const hoy = hoyEnPanama();

  const lunes = lunesDeEstaSemana();

  const [
    { data: perfil },
    { data: comps },
    { data: pend },
    { data: cierre },
    { data: anterior },
    semana,
    listas,
    { data: reponer },
  ] = await Promise.all([
      supabase
        .from("perfiles")
        .select("nombre, rol")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("compromisos")
        .select(
          "id, cuenta_id, descripcion, fecha_compromiso, tipo_accion, veces_movido, cuentas(nombre), oportunidades(nombre)",
        )
        // **Lo mío, no lo que puedo ver.** El RLS deja al líder ver el
        // trabajo de su equipo, y sin este filtro su agenda se llenaba de
        // las paradas de Albert y de Javier. Son dos preguntas distintas:
        // qué me toca hoy, y cómo va el equipo. La segunda no es esta
        // pantalla.
        .eq("vendedor_id", user.id)
        .is("deleted_at", null)
        .is("cumplido_en", null)
        .lte("fecha_compromiso", hoy)
        .order("fecha_compromiso", { ascending: true }),
      supabase
        .from("solicitudes_resumen")
        .select("id, cuenta_id, tipo, detalle, horas, vencida, cuentas(nombre)")
        .eq("vendedor_id", user.id)
        .eq("estado", "pendiente")
        .order("created_at", { ascending: true }),
      supabase
        .from("cierres")
        .select("enviado_en")
        .eq("vendedor_id", user.id)
        .eq("semana", lunes)
        .maybeSingle(),
      // El de la semana pasada trae la apuesta contra la que se reconcilia.
      supabase
        .from("cierres")
        .select("apuesta_potenciales, apuesta_clientes, respuesta, respondido_en")
        .eq("vendedor_id", user.id)
        .lt("semana", lunes)
        .order("semana", { ascending: false })
        .limit(1)
        .maybeSingle(),
      cargarSemana(user.id),
      cargarListas(user.id),
      // **El aviso que llega antes** (§7.7). No es «dejó de comprar»,
      // que es el diagnóstico tardío: cuando ese aviso salta, el cliente
      // ya se quedó sin producto — y quien se queda sin producto ya le
      // compró a otro.
      //
      // Solo mira hacia adelante, de cero a siete días. Los que ya se
      // quedaron sin nada no son trabajo de hoy: son recuperación, y se
      // trabajan desde Cuentas con su filtro.
      supabase
        .from("cuentas_resumen")
        .select("id, nombre, dias_para_reponer, cadencia_observada, poblado")
        .eq("vendedor_id", user.id)
        .eq("tipo", "cliente")
        .gte("dias_para_reponer", 0)
        .lte("dias_para_reponer", 7)
        .order("dias_para_reponer", { ascending: true }),
    ]);

  const compromisos = (comps ?? []) as unknown as Compromiso[];
  const paradas = compromisos.filter((c) => DE_CALLE.includes(c.tipo_accion));
  const escritorio = compromisos.filter(
    (c) => !DE_CALLE.includes(c.tipo_accion),
  );
  const esperando = (pend ?? []) as unknown as Pendiente[];
  const conPotenciales = listas.filter((l) => l.sin_tocar > 0);
  const porReponer = (reponer ?? []) as PorReponer[];

  function Renglon({ c }: { c: Compromiso }) {
    const vencido = c.fecha_compromiso < hoy;
    const venta = nombreDe(c.oportunidades);

    return (
      <Tarjeta
        className={`flex flex-col gap-2 ${vencido ? "border-red-200 bg-red-50" : ""}`}
      >
        {/* El enlace envuelve solo el contenido: reprogramar es otra acción y
            no puede quedar dentro del área que abre el seguimiento. */}
        <Link
          href={`/cuentas/${c.cuenta_id}/seguimiento?compromiso=${c.id}`}
          className="flex flex-col gap-1"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-semibold text-texto">
              {nombreDe(c.cuentas) ?? "Cuenta"}
            </p>
            <Insignia tono={vencido ? "error" : "info"}>
              {vencido
                ? FECHA.format(new Date(`${c.fecha_compromiso}T12:00:00`))
                : "Hoy"}
            </Insignia>
          </div>

          <p className="text-sm text-texto-secundario">{c.descripcion}</p>

          {/* Cada renglón dice a qué venta sirve. "Banco Aliado" a secas no
              distingue si es por los rollos o por las bolsas. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Insignia tono="neutro">
              {TIPOS_INTERACCION[c.tipo_accion]}
            </Insignia>
            {venta && <Insignia tono="info">{venta}</Insignia>}
          </div>
        </Link>

        <ReprogramarCompromiso id={c.id} vecesMovido={c.veces_movido} />
      </Tarjeta>
    );
  }

  return (
    <>
      <AvisoSinConexion />

      {/* Ni el nombre ni el botón de salir: los dos viven arriba, en la barra
          de marca, y estaban repetidos aquí. */}
      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Agenda</h1>
      </header>

      {/* Dos vistas de lo mismo. La de todos los días va primero. */}
      <div className="grid grid-cols-2 border-b border-borde bg-superficie">
        {(
          [
            ["/", "Hoy", !enSemana],
            ["/?vista=semana", "Mi semana", enSemana],
          ] as const
        ).map(([href, etiqueta, activa]) => (
          <Link
            key={etiqueta}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={`min-h-tactil flex items-center justify-center border-b-2 text-sm ${
              activa
                ? "border-b-marca font-medium text-marca"
                : "border-b-transparent text-texto-atenuado"
            }`}
          >
            {etiqueta}
          </Link>
        ))}
      </div>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {enSemana ? (
          <>
            {/* La respuesta de quien lo acompaña, primero: es lo que arranca la
                semana con dirección en vez de con una lista. */}
            {anterior?.respuesta && (
              <Tarjeta className="flex flex-col gap-1">
                <p className="text-xs text-texto-secundario">
                  Respuesta a tu semana pasada
                </p>
                <p className="text-sm text-texto">{anterior.respuesta}</p>
              </Tarjeta>
            )}

            {/* La reconciliación. Nadie la calcula: sale sola, y es lo que
                convierte el plan en algo real en vez de un deseo. */}
            {anterior?.apuesta_potenciales !== null &&
              anterior?.apuesta_potenciales !== undefined && (
                <Tarjeta className="flex flex-col gap-1">
                  <p className="text-xs text-texto-secundario">
                    Lo que apostaste la semana pasada
                  </p>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-texto-secundario">Potenciales</span>
                    <span className="font-mono text-texto">
                      dijiste {anterior.apuesta_potenciales} · tocaste{" "}
                      {semana.cuentasTocadas}
                    </span>
                  </div>
                  {anterior.apuesta_clientes !== null && (
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-texto-secundario">Clientes</span>
                      <span className="font-mono text-texto">
                        dijiste {anterior.apuesta_clientes} · al día{" "}
                        {semana.enCadencia}
                      </span>
                    </div>
                  )}
                </Tarjeta>
              )}

            <MiSemana semana={semana} />
            <JornadasDeLaSemana />
            {/* La jornada se registra al cerrar el día. Si cuesta encontrarla,
                no se llena — y es la coartada del vendedor. */}
            <RegistrarJornada />

            {/* El cierre es un formulario, no una pantalla: se usa una vez a la
                semana y no se gana un lugar en la barra. */}
            <Link
              href="/cierre"
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-4 text-base font-medium text-white"
            >
              <ClipboardCheck size={18} aria-hidden />
              {cierre?.enviado_en ? "Ajustar mi cierre" : "Cerrar la semana"}
            </Link>

            {/* El otro lado del contrato. Solo aparece para quien acompaña a
                alguien: el líder y gerencia. */}
            {(perfil?.rol === "lider" || perfil?.rol === "gerente") && (
              <>
                <Link
                  href="/contrato"
                  className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-4 text-base font-medium text-texto"
                >
                  <Users size={18} aria-hidden />
                  Responder a mi equipo
                </Link>
                {/* Se mira una vez al mes: no se gana un lugar en la barra. */}
                <Link
                  href="/mercado"
                  className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-4 text-base font-medium text-texto"
                >
                  <Radar size={18} aria-hidden />
                  Qué dice el mercado
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            {compromisos.length === 0 &&
              esperando.length === 0 &&
              porReponer.length === 0 && (
              <Tarjeta>
                <Vacio titulo="Nada pendiente para hoy">
                  Lo que prometas al registrar un seguimiento aparece aquí con su
                  fecha. Mientras tanto, tus listas tienen puntos por trabajar.
                </Vacio>
              </Tarjeta>
            )}

            {paradas.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-marca" aria-hidden />
                  <h2 className="text-sm font-medium text-texto">Paradas</h2>
                  <Insignia tono="neutro">{String(paradas.length)}</Insignia>
                </div>
                {paradas.map((c) => (
                  <Renglon key={c.id} c={c} />
                ))}

                {/* Cuando el día se cae, mover cinco paradas una por una es la
                    fricción que hace que no se muevan — y la agenda queda llena
                    de vencidos falsos. */}
                <CambiarElDia
                  ids={paradas.map((c) => c.id)}
                  cuantos={paradas.length}
                />
              </section>
            )}

            {/* Aquí aunque sean de otro pueblo: una llamada no tiene pueblo, y
                se hacen a media mañana cuando la gente contesta. */}
            {escritorio.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-marca" aria-hidden />
                  <h2 className="text-sm font-medium text-texto">
                    Llamadas y correos
                  </h2>
                  <Insignia tono="neutro">{String(escritorio.length)}</Insignia>
                </div>
                {escritorio.map((c) => (
                  <Renglon key={c.id} c={c} />
                ))}
              </section>
            )}

            {esperando.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-marca" aria-hidden />
                  <h2 className="text-sm font-medium text-texto">
                    Esperando respuesta
                  </h2>
                  <Insignia tono="neutro">{String(esperando.length)}</Insignia>
                </div>
                {esperando.map((s) => (
                  <Link key={s.id} href="/solicitudes">
                    <Tarjeta
                      className={`flex flex-col gap-1 ${s.vencida ? "border-red-200 bg-red-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-base font-semibold text-texto">
                          {nombreDe(s.cuentas) ?? "Cuenta"}
                        </p>
                        <span
                          className={`shrink-0 font-mono text-xs ${s.vencida ? "text-error" : "text-texto-atenuado"}`}
                        >
                          {Math.floor(s.horas)} h
                        </span>
                      </div>
                      <p className="text-sm text-texto-secundario">
                        {TIPOS_SOLICITUD[s.tipo]} · {s.detalle}
                      </p>
                    </Tarjeta>
                  </Link>
                ))}
              </section>
            )}

            {porReponer.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <PackageOpen size={16} className="text-marca" aria-hidden />
                  <h2 className="text-sm font-medium text-texto">
                    Se les acaba el producto
                  </h2>
                  <Insignia tono="neutro">{String(porReponer.length)}</Insignia>
                </div>
                <p className="text-xs text-texto-atenuado">
                  Según su propio ritmo de compra. Todavía se llega antes que
                  el de al lado.
                </p>

                {porReponer.map((c) => (
                  <Link key={c.id} href={`/cuentas/${c.id}`}>
                    <Tarjeta className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-texto">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-texto-secundario">
                          Compra cada {c.cadencia_observada} días
                          {c.poblado && ` · ${c.poblado}`}
                        </p>
                      </div>
                      {/* Ámbar y no rojo: todavía no pasó nada malo. El rojo
                          de esta pantalla está reservado para lo vencido. */}
                      <Insignia tono={c.dias_para_reponer <= 2 ? "aviso" : "neutro"}>
                        {c.dias_para_reponer === 0
                          ? "Hoy"
                          : c.dias_para_reponer === 1
                            ? "Mañana"
                            : `En ${c.dias_para_reponer} días`}
                      </Insignia>
                    </Tarjeta>
                  </Link>
                ))}

                {/* Los que ya se quedaron sin nada son otro trabajo —
                    recuperar, no reponer— y por eso están apuntados y no
                    metidos aquí: llenarían la agenda de gente que se fue
                    hace medio año. */}
                <Link
                  href="/cuentas?reponer=0"
                  className="min-h-tactil flex items-center text-sm text-texto-secundario"
                >
                  Ver a los que ya se quedaron sin producto
                </Link>
              </section>
            )}

            {conPotenciales.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-texto">Tus listas</h2>
                {conPotenciales.slice(0, 4).map((l) => (
                  <Link key={l.id} href={`/listas/${l.id}`}>
                    <Tarjeta className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-texto">
                        {l.nombre}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-texto-secundario">
                        {l.sin_tocar} sin tocar
                      </span>
                    </Tarjeta>
                  </Link>
                ))}
              </section>
            )}

            <Link
              href="/seguimientos"
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
            >
              <CalendarClock size={16} aria-hidden />
              Ver toda la agenda
            </Link>
          </>
        )}
      </main>
    </>
  );
}
