import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MapPinned } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  CLASES_VENTA,
  TIPOS_LISTA,
  type ClaseVenta,
  type TipoCuenta,
  type TipoLista,
} from "@/lib/catalogos";
import { FichaPunto } from "@/components/ficha-punto";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

type Miembro = {
  cuenta_id: string;
  agregada_en: string;
  cuentas: {
    id: string;
    nombre: string;
    tipo: TipoCuenta;
    tipo_comercio: string | null;
    poblado: string | null;
  } | null;
};

type Ultima = { cuenta_id: string; fecha: string };

/**
 * Una lista por dentro.
 *
 * Lo que no ha tocado arriba; lo trabajado abajo y atenuado, para que la lista
 * se vaya vaciando visualmente. Registrar el seguimiento es lo que la mueve —
 * no hay nada que marcar como hecho.
 */
export default async function DetalleLista({
  params,
}: PageProps<"/listas/[id]">) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: lista } = await supabase
    .from("listas_resumen")
    .select("id, nombre, tipo, clase, poblado, total, sin_tocar, trabajadas, sin_tocar_hace_mucho")
    .eq("id", id)
    .maybeSingle();

  // Si el RLS no la deja ver, para este usuario no existe.
  if (!lista) notFound();

  const { data: filas } = await supabase
    .from("listas_cuentas")
    .select("cuenta_id, agregada_en, cuentas(id, nombre, tipo, tipo_comercio, poblado)")
    .eq("lista_id", id)
    .order("agregada_en", { ascending: true });

  const miembros = (filas ?? []) as unknown as Miembro[];
  const ids = miembros.map((m) => m.cuenta_id);

  // Un solo viaje para saber cuáles ya se trabajaron. Con una consulta por
  // cuenta esto haría treinta viajes en una lista de treinta.
  const { data: seguimientos } = ids.length
    ? await supabase
        .from("seguimientos")
        .select("cuenta_id, fecha")
        .in("cuenta_id", ids)
        .is("deleted_at", null)
        .order("fecha", { ascending: false })
    : { data: [] as Ultima[] };

  const ultimaPorCuenta = new Map<string, string>();
  for (const s of (seguimientos ?? []) as Ultima[]) {
    if (!ultimaPorCuenta.has(s.cuenta_id)) {
      ultimaPorCuenta.set(s.cuenta_id, s.fecha);
    }
  }

  const sinTocar = miembros.filter((m) => !ultimaPorCuenta.has(m.cuenta_id));
  const trabajadas = miembros.filter((m) => ultimaPorCuenta.has(m.cuenta_id));

  const destinoMapa = lista.poblado
    ? `/mapa?lista=${id}&q=${encodeURIComponent(lista.poblado)}`
    : `/mapa?lista=${id}`;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/listas" />
        <h1 className="flex-1 truncate text-lg font-semibold text-marca">
          {lista.nombre}
        </h1>
        <span className="shrink-0 font-mono text-xs text-texto-secundario">
          {lista.trabajadas} / {lista.total}
        </span>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <Tarjeta className="flex flex-wrap items-center gap-2">
          <Insignia tono="neutro">{TIPOS_LISTA[lista.tipo as TipoLista]}</Insignia>
          {lista.clase && (
            <Insignia tono={lista.clase === "grande" ? "info" : "neutro"}>
              {CLASES_VENTA[lista.clase as ClaseVenta]}
            </Insignia>
          )}
          {lista.poblado && (
            <span className="text-sm text-texto-secundario">{lista.poblado}</span>
          )}
        </Tarjeta>

        {/* Agregar puntos abre el mapa con la lista preseleccionada, centrado
            en su poblado. El semáforo de la búsqueda evita reescoger lo que ya
            es suyo, lo que descartó o lo que es de un compañero. */}
        <Link
          href={destinoMapa}
          className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
        >
          <MapPinned size={16} aria-hidden />
          Agregar puntos desde el mapa
        </Link>

        {lista.sin_tocar_hace_mucho > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <p className="text-sm font-medium">
              {lista.sin_tocar_hace_mucho}{" "}
              {lista.sin_tocar_hace_mucho === 1 ? "lleva" : "llevan"} más de dos
              meses esperando
            </p>
            <p className="text-xs">
              O los trabajas, o los descartas con su motivo. Una lista que solo
              crece deja de mirarse.
            </p>
          </div>
        )}

        {miembros.length === 0 && (
          <Tarjeta>
            <Vacio titulo="La lista está vacía">
              Agrégale puntos desde el mapa o desde la búsqueda. Los que escojas
              quedan aquí hasta que los trabajes.
            </Vacio>
          </Tarjeta>
        )}

        {sinTocar.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-texto">
              Sin tocar · {sinTocar.length}
            </h2>
            {sinTocar.map((m) =>
              m.cuentas ? (
                <FichaPunto
                  key={m.cuenta_id}
                  id={m.cuentas.id}
                  nombre={m.cuentas.nombre}
                  tipoComercio={m.cuentas.tipo_comercio}
                  tipo={m.cuentas.tipo}
                  potencial={null}
                  ultimaInteraccion={null}
                />
              ) : null,
            )}
          </section>
        )}

        {trabajadas.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-texto">
              Ya trabajadas · {trabajadas.length}
            </h2>
            <div className="flex flex-col gap-2 opacity-60">
              {trabajadas.map((m) =>
                m.cuentas ? (
                  <FichaPunto
                    key={m.cuenta_id}
                    id={m.cuentas.id}
                    nombre={m.cuentas.nombre}
                    tipoComercio={m.cuentas.tipo_comercio}
                    tipo={m.cuentas.tipo}
                    potencial={null}
                    ultimaInteraccion={FECHA.format(
                      new Date(ultimaPorCuenta.get(m.cuenta_id)!),
                    )}
                  />
                ) : null,
              )}
            </div>
          </section>
        )}

        {/* Levantaste N, tocaste M. No es tasa de conversión: es calidad de
            planificación, y es otra conversación completamente. */}
        {lista.total > 0 && (
          <p className="text-center text-xs text-texto-atenuado">
            Levantaste {lista.total}, tocaste {lista.trabajadas}
          </p>
        )}
      </main>
    </>
  );
}
