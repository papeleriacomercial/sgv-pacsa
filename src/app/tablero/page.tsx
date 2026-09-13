import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lunesDeEstaSemana } from "@/lib/semana";
import { cargarListasDelEquipo } from "@/lib/listas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  day: "numeric",
  month: "short",
  timeZone: "America/Panama",
});

type Perfil = { id: string; nombre: string; rol: string };

type Cierre = {
  vendedor_id: string;
  semana: string;
  numeros: Record<string, number> | null;
  necesito: string | null;
  enviado_en: string | null;
  respondido_en: string | null;
};

/** Lo que gerencia lee de un cierre de un golpe. El resto está en el contrato. */
const A_LA_VISTA: [string, string][] = [
  ["interacciones", "Interacciones"],
  ["llamadas", "Reuniones y llamadas"],
  ["cuentasTocadas", "Cuentas distintas"],
  ["diasVendibles", "Días vendibles"],
];

/**
 * El tablero del lunes. Diez minutos.
 *
 * **Cambió de oficio el 13 de septiembre de 2026, y está anotado para devolverlo** (D-068). Nació
 * como tablero de excepciones —sólo lo que se sale de lo normal— y durante el arranque es un
 * tablero de monitoreo: el usuario quiere ver cómo están usando la herramienta los tres, no sólo
 * lo que falla. Dijo para qué, que es lo que decide el diseño: *«necesito ver este monitoreo para
 * ver el desarrollo y el éxito de la aplicación»*.
 *
 * **Las excepciones se quitaron por invasivas.** Eran el corazón de la pantalla y aun así
 * sobraban: un aviso por cada cosa fuera de lo normal, de tres personas, cada lunes. Lo que queda
 * en su lugar no acusa a nadie — enseña lo que cada uno hizo y deja que gerencia saque la
 * conclusión.
 *
 * Lo que NO hace sigue igual de importante: **no tiene dónde escribirle a un vendedor.** El
 * puesto de líder existe para que gerencia no tenga tres frentes, y si el tablero ofrece la caja,
 * en un mes el vendedor escribe para gerencia. La restricción va en el producto, no en la buena
 * intención. Responder es el gesto del contrato.
 *
 * Y lo que se lee con calma vive en subpantallas —actividad, planes, negocio—, porque el plan de
 * tres personas en cinco días son quince renglones y esta pantalla se abre de pie.
 */
export default async function Tablero() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: yo } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  // Para quien no acompaña a nadie, esta pantalla no existe.
  if (yo?.rol !== "gerente") notFound();

  const lunes = lunesDeEstaSemana();

  const [{ data: gente }, { data: cierres }, listasDelEquipo] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, rol")
      .eq("activo", true)
      .is("deleted_at", null)
      .in("rol", ["vendedor", "lider"]),
    supabase
      .from("cierres")
      .select("vendedor_id, semana, numeros, necesito, enviado_en, respondido_en")
      .gte("semana", lunes)
      .is("deleted_at", null),
    // El RLS ya deja que gerencia vea las de todos; hay que pedirlo a propósito.
    cargarListasDelEquipo(),
  ]);

  const equipo = (gente ?? []) as Perfil[];
  const deLaSemana = (cierres ?? []) as Cierre[];

  const entregados = deLaSemana.filter((c) => c.enviado_en !== null);
  const respondidos = entregados.filter((c) => c.respondido_en !== null);
  const vendedores = equipo.filter((p) => p.rol === "vendedor");
  const lider = equipo.find((p) => p.rol === "lider");

  // El líder primero: es a quien gerencia lee entero y a quien le responde.
  const orden = [...equipo].sort((a, b) =>
    a.rol === b.rol
      ? a.nombre.localeCompare(b.nombre, "es")
      : a.rol === "lider"
        ? -1
        : 1,
  );

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Tablero</h1>
        <p className="font-mono text-xs text-texto-atenuado">
          Semana del {FECHA.format(new Date(`${lunes}T12:00:00`))}
        </p>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {/* **El tablero contesta preguntas de distinta velocidad, y por eso son varias pantallas y
            no una.** Ésta es la de la semana: quién cerró y qué hizo cada uno. La de actividad es
            la del día y es del arranque —¿la están usando?—. La de planes dice cómo reparten la
            semana entrante. La del negocio es la del mes y el año, y se abre cuando se quiere
            pensar, no cuando se quiere actuar. Mezclarlas haría que ninguna se mirara.

            Las que llevan a otra pantalla van arriba **porque son la pregunta con la que se
            entra**; lo de la semana se lee después, ya adentro. */}
        <Link href="/tablero/actividad" className="block">
          <Tarjeta className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-texto">Actividad del día</p>
              <p className="text-xs text-texto-secundario">
                Qué capturó cada vendedor: cuentas, seguimientos y listas
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-texto-atenuado" aria-hidden />
          </Tarjeta>
        </Link>

        <Link href="/tablero/planes" className="block">
          <Tarjeta className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-texto">
                Cómo reparten la semana
              </p>
              <p className="text-xs text-texto-secundario">
                El plan de cada quien, día por día y con sus listas
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-texto-atenuado" aria-hidden />
          </Tarjeta>
        </Link>

        <Link href="/tablero/negocio" className="block">
          <Tarjeta className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-texto">El negocio</p>
              <p className="text-xs text-texto-secundario">
                Doce meses de facturación: canal, concentración y qué se vende
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-texto-atenuado" aria-hidden />
          </Tarjeta>
        </Link>

        {/* 1. ¿Se cerró el ciclo? */}
        <Tarjeta className="flex flex-col gap-2">
          <p className="text-sm font-medium text-texto">¿Se cerró el ciclo?</p>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-texto-secundario">Cierres entregados</span>
            <span className="font-mono text-texto">
              {entregados.length} de {equipo.length}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-texto-secundario">
              Respuestas a los vendedores
            </span>
            <span className="font-mono text-texto">
              {respondidos.filter((c) => c.vendedor_id !== lider?.id).length} de{" "}
              {vendedores.length}
            </span>
          </div>
        </Tarjeta>

        {/* 2. Los cierres de la semana, los tres.

            **Antes sólo salía el del líder**, porque el diseño dice que gerencia lee al líder y el
            líder a su equipo. Durante el arranque el usuario los quiere ver todos para afinar las
            preguntas — el mismo motivo por el que el contrato ya se los muestra. Se devuelve al
            líder cuando eso termine. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Los cierres de la semana</h2>

          {orden.map((p) => {
            const c = entregados.find((x) => x.vendedor_id === p.id);

            return (
              <Tarjeta key={p.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                    {p.nombre}
                  </p>
                  {p.rol === "lider" && <Insignia tono="neutro">Líder</Insignia>}
                  {!c && <Insignia tono="aviso">Sin cerrar</Insignia>}
                </div>

                {!c ? (
                  <p className="text-sm text-texto-secundario">
                    Todavía no ha cerrado su semana.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      {A_LA_VISTA.map(([clave, rotulo]) => {
                        const v = c.numeros?.[clave];
                        return v === undefined ? null : (
                          <div
                            key={clave}
                            className="flex justify-between gap-2 text-sm"
                          >
                            <span className="text-texto-secundario">{rotulo}</span>
                            <span className="font-mono text-texto">{v}</span>
                          </div>
                        );
                      })}
                    </div>

                    {c.necesito && (
                      <div className="rounded-lg border border-borde p-3">
                        <p className="text-xs text-texto-secundario">Necesita</p>
                        <p className="text-sm text-texto">{c.necesito}</p>
                      </div>
                    )}
                  </>
                )}
              </Tarjeta>
            );
          })}

          {/* La única caja de respuesta del tablero, y va por aquí. */}
          <Link
            href="/contrato"
            className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-4 text-base font-medium text-white"
          >
            Responder los cierres
          </Link>
        </section>

        {/* 3. Las listas del equipo.
            No es un conteo —eso ya está en actividad— sino **cómo se llaman y cómo están**: una
            lista abandonada y una lista terminada dan el mismo número y son cosas distintas. Por
            eso va el nombre, el tamaño y lo que lleva sin tocarse. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Sus listas de trabajo</h2>

          {orden.map((p) => {
            const suyas = listasDelEquipo.filter((l) => l.vendedor_id === p.id);

            return (
              <Tarjeta key={p.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                    {p.nombre}
                  </p>
                  {p.rol === "lider" && <Insignia tono="neutro">Líder</Insignia>}
                  <span className="shrink-0 font-mono text-xs text-texto-secundario">
                    {suyas.length} {suyas.length === 1 ? "lista" : "listas"}
                  </span>
                </div>

                {suyas.length === 0 ? (
                  <p className="text-sm text-texto-secundario">
                    No ha armado ninguna lista.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {suyas.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-baseline justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-texto">
                          {l.nombre}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-texto-secundario">
                          {l.total} · {l.sin_tocar} sin tocar
                          {/* EN ÁMBAR LO QUE LLEVA MUCHO QUIETO: es la diferencia entre una lista
                              que se está trabajando y una que se abandonó. */}
                          {l.sin_tocar_hace_mucho > 0 && (
                            <span className="text-aviso">
                              {" "}
                              · {l.sin_tocar_hace_mucho} dormidos
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Tarjeta>
            );
          })}

          <Link
            href="/listas?equipo=1"
            className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde px-4 text-base font-medium text-texto"
          >
            Ver las listas completas
          </Link>
        </section>

        <p className="text-center text-xs text-texto-atenuado">
          Lo que pasó completo va en el informe del mes.
        </p>
      </main>
    </>
  );
}
