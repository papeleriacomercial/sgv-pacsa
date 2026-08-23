import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lunesDeEstaSemana } from "@/lib/semana";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

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
      });
    }

    if (n.compromisosVencidos >= 5) {
      excepciones.push({
        quien: p.nombre,
        que: `${n.compromisosVencidos} compromisos vencidos`,
        detalle: "O se mueven, o las cuentas se están apagando.",
      });
    }

    // Lo que pidió y nadie le contestó. Es la mitad del contrato.
    if (c.necesito && c.respondido_en === null) {
      excepciones.push({
        quien: p.nombre,
        que: "Pidió algo y no tiene respuesta",
        detalle: c.necesito,
      });
    }
  }

  for (const s of vencidas) {
    excepciones.push({
      quien: nombreDe(s.vendedor_id),
      que: `Solicitud sin contestar hace ${Math.floor(s.horas)} h`,
      detalle: s.detalle,
    });
  }

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

        {/* 2. Las excepciones. Casi siempre corto: por eso sirve. */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-texto">Excepciones</h2>
            <Insignia tono={excepciones.length === 0 ? "ok" : "error"}>
              {String(excepciones.length)}
            </Insignia>
          </div>

          {excepciones.length === 0 && (
            <Tarjeta className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-ok" aria-hidden />
              <p className="text-sm text-texto-secundario">
                Nada fuera de lo normal esta semana.
              </p>
            </Tarjeta>
          )}

          {excepciones.map((e, i) => (
            <Tarjeta
              key={`${e.quien}-${i}`}
              className="flex items-start gap-2 border-amber-200 bg-amber-50"
            >
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-aviso"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-texto">
                  {e.quien} · {e.que}
                </p>
                <p className="text-xs text-texto-secundario">{e.detalle}</p>
              </div>
            </Tarjeta>
          ))}
        </section>

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

            {/* La única caja de respuesta del tablero, y va al líder. */}
            <Link
              href="/contrato"
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-4 text-base font-medium text-white"
            >
              Responderle a {lider.nombre.split(" ")[0]}
            </Link>
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
