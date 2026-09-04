import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lunesDeEstaSemana } from "@/lib/semana";
import { Tarjeta } from "@/components/ui/tarjeta";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { ExcepcionesDelTablero } from "@/components/excepciones-del-tablero";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  day: "numeric",
  month: "short",
  timeZone: "America/Panama",
});

/** Cuándo un renglón deja de ser normal y entra a excepciones. */
const UMBRAL_VERIFICADAS = 0.7;

type Perfil = { id: string; nombre: string; rol: string };

type Cierre = {
  vendedor_id: string;
  semana: string;
  numeros: Record<string, number> | null;
  necesito: string | null;
  enviado_en: string | null;
  respondido_en: string | null;
};

type Excepcion = {
  quien: string;
  que: string;
  detalle: string;
  /**
   * Lo que identifica a ESTE aviso, para poder silenciarlo.
   *
   * **Cada tipo elige la suya con criterio propio, y ahí está toda la decisión:
   * el aviso vuelve cuando la clave cambia.** La del cierre lleva la semana —la
   * que se silencia hoy reaparece el lunes que viene—; la de compromisos
   * vencidos lleva el número, así que pasar de 5 a 8 es un aviso distinto; y la
   * de una solicitud sin contestar lleva su identificador y **no sus horas,
   * porque las horas crecen solas y reaparecería cada hora**.
   */
  clave: string;
};

/**
 * El tablero del lunes. Diez minutos.
 *
 * Tres cosas y ninguna más: **¿se cerró el ciclo?**, **las excepciones**, y el
 * cierre del líder — que es el único que gerencia lee completo.
 *
 * Lo que no hace es tan importante como lo que hace. **No tiene dónde
 * escribirle a un vendedor**: el puesto de líder existe para que gerencia no
 * tenga tres frentes, y si el tablero ofrece la caja, la tentación existe y en
 * un mes el vendedor escribe para gerencia. La restricción va en el producto,
 * no en la buena intención.
 *
 * Y muestra **excepciones, no todo**. Cada número del sistema podría caber aquí
 * — y un tablero que lo muestra todo tarda cuarenta minutos y deja de abrirse.
 * Lo que pasó completo va en el informe del mes, que se lee con calma.
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

  const [{ data: gente }, { data: cierres }, { data: solicitudes }] =
    await Promise.all([
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
      supabase
        .from("solicitudes_resumen")
        .select("id, vendedor_id, detalle, horas")
        .eq("estado", "pendiente")
        .eq("vencida", true),
    ]);

  const equipo = (gente ?? []) as Perfil[];
  const deLaSemana = (cierres ?? []) as Cierre[];
  const vencidas = (solicitudes ?? []) as {
    id: string;
    vendedor_id: string;
    detalle: string;
    horas: number;
  }[];

  const nombreDe = (id: string) =>
    equipo.find((p) => p.id === id)?.nombre ?? "Alguien";

  const entregados = deLaSemana.filter((c) => c.enviado_en !== null);
  const respondidos = entregados.filter((c) => c.respondido_en !== null);
  const vendedores = equipo.filter((p) => p.rol === "vendedor");
  const lider = equipo.find((p) => p.rol === "lider");
  const cierreDelLider = lider
    ? entregados.find((c) => c.vendedor_id === lider.id)
    : undefined;

  // ---- Las excepciones -----------------------------------------------------
  const excepciones: Excepcion[] = [];

  for (const p of equipo) {
    const c = entregados.find((x) => x.vendedor_id === p.id);

    if (!c) {
      excepciones.push({
        quien: p.nombre,
        que: "No ha cerrado la semana",
        detalle: "Sin cierre entregado.",
        // Con la semana adentro: silenciarlo hoy no debe taparlo el lunes que viene.
        clave: `${lunes}|${p.id}|sin-cierre`,
      });
      continue;
    }

    const n = c.numeros ?? {};

    // La única cifra difícil de inflar. Si cae, es el renglón por el que hay
    // que preguntar — sin acusar a nadie: la explicación suele ser legítima.
    if (n.visitas > 0 && n.verificadas / n.visitas < UMBRAL_VERIFICADAS) {
      excepciones.push({
        quien: p.nombre,
        que: `${Math.round((n.verificadas / n.visitas) * 100)}% de visitas verificadas`,
        detalle: "Vale la pena preguntar qué pasó esa semana.",
        // Con el porcentaje: si empeora, es otro aviso y tiene que volver.
        clave: `${lunes}|${p.id}|verificadas|${Math.round((n.verificadas / n.visitas) * 100)}`,
      });
    }

    if (n.compromisosVencidos >= 5) {
      excepciones.push({
        quien: p.nombre,
        que: `${n.compromisosVencidos} compromisos vencidos`,
        detalle: "O se mueven, o las cuentas se están apagando.",
        // Con el número: de 5 a 8 es un aviso distinto, y silenciar el de 5 no puede taparlo.
        clave: `${lunes}|${p.id}|compromisos|${n.compromisosVencidos}`,
      });
    }

    // Lo que pidió y nadie le contestó. Es la mitad del contrato.
    if (c.necesito && c.respondido_en === null) {
      excepciones.push({
        quien: p.nombre,
        que: "Pidió algo y no tiene respuesta",
        detalle: c.necesito,
        // Lo que pidió, no la semana: si pide otra cosa es otro aviso. Y si alguien le contesta,
        // la excepción desaparece sola sin que nadie la silencie.
        clave: `${p.id}|necesito|${c.necesito}`,
      });
    }
  }

  for (const s of vencidas) {
    excepciones.push({
      quien: nombreDe(s.vendedor_id),
      que: `Solicitud sin contestar hace ${Math.floor(s.horas)} h`,
      detalle: s.detalle,
      // EL IDENTIFICADOR, NO LAS HORAS. Las horas crecen solas, así que una clave con ellas haría
      // reaparecer el aviso cada hora y silenciarlo no serviría de nada. Con el identificador se
      // silencia esa solicitud, y desaparece de verdad cuando alguien la contesta.
      clave: `solicitud|${s.id}`,
    });
  }

  // Lo que este usuario ya leyó y calló. VA DESPUÉS DE ARMARLAS TODAS: se consulta sólo por las
  // claves que hoy están en pantalla, en vez de traer meses de avisos que ya no existen. Y por eso
  // tiene que ir aquí abajo — puesto antes, se habría saltado las solicitudes vencidas.
  const { data: calladas } = excepciones.length
    ? await supabase
        .from("excepciones_silenciadas")
        .select("clave")
        .eq("silenciada_por", user.id)
        .in(
          "clave",
          excepciones.map((e) => e.clave),
        )
    : // Sin excepciones no hay nada que preguntar, y `in.()` con la lista vacía no es una consulta
      // que devuelve cero: es una consulta que falla.
      { data: [] };

  const silenciadas = ((calladas ?? []) as { clave: string }[]).map((c) => c.clave);

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
        {/* **El tablero contesta preguntas de distinta velocidad, y por eso son tres pantallas y
            no una.** Ésta es la de la semana: quién cerró, qué se salió de lo normal, a quién
            falta responderle. La de actividad es la del día y es del arranque —¿la están
            usando?—. La del negocio es la del mes y el año, y se abre cuando se quiere pensar, no
            cuando se quiere actuar. Mezclarlas haría que ninguna de las tres se mirara.

            Las dos que llevan a otra pantalla van arriba **porque son la pregunta con la que se
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

        {/* 2. Las excepciones. Casi siempre corto: por eso sirve.

            AHORA SE PUEDEN CALLAR, y la pieza vive aparte porque necesita ser del navegador: la ✕
            escribe. Lo que NO cambia es que se recalculan cada vez — silenciar guarda que ya se
            leyeron, no las borra, porque no hay nada que borrar. */}
        <ExcepcionesDelTablero excepciones={excepciones} silenciadas={silenciadas} />

        {/* 3. El cierre del líder, completo. Es el único que lee entero, y el
            único a quien le responde. */}
        {lider && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-texto">
              El cierre de {lider.nombre}
            </h2>

            {cierreDelLider ? (
              <>
                <Tarjeta className="flex flex-col gap-1">
                  {[
                    ["Interacciones", cierreDelLider.numeros?.interacciones],
                    ["Reuniones y llamadas", cierreDelLider.numeros?.llamadas],
                    ["Cuentas distintas", cierreDelLider.numeros?.cuentasTocadas],
                    ["Días vendibles", cierreDelLider.numeros?.diasVendibles],
                  ].map(([k, v]) =>
                    v === undefined ? null : (
                      <div
                        key={String(k)}
                        className="flex justify-between gap-2 text-sm"
                      >
                        <span className="text-texto-secundario">{k}</span>
                        <span className="font-mono text-texto">{v}</span>
                      </div>
                    ),
                  )}
                </Tarjeta>

                {cierreDelLider.necesito && (
                  <Tarjeta className="flex flex-col gap-1">
                    <p className="text-xs text-texto-secundario">Necesita</p>
                    <p className="text-sm text-texto">
                      {cierreDelLider.necesito}
                    </p>
                  </Tarjeta>
                )}
              </>
            ) : (
              <Tarjeta>
                <p className="text-sm text-texto-secundario">
                  Todavía no ha cerrado su semana.
                </p>
              </Tarjeta>
            )}

            {/* La única caja de respuesta del tablero. **Va al líder por diseño** —el puesto
                existe para que gerencia no tenga tres frentes— pero durante el arranque lleva a
                todos los cierres, porque el usuario quiere leer lo que están contestando los
                vendedores para afinar las preguntas. Se devuelve cuando eso termine. */}
            <Link
              href="/contrato"
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-4 text-base font-medium text-white"
            >
              Responder los cierres
            </Link>
            <p className="text-center text-xs text-texto-atenuado">
              El de {lider.nombre.split(" ")[0]} y, mientras arranca, los de
              los vendedores.
            </p>
          </section>
        )}

        <p className="text-center text-xs text-texto-atenuado">
          Lo que pasó completo va en el informe del mes. Esto es solo lo que
          está fuera de lo normal.
        </p>
      </main>
    </>
  );
}
