import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  MOTIVOS_COMPETENCIA,
  type MotivoCompetencia,
} from "@/lib/catalogos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

type Fila = {
  proveedor_actual: string | null;
  motivos_competencia: MotivoCompetencia[] | null;
  precio_referencia: string | number | null;
  cuentas: { poblado: string | null; tipo_comercio: string | null } | null;
};

/** Cuenta cuántas veces aparece cada clave y devuelve el conteo ordenado. */
function contar<T extends string>(valores: T[]): [T, number][] {
  const mapa = new Map<T, number>();
  for (const v of valores) mapa.set(v, (mapa.get(v) ?? 0) + 1);
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

function Barra({
  etiqueta,
  cuantos,
  total,
}: {
  etiqueta: string;
  cuantos: number;
  total: number;
}) {
  const porcentaje = Math.round((cuantos / total) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-texto">{etiqueta}</span>
        <span className="shrink-0 font-mono text-texto-secundario">
          {porcentaje}% · {cuantos}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fondo">
        <div
          className="h-full rounded-full bg-marca"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Qué dice el mercado que no compra.
 *
 * Es la pantalla que hace que valga la pena capturar la ficha de competencia.
 * **Sin ella, el vendedor levanta el dato durante tres meses, nunca ve que
 * movió nada, y deja de levantarlo — y hace bien.** La inteligencia que nadie
 * usa no es neutral: mata el hábito de capturarla.
 *
 * Y lo que sale de aquí no es un hallazgo sobre el vendedor: si el 60% de los
 * rechazos en Aguadulce dice "le compra a su paisano", **eso es una decisión de
 * canal y la toma gerencia**. Capturar bien el rechazo da la estrategia y
 * defiende al vendedor en el mismo gesto.
 */
export default async function Mercado() {
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

  if (yo?.rol !== "gerente" && yo?.rol !== "lider") notFound();

  // Qué filas llegan lo decide el RLS: el líder ve las de su equipo.
  const { data } = await supabase
    .from("seguimientos")
    .select(
      "proveedor_actual, motivos_competencia, precio_referencia, cuentas(poblado, tipo_comercio)",
    )
    .not("motivos_competencia", "eq", "{}")
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .limit(2000);

  const filas = (data ?? []) as unknown as Fila[];

  const motivos = contar(filas.flatMap((f) => f.motivos_competencia ?? []));
  const competidores = contar(
    filas
      .map((f) => f.proveedor_actual?.trim())
      .filter((x): x is string => !!x),
  );
  const poblados = contar(
    filas
      .map((f) => f.cuentas?.poblado?.trim())
      .filter((x): x is string => !!x),
  );
  const categorias = contar(
    filas
      .map((f) => f.cuentas?.tipo_comercio?.trim())
      .filter((x): x is string => !!x),
  );

  const precios = filas
    .map((f) => (f.precio_referencia === null ? null : Number(f.precio_referencia)))
    .filter((x): x is number => x !== null && x > 0);

  const precioMedio =
    precios.length > 0
      ? precios.reduce((s, p) => s + p, 0) / precios.length
      : null;

  const total = filas.length;

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Mercado</h1>
        <p className="text-xs text-texto-atenuado">
          {total} {total === 1 ? "rechazo" : "rechazos"} con motivo
        </p>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {total === 0 ? (
          <Tarjeta>
            <Vacio titulo="Todavía no hay nada que leer">
              Cada vez que un comercio dice que le compra a otro, el vendedor
              anota quién y por qué. En unas semanas esto va a decir a qué precio
              sí compran y quién domina cada zona.
            </Vacio>
          </Tarjeta>
        ) : (
          <>
            <Tarjeta className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-texto">
                  Por qué le compran al otro
                </p>
                <p className="text-xs text-texto-secundario">
                  Si esto dice crédito y no precio, bajar el precio no gana
                  nada.
                </p>
              </div>
              {motivos.map(([m, n]) => (
                <Barra
                  key={m}
                  etiqueta={MOTIVOS_COMPETENCIA[m]}
                  cuantos={n}
                  total={total}
                />
              ))}
            </Tarjeta>

            {competidores.length > 0 && (
              <Tarjeta className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium text-texto">
                    Quiénes nos ganan
                  </p>
                  <p className="text-xs text-texto-secundario">
                    Sale del catálogo compartido. Sobre texto libre esto no se
                    podría sumar.
                  </p>
                </div>
                {competidores.slice(0, 10).map(([c, n]) => (
                  <Barra key={c} etiqueta={c} cuantos={n} total={total} />
                ))}
              </Tarjeta>
            )}

            {precioMedio !== null && (
              <Tarjeta className="flex flex-col gap-1">
                <p className="text-sm font-medium text-texto">
                  Precio que pagan hoy
                </p>
                <p className="font-mono text-2xl text-texto">
                  {precioMedio.toFixed(2)} USD
                </p>
                <p className="text-xs text-texto-atenuado">
                  Promedio de {precios.length}{" "}
                  {precios.length === 1 ? "dato" : "datos"} que soltaron los
                  comercios.
                </p>
              </Tarjeta>
            )}

            {poblados.length > 0 && (
              <Tarjeta className="flex flex-col gap-3">
                <p className="text-sm font-medium text-texto">Dónde duele</p>
                {poblados.slice(0, 8).map(([p, n]) => (
                  <Barra key={p} etiqueta={p} cuantos={n} total={total} />
                ))}
              </Tarjeta>
            )}

            {categorias.length > 0 && (
              <Tarjeta className="flex flex-col gap-3">
                <p className="text-sm font-medium text-texto">
                  En qué tipo de comercio
                </p>
                {categorias.slice(0, 8).map(([c, n]) => (
                  <Barra key={c} etiqueta={c} cuantos={n} total={total} />
                ))}
              </Tarjeta>
            )}

            {/* El compromiso que sostiene la captura: una decisión por
                trimestre, anunciada diciendo de dónde salió. */}
            <Tarjeta className="border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800">
                Si esto no termina en una decisión anunciada al equipo —
                <em>“revisamos los rechazos, el 41% es crédito, probamos 30
                días en Coclé”</em>— van a dejar de capturarlo. Y van a hacer
                bien.
              </p>
            </Tarjeta>
          </>
        )}
      </main>
    </>
  );
}
