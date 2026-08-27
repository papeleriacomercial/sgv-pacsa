import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Layers, MapPinned, Search } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  CLASES_VENTA,
  TIPOS_LISTA,
  type ClaseVenta,
  type TipoCuenta,
  type TipoLista,
} from "@/lib/catalogos";
import { AgregarObjetivo } from "@/components/agregar-objetivo";
import { FichaPunto } from "@/components/ficha-punto";
import { QuitarDeLista } from "@/components/quitar-de-lista";
import { ArchivarLista } from "@/components/archivar-lista";
import { diasDesde } from "@/lib/fechas";
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
    direccion: string | null;
    contacto_nombre: string | null;
    contacto_telefono: string | null;
    contacto_correo: string | null;
  } | null;
};

/**
 * Qué le falta averiguar a un objetivo antes de poder ir por él.
 *
 * Se escribe en la tarjeta en vez de la zona: un objetivo no tiene zona
 * —no está en el mapa— y en cambio sí tiene deberes. Al llenarse todos, la
 * línea desaparece sola y eso es la señal de que ya se puede llamar.
 */
function queFalta(c: NonNullable<Miembro["cuentas"]>): string | null {
  const huecos = [
    !c.contacto_nombre && "contacto",
    !c.contacto_telefono && "teléfono",
    !c.contacto_correo && "correo",
    !c.direccion && "dirección",
  ].filter(Boolean) as string[];

  if (huecos.length === 0) return null;
  if (huecos.length === 4) return "Solo tienes el nombre";
  return `Falta ${huecos.join(", ")}`;
}

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
    .select("id, nombre, tipo, clase, poblado, archivada, vendedor_id, total, sin_tocar, trabajadas, sin_tocar_hace_mucho, sin_tocar_potenciales, sin_tocar_clientes")
    .eq("id", id)
    .maybeSingle();

  // Si el RLS no la deja ver, para este usuario no existe.
  if (!lista) notFound();

  // **Poder ver una lista no la hace tuya.** El líder abre las de su equipo
  // para saber cómo va, y no tiene por qué poder desarmarle la ruta a nadie.
  const esMia = lista.vendedor_id === user.id;

  const { data: filas } = await supabase
    .from("listas_cuentas")
    .select(
      "cuenta_id, agregada_en, cuentas(id, nombre, tipo, tipo_comercio, poblado, direccion, contacto_nombre, contacto_telefono, contacto_correo)",
    )
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

  /**
   * **Trabajada desde que entró a la lista**, no desde siempre.
   *
   * Con potenciales daba igual —no tienen pasado—, pero desde que la lista
   * también lleva clientes por venta cruzada sí importa: un cliente entra
   * con años de visitas encima y quedaría marcado como hecho antes de que
   * nadie lo visite. Es la misma regla que cuenta `listas_resumen`, y las
   * dos tienen que decir lo mismo o la lista y el plan se contradicen.
   */
  function trabajadaYa(m: Miembro): boolean {
    const ultima = ultimaPorCuenta.get(m.cuenta_id);
    if (!ultima) return false;
    // En hora de Panamá, no en UTC: una cuenta agregada a las ocho de la
    // noche y visitada al día siguiente tiene que contar (D-021).
    const entro = new Date(m.agregada_en).toLocaleDateString("en-CA", {
      timeZone: "America/Panama",
    });
    return ultima >= entro;
  }

  const sinTocar = miembros.filter((m) => !trabajadaYa(m));
  const trabajadas = miembros.filter(trabajadaYa);

  // **Dos oficios, dos herramientas.** Una lista de zona se llena buscando en
  // el mapa: el vendedor no sabe qué hay en Aguadulce hasta que mira. Una de
  // objetivos se llena escribiendo: el líder ya sabe que va por Banco General,
  // lo que no sabe es con quién hablar. Ofrecerle la búsqueda le devolvía
  // sucursales, que es justo lo que no quiere.
  const esObjetivo = lista.tipo === "objetivo";

  // A Buscar y no al mapa de la cartera: el mapa muestra lo que ya es suyo, y
  // aquí lo que hace falta es encontrar puntos que todavía no lo son.
  const destinoBusqueda = lista.poblado
    ? `/buscar?lista=${id}&q=${encodeURIComponent(lista.poblado)}`
    : `/buscar?lista=${id}`;

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

        {esObjetivo ? (
          <AgregarObjetivo
            listaId={id}
            ejemplo={
              lista.clase === "grande"
                ? "Banco General"
                : "Do It Center"
            }
          />
        ) : (
          <>
            {/* Agregar puntos abre el mapa con la lista preseleccionada,
                centrado en su poblado. El semáforo de la búsqueda evita
                reescoger lo que ya es suyo, lo que descartó o lo que es de
                un compañero. */}
            <Link
              href={destinoBusqueda}
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-3 text-base font-medium text-white"
            >
              <Search size={18} aria-hidden />
              Buscar puntos para esta lista
            </Link>

            {/* **La otra mitad de la ruta.** Buscar puntos trae lo que
                todavía no es suyo; esto trae lo que ya lo es y le falta
                comprar algo. El vendedor camina Aguadulce una sola vez y
                en el camino hace las dos cosas. */}
            <Link
              href={`/listas/${id}/cruzada`}
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
            >
              <Layers size={16} aria-hidden />
              Agregar clientes por cruzar
            </Link>

            {/* El mapa de la cartera, para ver dónde caen los que ya tiene. */}
            <Link
              href={`/mapa?lista=${id}&incluirPotenciales=1`}
              className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
            >
              <MapPinned size={16} aria-hidden />
              Ver esta lista en el mapa
            </Link>
          </>
        )}

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
              {esObjetivo
                ? "Escribe el primero con el botón de arriba. Basta el nombre: lo demás lo vas averiguando."
                : "Agrégale puntos desde el mapa o desde la búsqueda. Los que escojas quedan aquí hasta que los trabajes."}
            </Vacio>
          </Tarjeta>
        )}

        {sinTocar.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-texto">
                Sin tocar · {sinTocar.length}
                {/* Cazar y cuidar se cuentan aparte: el compromiso de la
                    semana apuesta por separado, y un solo número dejaría al
                    vendedor sin saber de qué está prometiendo. */}
                {lista.sin_tocar_clientes > 0 && (
                  <span className="ml-1.5 font-normal text-texto-atenuado">
                    ({lista.sin_tocar_potenciales} por abrir ·{" "}
                    {lista.sin_tocar_clientes} por cruzar)
                  </span>
                )}
              </h2>
              {/* La misma cifra que cuenta `listas_resumen`, dicha donde se
                  puede hacer algo con ella. Los más viejos salen primero
                  porque la consulta ordena por fecha de entrada. */}
              {lista.sin_tocar_hace_mucho > 0 && (
                <span className="text-xs font-medium text-aviso">
                  {lista.sin_tocar_hace_mucho} llevan más de dos meses
                </span>
              )}
            </div>
            {/* La equis solo va en los que no se han trabajado. Sacar de la
                ruta algo que ya se visitó no tendría sentido: la visita
                ocurrió y queda en la bitácora igual. */}
            {sinTocar.map((m) =>
              m.cuentas ? (
                <div key={m.cuenta_id} className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <FichaPunto
                      id={m.cuentas.id}
                      nombre={m.cuentas.nombre}
                      tipoComercio={m.cuentas.tipo_comercio}
                      tipo={m.cuentas.tipo}
                      zona={m.cuentas.poblado}
                      falta={esObjetivo ? queFalta(m.cuentas) : null}
                      ultimaInteraccion={null}
                      esperaDias={diasDesde(m.agregada_en)}
                    />
                  </div>
                  {esMia && (
                    <QuitarDeLista
                      listaId={id}
                      cuentaId={m.cuenta_id}
                      nombre={m.cuentas.nombre}
                    />
                  )}
                </div>
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
                    zona={m.cuentas.poblado}
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

        {/* Al final y en letra pequeña: retirar una lista es raro, y una
            acción rara arriba y en grande se toca por error. */}
        {esMia && (
          <ArchivarLista
            listaId={id}
            nombre={lista.nombre}
            vacia={lista.total === 0}
          />
        )}
      </main>
    </>
  );
}
