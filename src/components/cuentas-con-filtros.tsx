"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { List, MapPin, Search } from "lucide-react";
import {
  aplicar,
  aUrl,
  colorizar,
  desdeUrl,
  DIMENSIONES,
  filtraPorActividad,
  type Actividad,
  type Cuenta,
  type Dimension,
  type Filtros,
} from "@/lib/filtros";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { haceDias } from "@/lib/fechas";
import { PanelFiltros } from "@/components/panel-filtros";
import { FichaPunto } from "@/components/ficha-punto";
import { Tarjeta } from "@/components/ui/tarjeta";
import { contiene } from "@/lib/texto";
import { Cargando, Vacio } from "@/components/ui/estados";

// Sigue siendo dinámico y sin render en servidor: el mapa solo existe en el
// navegador, y así su código no viaja a quien nunca abre la vista de mapa.
const MapaCuentas = dynamic(() => import("@/components/mapa-cuentas"), {
  ssr: false,
  loading: () => <Cargando texto="Cargando mapa" />,
});

/**
 * La cartera, con un solo motor de filtros y dos vistas.
 *
 * Lista y mapa son dos formas de mirar el mismo conjunto filtrado, no dos
 * pantallas distintas. Cambiar de vista no pierde los filtros: es el mismo
 * componente.
 */
export function CuentasConFiltros({
  cuentas,
  vendedores,
  vistaInicial = "lista",
  cuentaDestacada,
  mapaProtagonista = false,
  yo,
  rol,
}: {
  cuentas: Cuenta[];
  vendedores: { id: string; nombre: string }[];
  vistaInicial?: "lista" | "mapa";
  /** Se abre centrada y con su ventana desplegada. Llega desde el expediente. */
  cuentaDestacada?: string;
  /**
   * El mapa es el motivo de la pantalla, no una de dos vistas.
   *
   * En `/mapa` se entra **a mirar el territorio**: el buscador entre las propias cuentas y el
   * panel de filtros son dos renglones que le quitan al mapa casi la mitad de un teléfono. En
   * `/cuentas` es al revés —se filtra y después se mira— y ahí sí tienen que estar.
   */
  mapaProtagonista?: boolean;
  /**
   * Quién mira, para decidir si ve el filtro de movimiento.
   *
   * **Sin rol se asume que no es gerencia**, que es el lado seguro: una pantalla que no sabe
   * quién la abre no debería ofrecer el filtro de quién tocó qué.
   */
  rol?: string | null;
  /** Quién está mirando. Su cartera es la que sale por omisión. */
  yo?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();

  // El estado nace de la dirección, no de valores vacíos. Volver atrás desde
  // una cuenta devuelve exactamente la vista que se estaba mirando: sin esto,
  // corregir diez potenciales obliga a rearmar el filtro diez veces.
  // **Arranca en lo mío.** Con tres carteras mezcladas, entrar a Cuentas y
  // ver 525 fichas de todo el mundo no le sirve a nadie: lo primero que se
  // busca es lo propio.
  //
  // Solo cuando la dirección viene limpia. Si trae cualquier parámetro es
  // que alguien ya tocó los filtros —o quitó este a propósito— y volver a
  // ponerlo sería pelearse con el usuario.
  // **El filtro de movimiento es de gerencia y de nadie más** — decisión del usuario, 13 de
  // septiembre de 2026. Contesta «qué tocó cada quien y cuándo», que es una pregunta de quien
  // acompaña al equipo, no de quien vende. El líder tampoco: para mirar a los suyos tiene el
  // tablero y el contrato.
  const esGerencia = rol === "gerente";

  const [filtros, setFiltros] = useState<Filtros>(() => {
    const desde = desdeUrl(parametros);

    // **Se limpia de la dirección, no sólo de la pantalla.** Esconder el control y dejar que
    // `?desde=…&hasta=…` siguiera funcionando sería una cortina, no una restricción: bastaría
    // con que alguien copiara un enlace de gerencia.
    const base = esGerencia
      ? desde
      : {
          ...desde,
          actividadDesde: null,
          actividadHasta: null,
          clasesActividad: [],
        };

    const limpia = parametros.toString() === "";
    if (limpia && yo && vendedores.length > 1) {
      return { ...base, vendedores: [yo] };
    }
    return base;
  });
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"lista" | "mapa">(
    (parametros.get("vista") as "lista" | "mapa") ?? vistaInicial,
  );
  const [dimension, setDimension] = useState<Dimension>(
    (parametros.get("color") as Dimension) ?? "tipo",
  );

  // Los parámetros que no son filtros los pone la pantalla al entrar y ya no
  // cambian. Se leen una sola vez: si el efecto dependiera del objeto de
  // parámetros, cada `replace` lo volvería a disparar en ciclo.
  const fijos = useRef(parametros);

  // `replace` y no `push`: cada toque de filtro no debe dejar una entrada en el
  // historial, o el botón de atrás tardaría veinte toques en salir.
  useEffect(() => {
    const consulta = aUrl(filtros, dimension, vista, fijos.current);
    router.replace(`${ruta}?${consulta}`, { scroll: false });
  }, [filtros, dimension, vista, ruta, router]);

  /**
   * Qué se movió en el rango escogido.
   *
   * **Se pide al servidor y no se calcula aquí**, porque la respuesta sale de la auditoría y de
   * los seguimientos, que no viajan con la cartera. Va en el navegador y no en la página porque el
   * rango lo cambia el usuario sin recargar.
   */
  const [actividad, setActividad] = useState<Map<string, Actividad>>();
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const [errorActividad, setErrorActividad] = useState<string | null>(null);

  const { actividadDesde, actividadHasta } = filtros;

  useEffect(() => {
    // Sin rango no hay nada que pedir; y si quien mira no es gerencia, tampoco — la consulta ni
    // siquiera sale, aunque alguien haya llegado con las fechas en la dirección.
    if (!esGerencia || !actividadDesde || !actividadHasta) {
      setActividad(undefined);
      setErrorActividad(null);
      return;
    }

    // **Si la respuesta llega tarde, se descarta.** Mover el rango tres veces seguidas dispara tres
    // consultas, y sin esto la más lenta pisa a la última y la pantalla enseña otro rango del que
    // dice el panel.
    let vigente = true;
    setCargandoActividad(true);
    setErrorActividad(null);

    clienteNavegador()
      .rpc("cuentas_con_actividad", {
        p_desde: actividadDesde,
        p_hasta: actividadHasta,
      })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          setErrorActividad(error.message);
          setActividad(new Map());
        } else {
          setActividad(
            new Map(
              (
                data as {
                  cuenta_id: string;
                  nueva: boolean;
                  modificada: boolean;
                  visitada: boolean;
                }[]
              ).map((f) => [
                f.cuenta_id,
                { nueva: f.nueva, modificada: f.modificada, visitada: f.visitada },
              ]),
            ),
          );
        }
        setCargandoActividad(false);
      });

    return () => {
      vigente = false;
    };
  }, [esGerencia, actividadDesde, actividadHasta]);

  const visibles = useMemo(() => {
    const filtradas = aplicar(cuentas, filtros, actividad);

    // **La búsqueda se aplica encima de los filtros, no en vez de ellos.** Se busca por nombre, por
    // pueblo y por tipo de comercio: el vendedor a veces recuerda el rótulo, y a veces sólo que era
    // la panadería de Chorrera. `contiene` compara sin acentos, así que «bodega jose» encuentra
    // «Bodega José».
    const escrito = busqueda.trim();
    const lista = escrito
      ? filtradas.filter(
          (c) =>
            contiene(c.nombre, escrito) ||
            contiene(c.poblado ?? "", escrito) ||
            contiene(c.tipo_comercio ?? "", escrito),
        )
      : filtradas;

    // **Filtrar por reposición y ordenar por nombre no sirve de nada.** La
    // pregunta que se está haciendo es a quién ir a ver primero. Ordenadas
    // por nombre, treinta y ocho cuentas son una lista; ordenadas por
    // urgencia, son una ruta.
    //
    // Primero los que ya se quedaron sin producto, **y de esos el más
    // reciente primero**. Es al revés de lo que parece: el que se quedó sin
    // nada ayer todavía no le compró a otro, y el que lleva medio año ya
    // tiene proveedor. Poner de primero al más atrasado es ordenar la ruta
    // por quién está más perdido.
    //
    // Después los que todavía tienen, del que se queda sin nada antes al
    // que aguanta más.
    if (filtros.porReponerEnDias !== null) {
      const orden = (c: Cuenta) => {
        const d = c.dias_para_reponer ?? 0;
        return d < 0 ? [0, -d] : [1, d];
      };
      return [...lista].sort((a, b) => {
        const [ga, da] = orden(a);
        const [gb, dbb] = orden(b);
        return ga - gb || da - dbb;
      });
    }

    return lista;
  }, [cuentas, filtros, busqueda, actividad]);

  const nombrePorVendedor = useMemo(
    () => new Map(vendedores.map((v) => [v.id, v.nombre])),
    [vendedores],
  );

  // Las opciones salen de los datos, no de una lista fija: si nadie usó una
  // categoría, no tiene sentido ofrecerla como filtro.
  const categorias = useMemo(
    () =>
      [...new Set(cuentas.map((c) => c.tipo_comercio).filter(Boolean))].sort() as string[],
    [cuentas],
  );

  const poblados = useMemo(
    () => [...new Set(cuentas.map((c) => c.poblado).filter(Boolean))].sort() as string[],
    [cuentas],
  );

  const provincias = useMemo(
    () => [...new Set(cuentas.map((c) => c.provincia).filter(Boolean))].sort() as string[],
    [cuentas],
  );

  /**
   * Los distritos con su provincia por dentro y su nombre por fuera.
   *
   * La llave es `«provincia|distrito»` porque hay dos distritos llamados Santa Fe —Darién y
   * Veraguas— y filtrar por el nombre solo los juntaría. **El rótulo sólo dice la provincia
   * cuando hace falta**: poner «Aguadulce (Coclé)» en los ochenta que no se repiten sería
   * ruido para resolver un caso entre ochenta y dos.
   */
  const distritos = useMemo(() => {
    const cuantas = new Map<string, number>();
    for (const c of cuentas) {
      if (c.distrito) cuantas.set(c.distrito, (cuantas.get(c.distrito) ?? 0) + 1);
    }

    const llaves = new Set<string>();
    const repetidos = new Set<string>();
    const vistoEn = new Map<string, string>();

    for (const c of cuentas) {
      if (!c.distrito) continue;
      llaves.add(`${c.provincia ?? ""}|${c.distrito}`);
      const antes = vistoEn.get(c.distrito);
      if (antes !== undefined && antes !== (c.provincia ?? "")) repetidos.add(c.distrito);
      vistoEn.set(c.distrito, c.provincia ?? "");
    }

    return [...llaves]
      .map((llave) => {
        const [provincia, distrito] = llave.split("|");
        return {
          llave,
          rotulo: repetidos.has(distrito) ? `${distrito} (${provincia})` : distrito,
        };
      })
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "es"));
  }, [cuentas]);

  const nombreVendedor = (id: string) =>
    vendedores.find((v) => v.id === id)?.nombre ?? "Otro vendedor";

  const { color, leyenda } = useMemo(
    () => colorizar(visibles, dimension, nombreVendedor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibles, dimension, vendedores],
  );

  const conUbicacion = visibles.filter((c) => !c.sin_ubicacion);

  // Sólo cuando las dos cosas se cumplen: la pantalla es del mapa y el mapa está a la vista.
  const enMapaPleno = mapaProtagonista && vista === "mapa";

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* BUSCAR ENTRE LAS PROPIAS CUENTAS, que es lo que faltaba.
          El usuario, 2 de septiembre de 2026: «quise buscar la cuenta de prueba... no abre una
          búsqueda dentro de mi lista de cuentas». El panel de filtros contesta «a quién ir a ver»;
          esto contesta otra pregunta, la de «dónde está aquélla», y no se resuelve con filtros
          porque el vendedor ya sabe cuál busca.
          VA ARRIBA Y SIEMPRE VISIBLE: si viviera dentro del panel, habría que abrir el panel para
          buscar, y buscar es lo más frecuente que se hace en esta pantalla. */}
      <div className={enMapaPleno ? "hidden" : "relative"}>
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-atenuado"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar entre tus cuentas"
          aria-label="Buscar entre tus cuentas por nombre, pueblo o tipo de comercio"
          className="min-h-tactil w-full rounded-lg border border-borde bg-superficie pl-10 pr-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
        />
      </div>

      <div className={enMapaPleno ? "hidden" : ""}>
      <PanelFiltros
        esGerencia={esGerencia}
        filtros={filtros}
        onCambio={setFiltros}
        abierto={abierto}
        onAbrir={setAbierto}
        categorias={categorias}
        poblados={poblados}
        provincias={provincias}
        distritos={distritos}
        vendedores={vendedores}
        visibles={visibles.length}
        total={cuentas.length}
        dimension={dimension}
        onDimension={setDimension}
        yo={yo}
        conColor
      />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-texto">
          {visibles.length} {visibles.length === 1 ? "cuenta" : "cuentas"}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={vista === "lista"}
            onClick={() => setVista("lista")}
            aria-label="Ver como lista"
            className={`min-h-tactil w-11 rounded-lg border ${
              vista === "lista"
                ? "border-marca bg-marca text-white"
                : "border-borde bg-superficie text-texto"
            }`}
          >
            <List size={16} className="mx-auto" aria-hidden />
          </button>
          <button
            type="button"
            aria-pressed={vista === "mapa"}
            onClick={() => setVista("mapa")}
            aria-label="Ver en el mapa"
            className={`min-h-tactil w-11 rounded-lg border ${
              vista === "mapa"
                ? "border-marca bg-marca text-white"
                : "border-borde bg-superficie text-texto"
            }`}
          >
            <MapPin size={16} className="mx-auto" aria-hidden />
          </button>
        </div>
      </div>

      {/* Obligatoria: sin ella se incumple §17. Vale para las dos vistas —el
          mismo color agrupa los pines del mapa y los puntos de la lista— y
          por eso la leyenda no depende de cuál se esté mirando. Ver D-013. */}
      {leyenda.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-borde bg-superficie px-3 py-2">
          {/* Dice «Color» y no solo el nombre de la dimensión: se confundía
              con un filtro. Al cambiar los filtros la leyenda seguía
              anunciando la dimensión anterior —correctamente, porque el
              color es otra cosa— pero parecía que se había quedado pegada. */}
          <span className="text-xs font-medium text-texto">
            Color: {DIMENSIONES[dimension]}
          </span>
          {leyenda.map(({ color: c, texto }) => (
            <span
              key={texto}
              className="flex items-center gap-1.5 text-xs text-texto-secundario"
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: c }}
              />
              {texto}
            </span>
          ))}
        </div>
      )}

      {errorActividad && (
        <Tarjeta>
          <p className="text-sm text-texto">No se pudo leer el movimiento del período.</p>
          <p className="text-xs text-texto-secundario">{errorActividad}</p>
        </Tarjeta>
      )}

      {/* EL MENSAJE TIENE QUE DECIR POR QUÉ NO HAY NADA. Con la barra de búsqueda, «quita algún
          filtro» manda a mirar el sitio equivocado: lo que esconde las cuentas es lo que se acaba de
          escribir, no un filtro que quizá ni está puesto.

          Y con el filtro de período, mientras la respuesta no llega **no hay nada que decir
          todavía**: un «ninguna cuenta pasa el filtro» que se desmiente medio segundo después es
          peor que esperar. */}
      {visibles.length === 0 && (
        <Tarjeta>
          {cargandoActividad ? (
            <Cargando texto="Buscando lo que se movió" />
          ) : busqueda.trim() ? (
            <Vacio titulo={`Ninguna cuenta dice «${busqueda.trim()}»`}>
              Se busca por nombre, pueblo y tipo de comercio. Prueba con menos letras, o borra lo
              escrito para volver a verlas todas.
            </Vacio>
          ) : filtraPorActividad(filtros) ? (
            <Vacio titulo="Nadie tocó nada en ese período">
              Con los demás filtros puestos, ninguna cuenta tuvo movimiento entre esas fechas.
            </Vacio>
          ) : (
            <Vacio titulo="Ninguna cuenta pasa el filtro">
              Quita algún filtro para volver a verlas.
            </Vacio>
          )}
        </Tarjeta>
      )}

      {vista === "mapa" && visibles.length > 0 && (
        <>
          {conUbicacion.length === 0 ? (
            <Tarjeta>
              <Vacio titulo="Ninguna de estas cuentas tiene ubicación">
                Ábrelas y márcalas en el mapa desde su expediente.
              </Vacio>
            </Tarjeta>
          ) : (
            // **EL MAPA SE LLEVA EL ALTO QUE SOBRE**, en vez de los 60vh de antes. Lo pidió el
            // equipo de ventas el 11 de septiembre de 2026 para el buscador, y acá vale igual:
            // es la misma tarea —mirar una zona y decidir— en otra pantalla.
            //
            // El hijo va absoluto porque el mapa se dibuja con `height: 100%`, y un porcentaje
            // contra un padre que sólo crece con `flex-1` resuelve a cero. Desaparece sin
            // error: ni la consola ni la compilación dicen nada.
            <div
              className={
                enMapaPleno
                  ? "relative -mx-4 -mb-4 min-h-0 w-[calc(100%+2rem)] flex-1 overflow-hidden border-y border-borde"
                  : // **EN CUENTAS VUELVE A SER ALTURA FIJA, Y NO ES UN DESCUIDO.** Ahí arriba hay
                    // varias tarjetas —crear, buscar, los accesos— así que «lo que sobre» es
                    // MENOS que el 60% que tenía antes: al cambiarlo, el mapa de Cuentas se
                    // encogió. Lo vio el usuario el 11 de septiembre de 2026.
                    //
                    // Crecer con lo que sobra sólo sirve cuando el mapa es el motivo de la
                    // pantalla y lo de arriba se aparta. Donde el mapa convive con otras cosas,
                    // una altura declarada le garantiza su sitio.
                    "relative h-[60vh] w-full overflow-hidden rounded-lg border border-borde"
              }
            >
              <div className="absolute inset-0">
                <MapaCuentas
                  cuentas={conUbicacion}
                  color={color}
                  destacada={cuentaDestacada}
                />
              </div>
            </div>
          )}

          {conUbicacion.length < visibles.length && (
            <p className="text-xs text-texto-atenuado">
              {visibles.length - conUbicacion.length} sin ubicación, no se
              dibujan en el mapa.
            </p>
          )}
        </>
      )}

      {vista === "lista" &&
        visibles.map((c) => (
          <FichaPunto
            key={c.id}
            id={c.id}
            nombre={c.nombre}
            tipoComercio={c.tipo_comercio}
            tipo={c.tipo}
            color={color(c)}
            zona={c.poblado}
            // Una cuenta puede estar en varias listas. Se muestra la primera
            // y se dice cuántas más: caben mal dos nombres en esa línea.
            lista={
              c.listas?.length
                ? c.listas.length > 1
                  ? `${c.listas[0]} +${c.listas.length - 1}`
                  : c.listas[0]
                : null
            }
            // De quién es solo cuando hay más de uno a la vista: a un
            // vendedor mirando su propia cartera no le dice nada.
            vendedor={
              vendedores.length > 1
                ? (nombrePorVendedor.get(c.vendedor_id) ?? null)
                : null
            }
            ultimaInteraccion={
              c.dias_sin_contacto === null
                ? null
                : haceDias(c.dias_sin_contacto)
            }
          />
        ))}
    </div>
  );
}
