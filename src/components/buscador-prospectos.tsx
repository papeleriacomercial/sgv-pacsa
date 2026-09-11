"use client";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  APIProvider,
  InfoWindow,
  // Con alias: `Map` a secas taparía el Map de JavaScript, que se usa más
  // abajo para cruzar los estados del semáforo.
  Map as MapaGoogle,
  Marker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  Building2,
  Check,
  ChevronLeft,
  Layers,
  List,
  MapPin,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { obtenerUbicacion, type Ubicacion } from "@/lib/gps";
import { COLOR, iconoPin } from "@/lib/marcadores";
import {
  CATEGORIAS,
  ETIQUETAS_CATEGORIA,
  MOTIVOS_DESCARTE,
  TIPOS_CUENTA,
  TONO_TIPO,
  type Categoria,
  type TipoCuenta,
  type MotivoDescarte,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, MensajeError, Vacio } from "@/components/ui/estados";
import { ElegirTodos } from "@/components/ui/elegir-todos";
import { crearPotenciales } from "@/lib/potenciales";

/**
 * Búsqueda de prospectos (§7.4).
 *
 * **Los resultados son una lista temporal que no se guarda.** De Google solo
 * puede almacenarse el `place_id`; nombres y teléfonos, no. Los datos se
 * vuelven propios cuando el vendedor convierte un candidato en prospecto y los
 * verifica en la visita.
 */

const RADIOS = [
  { metros: 1000, etiqueta: "1 km" },
  { metros: 3000, etiqueta: "3 km" },
  { metros: 5000, etiqueta: "5 km" },
];

/**
 * Rectángulo que encierra a Panamá.
 *
 * Sin esta restricción, la búsqueda por texto sale al mundo entero: buscar
 * "farmacias en Aguadulce" devolvía farmacias en Aguadulce de Almería, España,
 * a ocho mil kilómetros. Hay decenas de topónimos panameños repetidos en
 * España y en el resto de América.
 *
 * La empresa vende solo en Panamá, así que acotar no pierde nada y evita una
 * clase entera de resultados absurdos.
 */
const PANAMA = {
  south: 7.15,
  west: -83.1,
  north: 9.7,
  east: -77.1,
};

type Estado = {
  place_id: string;
  cuenta_id: string | null;
  es_mio: boolean | null;
  vendedor: string | null;
  tipo: TipoCuenta | null;
  ultimo_contacto: string | null;
  ultimo_resultado: string | null;
  descartado_por: string | null;
  motivo_descarte: MotivoDescarte | null;
};

type Candidato = {
  placeId: string;
  nombre: string;
  lat: number;
  lng: number;
  distanciaM: number | null;
  /**
   * Número de reseñas en Google. §7.5 lo llama el mejor proxy gratuito de
   * tráfico del local: 400 reseñas no es lo mismo que 12.
   *
   * Deliberadamente **no** se usa la calificación en estrellas. Un restaurante
   * de 4.8 puede ser diminuto, y lo que buscamos es volumen, no calidad.
   *
   * Se muestra, no se guarda: los términos de Google no permiten almacenarlo.
   */
  resenas: number | null;
  estado: Estado | null;
};

type Orden = "cercania" | "resenas";

/** Las cuatro situaciones en que puede estar un punto del directorio. */
type Situacion = "nuevo" | "mio" | "de_otro" | "descartado";

function situacionDe(c: Candidato): Situacion {
  if (c.estado?.motivo_descarte) return "descartado";
  if (c.estado?.es_mio) return "mio";
  if (c.estado?.cuenta_id) return "de_otro";
  return "nuevo";
}

/**
 * Si este punto se puede tomar.
 *
 * **Sale de `situacionDe` y no de sus propias condiciones**, porque son dos sitios que tienen que
 * decir lo mismo: la casilla de la tarjeta y el «elegir los N nuevos» de arriba. Escritas por
 * separado —como estuvieron— coincidían por casualidad, y el día que alguien cambiara una, la otra
 * habría prometido elegir puntos que no se pueden elegir.
 */
function sePuedeElegir(c: Candidato): boolean {
  return situacionDe(c) === "nuevo";
}

/**
 * Leyenda de colores, que además cuenta.
 *
 * En la lista, cada tarjeta trae su estado escrito. En el mapa no: hasta que
 * tocas el pin, el color va solo. Esta leyenda es lo que cumple la regla de
 * §17 —los estados nunca dependen solo del color— en la vista de mapa.
 *
 * **Los números la convierten en otra cosa.** Al líder le sirve para revisar el
 * barrido de una zona sin ir punto por punto: corre la misma búsqueda que corrió
 * el vendedor y lee *«31 de otro vendedor, 5 descartados, 7 nuevos»*. Esos 7 son
 * los que nadie ha levantado. Con los colores solos habría que contarlos a ojo.
 */
const LEYENDA: { clave: Situacion; color: string; texto: string }[] = [
  { clave: "nuevo", color: COLOR.ok, texto: "Nuevo" },
  { clave: "mio", color: COLOR.info, texto: "Tuyo" },
  { clave: "de_otro", color: COLOR.aviso, texto: "De otro vendedor" },
  { clave: "descartado", color: COLOR.atenuado, texto: "Descartado" },
];

function Leyenda({
  resultados,
  elegidos,
}: {
  resultados: Candidato[];
  elegidos: number;
}) {
  const conteo = resultados.reduce<Record<Situacion, number>>(
    (acc, c) => {
      acc[situacionDe(c)] += 1;
      return acc;
    },
    { nuevo: 0, mio: 0, de_otro: 0, descartado: 0 },
  );

  // Solo se listan las situaciones que de verdad aparecen: un vendedor en su
  // propia zona no tiene por qué leer «0 de otro vendedor».
  const presentes = LEYENDA.filter(({ clave }) => conteo[clave] > 0);

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-borde bg-superficie px-3 py-2">
      {presentes.map(({ clave, color, texto }) => (
        <span
          key={texto}
          className="flex items-center gap-1.5 text-xs text-texto-secundario"
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <strong className="font-mono text-texto">{conteo[clave]}</strong>
          {texto}
        </span>
      ))}
      {elegidos > 0 && (
        <span className="flex items-center gap-1.5 text-xs text-texto-secundario">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: COLOR.marca }}
          />
          <strong className="font-mono text-texto">{elegidos}</strong>
          Elegido
        </span>
      )}
    </div>
  );
}

/**
 * El color del pin dice en qué estado está el punto (§17).
 *
 * Sale de la misma clasificación que cuenta la leyenda: así el color y el
 * número no pueden discrepar.
 */
const COLOR_SITUACION: Record<Situacion, string> = {
  nuevo: COLOR.ok,
  mio: COLOR.info,
  de_otro: COLOR.aviso,
  descartado: COLOR.atenuado,
};

function colorDe(c: Candidato) {
  return COLOR_SITUACION[situacionDe(c)];
}

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

/**
 * Normaliza un nombre para comparar marcas.
 *
 * Quita acentos, puntuación y el número de sucursal del final: "Minisúper La
 * Esquina 2" y "Minisuper la esquina" tienen que contar como el mismo negocio,
 * que es justamente lo que delata una cadena.
 */
function normalizar(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Haversine. A escala de barrio la curvatura no cambia nada. */
function distancia(a: Ubicacion, lat: number, lng: number) {
  const r = (g: number) => (g * Math.PI) / 180;
  const dLat = r(lat - a.lat);
  const dLng = r(lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(h)));
}

function Buscador() {
  const router = useRouter();
  // Cuando se llega armando una lista, los puntos elegidos entran ahí en vez
  // de caer sueltos en la cartera — que es el problema que las listas
  // resuelven. Ver docs/12-flujo-vendedor.html.
  const parametros = useSearchParams();
  const listaId = parametros.get("lista");
  const places = useMapsLibrary("places");

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [radio, setRadio] = useState(3000);
  // Cuando se llega desde una lista de zona, el poblado viene prellenado: es
  // lo único que iba a escribir de todos modos.
  const [texto, setTexto] = useState(() => parametros.get("q") ?? "");
  const [nombreLista, setNombreLista] = useState<string | null>(null);
  const [pobladoLista, setPobladoLista] = useState<string | null>(null);
  // Armando una lista se arranca por área: casi siempre es un pueblo al que
  // todavía no ha ido, y "cerca de mí" no sirve de nada desde la oficina.
  const [donde, setDonde] = useState<"area" | "cerca">(
    parametros.get("lista") || parametros.get("q") ? "area" : "cerca",
  );

  const [resultados, setResultados] = useState<Candidato[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elegidos, setElegidos] = useState<string[]>([]);

  /**
   * Calle o satélite.
   *
   * **Es `hybrid` y no `satellite`.** El satélite puro no trae nombres de calle ni rótulos, y un
   * vendedor mirando techos sin saber qué calle es no puede planificar nada. Lo pidió el equipo
   * de ventas el 11 de septiembre de 2026 para reconocer el local por el techo y el patio.
   */
  const [tipoMapa, setTipoMapa] = useState<"roadmap" | "hybrid">("roadmap");
  const [orden, setOrden] = useState<Orden>("cercania");
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [abierto, setAbierto] = useState<Candidato | null>(null);
  const [descartando, setDescartando] = useState<Candidato | null>(null);
  const [guardando, setGuardando] = useState(false);

  /**
   * Sucursales contadas en todo el país, por `place_id`.
   *
   * Se guarda en memoria durante la sesión: tocar dos veces el mismo local no
   * gasta dos consultas. -1 significa que la consulta falló.
   */
  const [sucursales, setSucursales] = useState<Record<string, number>>({});
  const [contando, setContando] = useState(false);

  useEffect(() => {
    obtenerUbicacion().then(setUbicacion);
  }, []);

  useEffect(() => {
    if (!listaId) return;
    const supabase = clienteNavegador();
    supabase
      .from("listas")
      .select("nombre, poblado")
      .eq("id", listaId)
      .maybeSingle()
      .then(({ data }) => {
        setNombreLista(data?.nombre ?? null);
        setPobladoLista(data?.poblado ?? null);
      });
  }, [listaId]);

  /** Consulta el semáforo contra la base propia (§7.4). */
  const marcarEstados = useCallback(async (lista: Candidato[]) => {
    if (lista.length === 0) return lista;
    const supabase = clienteNavegador();
    const { data } = await supabase.rpc("estado_de_puntos", {
      p_place_ids: lista.map((c) => c.placeId),
    });

    const porId = new Map<string, Estado>();
    (data as Estado[] | null)?.forEach((e) => porId.set(e.place_id, e));

    return lista.map((c) => ({ ...c, estado: porId.get(c.placeId) ?? null }));
  }, []);

  /**
   * Tocar un comercio cualquiera del mapa de Google, no sólo un resultado de la búsqueda.
   *
   * Lo pidió el equipo de ventas el 11 de septiembre de 2026: *«que sea posible no solo escoger
   * los marcadores que aparecieron en la búsqueda, sino también seleccionar los comercios que
   * aparecen en el mapa»*. Barriendo una calle uno ve el hotel de la esquina que la categoría
   * buscada no trajo, y hasta hoy no había forma de tomarlo sin salirse a otra pantalla.
   *
   * **ENTRA A LOS RESULTADOS COMO UNO MÁS, no por un carril aparte.** Así hereda todo lo que ya
   * existe: el semáforo que dice si ya es de alguien, el pin de color, la tarjeta en la lista, el
   * contador y el botón de agregar. Un carril paralelo habría que enseñárselo a cada una de esas
   * piezas, y la que se olvidara dejaría crear un punto que ya es de otro vendedor.
   */
  const tocarComercio = useCallback(
    async (placeId: string) => {
      if (!places) return;

      // Ya estaba entre los resultados: no se duplica, se abre.
      const ya = resultados?.find((c) => c.placeId === placeId);
      if (ya) {
        setAbierto(ya);
        return;
      }

      try {
        const lugar = new places.Place({ id: placeId });
        await lugar.fetchFields({
          fields: ["displayName", "location", "userRatingCount"],
        });
        if (!lugar.location) return;

        const crudo: Candidato = {
          placeId,
          nombre: lugar.displayName ?? "Este local",
          lat: lugar.location.lat(),
          lng: lugar.location.lng(),
          distanciaM: ubicacion
            ? distancia(ubicacion, lugar.location.lat(), lugar.location.lng())
            : null,
          resenas: lugar.userRatingCount ?? null,
          estado: null,
        };

        // **EL SEMÁFORO ANTES DE MOSTRARLO.** Sin esto, un local que ya es de otro vendedor se
        // dibujaría como nuevo y el vendedor intentaría levantarlo.
        const [conEstado] = await marcarEstados([crudo]);
        setResultados((antes) => (antes ? [...antes, conEstado] : [conEstado]));
        setAbierto(conEstado);
      } catch {
        // Un local que Google no deja leer simplemente no abre nada.
      }
    },
    [places, resultados, ubicacion, marcarEstados],
  );
  /**
   * @param centro Dónde buscar cuando el modo es "cerca". Sin esto solo se
   *   podía buscar alrededor del GPS — y para armar la lista de un pueblo al
   *   que todavía no ha ido, eso no sirve de nada.
   */
  async function buscar(
    modo: "cerca" | "texto",
    centro?: { lat: number; lng: number },
  ) {
    if (!places) return;
    setError(null);
    setBuscando(true);

    // Barrer una zona **acumula**; empezar de cero borra. Si cada barrido
    // reemplazara, moverse dos cuadras perdería lo que ya marcó — y recorrer
    // un pueblo en tandas sería imposible, que es justo para lo que sirve.
    const barriendo = centro !== undefined;
    if (!barriendo) {
      setResultados(null);
      setElegidos([]);
    }

    try {
      const tipos = categorias.flatMap((c) => [...CATEGORIAS[c].tipos]);
      // `userRatingCount` pertenece al tramo Enterprise de Places, más caro por
      // llamada pero con su propia cuota gratuita de 10.000 al mes. A este
      // volumen sigue costando cero, y sin ese número la lista es una fila de
      // nombres indistinguibles.
      const campos = ["id", "displayName", "location", "userRatingCount"];
      let encontrados: google.maps.places.Place[] = [];

      if (modo === "cerca") {
        const desde = centro ?? ubicacion;
        if (!desde) {
          setError("No hay ubicación. Activa el GPS o busca por texto.");
          setBuscando(false);
          return;
        }
        const { places: r } = await places.Place.searchNearby({
          fields: campos,
          locationRestriction: {
            center: { lat: desde.lat, lng: desde.lng },
            radius: radio,
          },
          includedPrimaryTypes: tipos.length > 0 ? tipos : undefined,
          maxResultCount: 20,
          rankPreference: places.SearchNearbyRankPreference.DISTANCE,
        });
        encontrados = r;
      } else {
        // Las categorías elegidas se suman al texto. Antes se ignoraban en
        // este modo, y era justo lo que hacía falta para armar una lista de
        // zona: "Farmacia y Panadería en Aguadulce" en una sola consulta.
        const etiquetas = categorias.map((c) => CATEGORIAS[c].etiqueta);
        const consulta =
          etiquetas.length > 0
            ? `${etiquetas.join(" y ")} en ${texto}`
            : texto;

        const { places: r } = await places.Place.searchByText({
          fields: campos,
          textQuery: consulta,
          maxResultCount: 20,
          // Sin esto la búsqueda es mundial. Ver la nota de PANAMA arriba.
          locationRestriction: PANAMA,
          region: "pa",
        });
        encontrados = r;
      }

      const lista: Candidato[] = encontrados
        .filter((p) => p.id && p.location)
        // Cinturón y tirantes: la restricción ya se la pedimos a Google, pero
        // el descarte de lo que caiga fuera del país lo hacemos nosotros. Es
        // barato y convierte la garantía en propia.
        .filter(
          (p) =>
            p.location!.lat() >= PANAMA.south &&
            p.location!.lat() <= PANAMA.north &&
            p.location!.lng() >= PANAMA.west &&
            p.location!.lng() <= PANAMA.east,
        )
        .map((p) => ({
          placeId: p.id!,
          nombre: p.displayName ?? "Sin nombre",
          lat: p.location!.lat(),
          lng: p.location!.lng(),
          distanciaM: ubicacion
            ? distancia(ubicacion, p.location!.lat(), p.location!.lng())
            : null,
          resenas: p.userRatingCount ?? null,
        }))
        .map((c) => ({ ...c, estado: null }));

      const conEstado = await marcarEstados(lista);

      setResultados((antes) => {
        if (!barriendo || !antes) return conEstado;
        // Por `place_id`: los barridos se solapan y el mismo local sale dos
        // veces. Se queda el que ya estaba para no perder nada de él.
        const vistos = new Set(antes.map((c) => c.placeId));
        return [...antes, ...conEstado.filter((c) => !vistos.has(c.placeId))];
      });
    } catch {
      setError("La búsqueda falló. Revisa la señal e intenta de nuevo.");
    }

    setBuscando(false);
  }

  async function agregarElegidos() {
    if (elegidos.length === 0 || !resultados) return;
    setGuardando(true);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Se cerró la sesión. Vuelve a entrar.");
      setGuardando(false);
      return;
    }

    // **LA CREACIÓN VIVE EN `lib/listas`**, porque el mapa de una lista hace exactamente lo
    // mismo. Escrita dos veces es como una de las dos termina olvidando heredar el poblado, o
    // poniendo `tipo` y convirtiendo en prospecto lo que todavía es un potencial.
    const fallo = await crearPotenciales({
      puntos: resultados.filter((c) => elegidos.includes(c.placeId)),
      vendedorId: user.id,
      listaId,
    });

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    router.push(listaId ? `/listas/${listaId}` : "/cuentas");
    router.refresh();
  }

  async function descartar(motivo: MotivoDescarte, nota: string) {
    if (!descartando) return;
    setGuardando(true);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("descartes").insert({
      id: crypto.randomUUID(),
      place_id: descartando.placeId,
      motivo,
      nota: nota.trim() || null,
      vendedor_id: user.id,
    });

    setResultados(await marcarEstados(resultados ?? []));
    setDescartando(null);
    setGuardando(false);
  }

  /**
   * Nombres que se repiten dentro de esta búsqueda.
   *
   * Es el indicio gratuito de cadena: no consulta nada, solo compara lo que ya
   * está en pantalla. Salta poco —dos sucursales rara vez caen en el mismo
   * pueblo— y donde de verdad sirve es cuando se busca por marca.
   */
  const repetidos = useMemo(() => {
    const cuenta = new Map<string, number>();
    (resultados ?? []).forEach((c) => {
      const clave = normalizar(c.nombre);
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    });
    return cuenta;
  }, [resultados]);

  /** Una consulta, acotada a Panamá, para saber si la marca tiene más locales. */
  async function contarSucursales(c: Candidato) {
    if (!places || sucursales[c.placeId] !== undefined) return;
    setContando(true);

    try {
      const { places: encontrados } = await places.Place.searchByText({
        fields: ["id"],
        textQuery: c.nombre,
        maxResultCount: 20,
        locationRestriction: PANAMA,
        region: "pa",
      });
      setSucursales((s) => ({ ...s, [c.placeId]: encontrados.length }));
    } catch {
      setSucursales((s) => ({ ...s, [c.placeId]: -1 }));
    }

    setContando(false);
  }

  const ordenados = [...(resultados ?? [])].sort((a, b) =>
    orden === "cercania"
      ? (a.distanciaM ?? Infinity) - (b.distanciaM ?? Infinity)
      : (b.resenas ?? -1) - (a.resenas ?? -1),
  );

  // LOS ÚNICOS QUE SE PUEDEN ELEGIR. De las cuatro situaciones sólo el nuevo es tomable: el que ya
  // es tuyo lo abres, el de otro vendedor no te toca, y el descartado ya lo miró alguien. Es la
  // misma condición con la que la tarjeta decide si dibuja o no su casilla — sale de `situacionDe`
  // para que no puedan discrepar el día que alguien cambie una de las dos.
  const nuevos = ordenados.filter(sePuedeElegir);
  const nuevosElegidos = nuevos.filter((c) => elegidos.includes(c.placeId)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* **NO HABÍA CÓMO SALIR DE ACÁ**, y el que llega armando una lista lleva encima una
          selección que todavía no existe en ninguna parte: si se va, se pierde entera y sin
          avisar. Lo reportó el equipo de ventas el 11 de septiembre de 2026.

          La advertencia sale **sólo cuando hay algo que perder**. Un «¿seguro?» que salta
          siempre se contesta que sí sin leerlo, y el día que de verdad importa tampoco se lee. */}
      <button
        type="button"
        onClick={() => {
          if (
            elegidos.length > 0 &&
            !confirm(
              `Tienes ${elegidos.length} ${
                elegidos.length === 1 ? "punto elegido" : "puntos elegidos"
              } sin agregar. Si sales, se pierden.`,
            )
          ) {
            return;
          }
          router.push(listaId ? `/listas/${listaId}` : "/mapa");
        }}
        className="min-h-tactil -mb-2 flex items-center gap-1.5 self-start text-sm text-texto-secundario"
      >
        <ChevronLeft size={18} aria-hidden />
        {listaId ? "Volver a la lista" : "Volver al mapa"}
      </button>

      {/* Sin esto se pierde el hilo: escoge veinte puntos y no sabe a dónde
          van a caer. */}
      {listaId && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-sm text-blue-800">
            Armando la lista{" "}
            <span className="font-semibold">{nombreLista ?? "…"}</span>
          </p>
          <Link
            href={`/listas/${listaId}`}
            className="shrink-0 text-xs text-blue-800 underline"
          >
            Ver la lista
          </Link>
        </div>
      )}

      {/* Una sola búsqueda con dos partes: **qué** y **dónde**. Antes eran dos
          tarjetas separadas y parecían dos búsquedas distintas — la pregunta
          "¿a cuál le hace caso?" era la respuesta correcta a un diseño malo.
          Las categorías siempre mandan; lo que cambia es desde dónde se mira. */}
      {/* **EL FORMULARIO SE GUARDA MIENTRAS SE MIRA EL MAPA.** Es lo que le devuelve la pantalla
          al mapa, que era el pedido: ocupaba poco más de la mitad. No se pierde nada — para
          buscar otra vez está «Buscar en esta zona» encima del propio mapa, y el formulario
          vuelve entero al pasarse a lista. */}
      <Tarjeta
        className={
          vista === "mapa" && resultados && resultados.length > 0
            ? "hidden"
            : "flex flex-col gap-4"
        }
      >
        <Opciones
          etiqueta="1 · Qué buscas"
          opciones={ETIQUETAS_CATEGORIA}
          valor={categorias}
          multiple
          onCambio={(c) =>
            setCategorias((a) =>
              a.includes(c) ? a.filter((x) => x !== c) : [...a, c],
            )
          }
          ayuda="Se aplica a las dos formas de buscar. Sin escoger nada, trae de todo."
        />

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-texto">2 · Dónde</p>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["area", "Escribiendo el área"],
                ["cerca", "Cerca de mí"],
              ] as const
            ).map(([m, etiqueta]) => (
              <button
                key={m}
                type="button"
                aria-pressed={donde === m}
                onClick={() => setDonde(m)}
                className={`min-h-tactil rounded-lg border px-2 text-sm ${
                  donde === m
                    ? "border-marca bg-marca text-white"
                    : "border-borde bg-superficie text-texto"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {donde === "area" ? (
            <>
              <Campo
                etiqueta="El área o la marca"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                ayuda={
                  categorias.length > 0
                    ? `Va a buscar "${categorias
                        .map((c) => CATEGORIAS[c].etiqueta)
                        .join(" y ")} en ${texto || "…"}"`
                    : "Aguadulce · Calle 50 · Banco General"
                }
              />
              <Boton
                ancho
                onClick={() => buscar("texto")}
                disabled={buscando || !places || texto.trim().length < 3}
              >
                <span className="flex items-center justify-center gap-2">
                  <Search size={16} aria-hidden />
                  Buscar
                </span>
              </Boton>
            </>
          ) : (
            <>
              {/* El radio solo sirve estando en la zona. Escondido cuando se
                  arma la lista desde la oficina, que es cuando confunde. */}
              <div>
                <p className="text-sm font-medium text-texto">A qué distancia</p>
                <div className="mt-2 flex gap-2">
                  {RADIOS.map((r) => (
                    <button
                      key={r.metros}
                      type="button"
                      aria-pressed={radio === r.metros}
                      onClick={() => setRadio(r.metros)}
                      className={`min-h-tactil flex-1 rounded-lg border text-sm ${
                        radio === r.metros
                          ? "border-marca bg-marca text-white"
                          : "border-borde bg-superficie text-texto"
                      }`}
                    >
                      {r.etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              <Boton
                ancho
                onClick={() => buscar("cerca")}
                disabled={buscando || !places || !ubicacion}
              >
                {ubicacion ? "Buscar cerca de mí" : "Buscando ubicación"}
              </Boton>
            </>
          )}
        </div>
      </Tarjeta>

      {error && <MensajeError titulo={error} />}
      {/* Mientras barre el mapa no se desmonta: si desapareciera, volvería
          centrado en otro lado y perdería el sitio que estaba mirando. */}
      {buscando && !resultados && <Cargando texto="Buscando" />}

      {resultados?.length === 0 && (
        <Tarjeta>
          <Vacio titulo="Sin resultados">
            Prueba con otra categoría, más distancia, o escribe el área a mano.
          </Vacio>
        </Tarjeta>
      )}

      {resultados && resultados.length > 0 && (
        <>
          {/* **ESTA FILA ES TODO EL CROMO QUE QUEDA EN MODO MAPA.** El pedido del equipo de
              ventas fue que el mapa ocupara la pantalla: ocupaba poco más de la mitad, porque
              encima llevaba el formulario, el conteo, la leyenda, el «elegir todos» y el orden.
              En mapa, el conteo y el orden no dicen nada —no hay filas que ordenar— y la leyenda
              se mudó encima del propio mapa, donde no gasta alto. */}
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-texto">
              {resultados.length} encontrados
            </p>
            <div className="flex shrink-0 gap-1">
              {/* **EL SATÉLITE SÓLO EN MAPA**, que es donde significa algo. */}
              {vista === "mapa" && (
                <button
                  type="button"
                  aria-pressed={tipoMapa === "hybrid"}
                  onClick={() =>
                    setTipoMapa((a) => (a === "hybrid" ? "roadmap" : "hybrid"))
                  }
                  className={`min-h-tactil w-11 rounded-lg border ${
                    tipoMapa === "hybrid"
                      ? "border-marca bg-marca text-white"
                      : "border-borde bg-superficie text-texto"
                  }`}
                  aria-label={
                    tipoMapa === "hybrid" ? "Ver el mapa de calles" : "Ver satélite"
                  }
                >
                  <Layers size={16} className="mx-auto" aria-hidden />
                </button>
              )}
              <button
                type="button"
                aria-pressed={vista === "lista"}
                onClick={() => setVista("lista")}
                className={`min-h-tactil w-11 rounded-lg border ${
                  vista === "lista"
                    ? "border-marca bg-marca text-white"
                    : "border-borde bg-superficie text-texto"
                }`}
                aria-label="Ver como lista"
              >
                <List size={16} className="mx-auto" aria-hidden />
              </button>
              <button
                type="button"
                aria-pressed={vista === "mapa"}
                onClick={() => setVista("mapa")}
                className={`min-h-tactil w-11 rounded-lg border ${
                  vista === "mapa"
                    ? "border-marca bg-marca text-white"
                    : "border-borde bg-superficie text-texto"
                }`}
                aria-label="Ver en el mapa"
              >
                <MapPin size={16} className="mx-auto" aria-hidden />
              </button>
            </div>
          </div>

          {/* **EN MAPA SE MUDA ENCIMA DEL MAPA, NO DESAPARECE.** Es la que cumple la regla de
              que un estado nunca dependa sólo del color, y el mapa es justo donde el color va
              solo: quitarla ahí sería quitarla donde hace falta. */}
          <div className={vista === "mapa" ? "hidden" : ""}>
            <Leyenda resultados={resultados} elegidos={elegidos.length} />
          </div>

          {/* DEBAJO DE LA LEYENDA A PROPÓSITO. La leyenda acaba de decir «7 Nuevo»; el control
              dice «Elegir los 7 nuevos». Puesto encima, el número aparecería antes de que se sepa
              de dónde sale. */}
          {/* En mapa se elige tocando pines, uno por uno; el «elegir los N» vive en la lista,
              que es donde se ven los N. */}
          <div className={vista === "mapa" ? "hidden" : ""}>
          <ElegirTodos
            total={nuevos.length}
            elegidos={nuevosElegidos}
            sustantivo="nuevos"
            onTodos={() =>
              setElegidos((a) => [
                ...a,
                ...nuevos
                  .map((c) => c.placeId)
                  .filter((id) => !a.includes(id)),
              ])
            }
            // QUITA LOS QUE HOY SE PUEDEN ELEGIR, no todo lo marcado. Los estados se refrescan
            // mientras se trabaja —alguien descarta un punto, otro vendedor lo levanta— y uno que
            // dejó de ser nuevo sale de esta cuenta; borrarlo de la selección a la fuerza sería
            // decidir por el vendedor sobre algo que este control ya no representa.
            onNinguno={() => {
              const enPantalla = new Set(nuevos.map((c) => c.placeId));
              setElegidos((a) => a.filter((id) => !enPantalla.has(id)));
            }}
          />
          </div>

          {/* Ordenar por reseñas es lo que separa un supermercado de 400 de
              una tienda de 12. Es el proxy de tráfico de §7.5.

              **No se dibuja en mapa**: no hay filas que ordenar, y son 44px de alto que el mapa
              necesita más. */}
          <div className={vista === "mapa" ? "hidden" : "flex gap-2"}>
            <button
              type="button"
              aria-pressed={orden === "cercania"}
              onClick={() => setOrden("cercania")}
              className={`min-h-tactil flex-1 rounded-lg border text-sm ${
                orden === "cercania"
                  ? "border-marca bg-marca text-white"
                  : "border-borde bg-superficie text-texto"
              }`}
            >
              Más cerca
            </button>
            <button
              type="button"
              aria-pressed={orden === "resenas"}
              onClick={() => setOrden("resenas")}
              className={`min-h-tactil flex-1 rounded-lg border text-sm ${
                orden === "resenas"
                  ? "border-marca bg-marca text-white"
                  : "border-borde bg-superficie text-texto"
              }`}
            >
              Más movimiento
            </button>
          </div>

          {vista === "mapa" ? (
            // `flex-1` y `min-h-0`: se lleva todo el alto que sobre después del cromo, sin que
            // nadie tenga que adivinar cuánto mide la barra de abajo en cada teléfono.
            <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-borde">
              <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)]">
                <Leyenda resultados={resultados} elegidos={elegidos.length} />
              </div>
              {/* **EL MAPA VA ABSOLUTO, Y NO ES CAPRICHO.** Se dibuja con `height: 100%`, y un
                  porcentaje contra un padre que sólo crece con `flex-1` —sin altura declarada—
                  resuelve a cero: el mapa desaparece sin error de consola ni fallo de compilación.
                  Pasó al darle el alto que sobra en vez de un `60vh` fijo. Posicionado absoluto, la
                  caja tiene alto de verdad y el porcentaje vuelve a significar algo. */}
              <div className="absolute inset-0">
              <MapaCandidatos
                candidatos={ordenados}
                abierto={abierto}
                onAbrir={setAbierto}
                sucursales={sucursales}
                contando={contando}
                onContarSucursales={contarSucursales}
                elegidos={elegidos}
                // `Boolean` y no `!== null`: el botón de abajo decide con `listaId ?` a secas, y con
                // un `?lista=` vacío en la dirección los dos prometerían cosas distintas.
                enLista={Boolean(listaId)}
                tipoMapa={tipoMapa}
                onTocarComercio={tocarComercio}
                // **SE CIERRA AL ELEGIR.** Barrer una zona es tocar quince marcadores seguidos;
                // dejar la ventanita abierta obliga a cerrarla a mano cada vez, y son quince
                // toques que no hacen nada. El pin cambia de color, que es la confirmación.
                onElegir={(id) => {
                  setElegidos((a) =>
                    a.includes(id) ? a.filter((x) => x !== id) : [...a, id],
                  );
                  setAbierto(null);
                }}
                onBuscarAqui={(centro) => buscar("cerca", centro)}
                buscando={buscando}
                queBusca={
                  categorias.length > 0
                    ? categorias
                        .map((c) => CATEGORIAS[c].etiqueta.toLowerCase())
                        .join(" y ")
                    : null
                }
              />
              </div>
            </div>
          ) : (
            ordenados.map((c) => (
              <Resultado
                key={c.placeId}
                candidato={c}
                elegido={elegidos.includes(c.placeId)}
                onElegir={() =>
                  setElegidos((a) =>
                    a.includes(c.placeId)
                      ? a.filter((x) => x !== c.placeId)
                      : [...a, c.placeId],
                  )
                }
                onDescartar={() => setDescartando(c)}
                onVerEnMapa={() => {
                  setAbierto(c);
                  setVista("mapa");
                }}
                enLaBusqueda={repetidos.get(normalizar(c.nombre)) ?? 1}
              />
            ))
          )}
        </>
      )}

      {elegidos.length > 0 && (
        <div className="sticky bottom-16 z-10">
          <Boton ancho onClick={agregarElegidos} disabled={guardando}>
            {guardando
              ? "Agregando"
              : `Agregar ${elegidos.length} ${
                  elegidos.length === 1 ? "potencial" : "potenciales"
                } ${listaId ? "a la lista" : "a mi cartera"}`}
          </Boton>
        </div>
      )}

      {descartando && (
        <FormularioDescarte
          nombre={descartando.nombre}
          onCancelar={() => setDescartando(null)}
          onDescartar={descartar}
          guardando={guardando}
        />
      )}
    </div>
  );
}

/**
 * Los mismos resultados sobre el mapa.
 *
 * Es lo que una lista no puede mostrar: si los puntos forman un racimo sobre
 * una vía principal o si están desperdigados en el monte. Esa geografía decide
 * si vale la pena la parada, y se lee de un vistazo.
 */
/**
 * Lleva el mapa hasta el punto que se abrió desde la lista.
 *
 * En la lista ves qué es: el nombre y cuántas reseñas tiene. En el mapa ves
 * dónde está. Poder saltar de una vista a la otra sobre el mismo punto es lo
 * que hace que las dos sirvan.
 */
function Centrar({ candidato }: { candidato: Candidato | null }) {
  const mapa = useMap();

  useEffect(() => {
    if (!mapa || !candidato) return;
    mapa.panTo({ lat: candidato.lat, lng: candidato.lng });
    const zoom = mapa.getZoom();
    if (zoom === undefined || zoom < 16) mapa.setZoom(16);
  }, [mapa, candidato]);

  return null;
}

/**
 * "Buscar en esta zona".
 *
 * Es el gesto que uno espera de un mapa y que faltaba: moverse hasta Aguadulce
 * y pedir lo que hay ahí. Sin esto solo se podía buscar alrededor del GPS —
 * inútil para armar la lista de un pueblo al que todavía no ha ido— o por
 * texto, que devuelve veinte y se acabó.
 *
 * Barriendo por zonas se puede recorrer un pueblo entero en tandas.
 */
function BuscarAqui({
  onBuscar,
  buscando,
  queBusca,
}: {
  onBuscar: (centro: { lat: number; lng: number }) => void;
  buscando: boolean;
  /** Qué categorías están elegidas, para que el botón no mienta. */
  queBusca: string | null;
}) {
  const mapa = useMap();

  return (
    <button
      type="button"
      disabled={buscando || !mapa}
      onClick={() => {
        const c = mapa?.getCenter();
        if (c) onBuscar({ lat: c.lat(), lng: c.lng() });
      }}
      className="min-h-tactil absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-borde bg-superficie px-4 text-sm font-medium text-texto shadow-md disabled:opacity-60"
    >
      {buscando
        ? "Buscando"
        : queBusca
          ? `Buscar ${queBusca} aquí`
          : "Buscar de todo aquí"}
    </button>
  );
}

function MapaCandidatos({
  candidatos,
  abierto,
  onAbrir,
  elegidos,
  onElegir,
  enLista,
  tipoMapa,
  onTocarComercio,
  sucursales,
  contando,
  onContarSucursales,
  onBuscarAqui,
  buscando,
  queBusca,
}: {
  candidatos: Candidato[];
  abierto: Candidato | null;
  onAbrir: (c: Candidato | null) => void;
  elegidos: string[];
  onElegir: (placeId: string) => void;
  /** Si se llegó armando una lista. Cambia lo que promete el botón de la ventanita. */
  enLista: boolean;
  /** Calle o satélite con rótulos. Lo decide la barra de arriba. */
  tipoMapa: "roadmap" | "hybrid";
  /** Un comercio del mapa de Google que no venía en la búsqueda. */
  onTocarComercio: (placeId: string) => void;
  sucursales: Record<string, number>;
  contando: boolean;
  onContarSucursales: (c: Candidato) => void;
  onBuscarAqui: (centro: { lat: number; lng: number }) => void;
  buscando: boolean;
  queBusca: string | null;
}) {
  // `core` trae Size y Point, que usa el ícono del marcador. Sin esperarla, el
  // primer render los construye antes de que existan y revienta el mapa entero.
  const core = useMapsLibrary("core");

  const centro = candidatos[0]
    ? { lat: candidatos[0].lat, lng: candidatos[0].lng }
    : { lat: 8.9824, lng: -79.5199 };

  return (
    <MapaGoogle
      defaultCenter={abierto ? { lat: abierto.lat, lng: abierto.lng } : centro}
      defaultZoom={14}
      gestureHandling="greedy"
      // Controlado: cambia cuando el vendedor toca el botón de satélite.
      mapTypeId={tipoMapa}
      disableDefaultUI
      zoomControl
      // **`clickableIcons` es lo que deja tocar un comercio del mapa.** Sin esto, los rótulos de
      // Google son dibujo: se ven y no se pueden tomar.
      clickableIcons
      onClick={(evento) => {
        const id = evento.detail.placeId;
        if (!id) return;
        // Sin esto Google abre su propia tarjeta encima de la nuestra.
        evento.stop?.();
        onTocarComercio(id);
      }}
      style={{ height: "100%", width: "100%" }}
    >
      <BuscarAqui
        onBuscar={onBuscarAqui}
        buscando={buscando}
        queBusca={queBusca}
      />
      <Centrar candidato={abierto} />

      {core &&
        candidatos.map((c) => (
          <Marker
            key={c.placeId}
            position={{ lat: c.lat, lng: c.lng }}
            icon={iconoPin(
              elegidos.includes(c.placeId) ? COLOR.marca : colorDe(c),
            )}
            onClick={() => onAbrir(c)}
          />
        ))}

      {abierto && (
        <InfoWindow
          position={{ lat: abierto.lat, lng: abierto.lng }}
          onCloseClick={() => onAbrir(null)}
        >
          <span className="block text-sm font-semibold">{abierto.nombre}</span>
          <span className="block text-xs">
            {abierto.resenas === null
              ? "Sin reseñas"
              : `${abierto.resenas} reseñas`}
            {abierto.distanciaM !== null && ` · ${abierto.distanciaM} m`}
          </span>
          <span className="block text-xs">
            {abierto.estado?.motivo_descarte
              ? `Descartado: ${MOTIVOS_DESCARTE[abierto.estado.motivo_descarte]}`
              : abierto.estado?.es_mio
                ? "Ya es cuenta tuya"
                : abierto.estado?.cuenta_id
                  ? `De ${abierto.estado.vendedor ?? "otro vendedor"}`
                  : "Nuevo"}
          </span>

          {/* **DICE A DÓNDE VA, NO «ELEGIR».** Lo pidió el equipo de ventas el 11 de septiembre
              de 2026: parado en una lista, «Elegir» no dice para qué, y el botón de abajo hablaba
              de «mi cartera» aunque los puntos fueran a entrar a la lista que se está armando.

              **No crea nada todavía: marca.** Es la misma selección del modo lista —el mismo
              ganchito, el mismo contador— y todo se crea de un golpe al final. Que los dos modos
              hagan lo mismo es lo que permite ir saltando entre mapa y lista sin perder el hilo. */}
          {sePuedeElegir(abierto) && (
            <button
              type="button"
              onClick={() => onElegir(abierto.placeId)}
              className="mt-1 block text-xs font-medium underline"
            >
              {elegidos.includes(abierto.placeId)
                ? enLista
                  ? "Quitar de mi lista"
                  : "Quitar"
                : enLista
                  ? "Agregar a mi lista"
                  : "Agregar a mis potenciales"}
            </button>
          )}

          {/* La consulta nacional va aquí y no en la lista: para llegar, el
              vendedor ya miró el mapa y tocó este punto. Es un gesto
              deliberado, no algo que se toca de paso en veinte filas. */}
          {sucursales[abierto.placeId] === undefined ? (
            <button
              type="button"
              onClick={() => onContarSucursales(abierto)}
              disabled={contando}
              className="mt-1 block text-xs underline"
            >
              {contando ? "Buscando" : "¿Tiene más sucursales?"}
            </button>
          ) : (
            <span className="mt-1 block text-xs">
              {sucursales[abierto.placeId] === -1
                ? "No se pudo consultar"
                : sucursales[abierto.placeId] <= 1
                  ? "No encontré otras sucursales"
                  : `Aparece en ${sucursales[abierto.placeId]} lugares de Panamá`}
            </span>
          )}
        </InfoWindow>
      )}
    </MapaGoogle>
  );
}

function Resultado({
  candidato,
  elegido,
  onElegir,
  onDescartar,
  onVerEnMapa,
  enLaBusqueda,
}: {
  candidato: Candidato;
  elegido: boolean;
  onElegir: () => void;
  onDescartar: () => void;
  onVerEnMapa: () => void;
  /** Cuántos resultados de esta búsqueda comparten el nombre. */
  enLaBusqueda: number;
}) {
  const e = candidato.estado;
  const yaEsProspecto = e?.cuenta_id != null;
  const descartado = e?.motivo_descarte != null;

  return (
    <Tarjeta
      className={`flex flex-col gap-2 ${elegido ? "border-marca" : ""} ${
        descartado ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {/* El nombre lleva al mapa: en la lista se ve qué es, en el mapa
              dónde está. */}
          <button
            type="button"
            onClick={onVerEnMapa}
            className="flex items-start gap-1.5 text-left"
          >
            <span className="text-base font-semibold text-texto underline decoration-borde underline-offset-2">
              {candidato.nombre}
            </span>
            <MapPin
              size={14}
              className="mt-1 shrink-0 text-texto-atenuado"
              aria-hidden
            />
            <span className="sr-only">Ver en el mapa</span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {candidato.distanciaM !== null && (
              <p className="flex items-center gap-1 font-mono text-xs text-texto-secundario">
                <MapPin size={12} aria-hidden />
                {candidato.distanciaM < 1000
                  ? `${candidato.distanciaM} m`
                  : `${(candidato.distanciaM / 1000).toFixed(1)} km`}
              </p>
            )}

            {/* Proxy de tráfico, no de calidad: se muestra el número de
                reseñas y nunca las estrellas (§7.5). */}
            <p
              className={`flex items-center gap-1 font-mono text-xs ${
                candidato.resenas === null
                  ? "text-texto-atenuado"
                  : "text-texto-secundario"
              }`}
            >
              <MessageSquare size={12} aria-hidden />
              {candidato.resenas === null
                ? "sin reseñas"
                : `${candidato.resenas} reseñas`}
            </p>
          </div>
        </div>

        {sePuedeElegir(candidato) && (
          <button
            type="button"
            aria-pressed={elegido}
            onClick={onElegir}
            className={`min-h-tactil w-11 shrink-0 rounded-lg border ${
              elegido
                ? "border-marca bg-marca text-white"
                : "border-borde bg-superficie"
            }`}
          >
            {elegido && <Check size={16} className="mx-auto" aria-hidden />}
          </button>
        )}
      </div>

      {/* El semáforo de §7.4: lo que diferencia esto de mirar Google a mano. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Indicio gratuito de cadena: el nombre se repite en esta misma
            búsqueda. No consulta nada. */}
        {enLaBusqueda > 1 && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            <Building2 size={14} aria-hidden />
            {`Cadena · ${enLaBusqueda} aquí`}
          </span>
        )}

        {!yaEsProspecto && !descartado && <Insignia tono="ok">Nuevo</Insignia>}

        {yaEsProspecto && e?.es_mio && (
          <>
            <Insignia tono={TONO_TIPO[e.tipo as TipoCuenta]}>
              {`Tuyo · ${TIPOS_CUENTA[e.tipo as TipoCuenta]}`}
            </Insignia>
            {e.cuenta_id && (
              <Link
                href={`/cuentas/${e.cuenta_id}`}
                className="text-xs underline"
              >
                Abrir
              </Link>
            )}
          </>
        )}

        {yaEsProspecto && e?.es_mio === false && (
          <Insignia tono="aviso">
            {`De ${e.vendedor ?? "otro vendedor"}`}
          </Insignia>
        )}

        {descartado && (
          <Insignia tono="neutro">
            {`${MOTIVOS_DESCARTE[e.motivo_descarte!]} · ${e.descartado_por ?? "el equipo"}`}
          </Insignia>
        )}
      </div>

      {e?.ultimo_contacto && (
        <p className="text-xs text-texto-secundario">
          Última visita {FECHA.format(new Date(e.ultimo_contacto))}
        </p>
      )}

      {!yaEsProspecto && !descartado && (
        <button
          type="button"
          onClick={onDescartar}
          className="self-start text-xs text-texto-secundario underline"
        >
          Descartar
        </button>
      )}
    </Tarjeta>
  );
}

function FormularioDescarte({
  nombre,
  onCancelar,
  onDescartar,
  guardando,
}: {
  nombre: string;
  onCancelar: () => void;
  onDescartar: (motivo: MotivoDescarte, nota: string) => void;
  guardando: boolean;
}) {
  const [motivo, setMotivo] = useState<MotivoDescarte | null>(null);
  const [nota, setNota] = useState("");

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 p-4">
      <Tarjeta className="max-h-[85vh] w-full overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-texto">Descartar</p>
            <p className="text-sm text-texto-secundario">{nombre}</p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="min-h-tactil w-11 shrink-0"
          >
            <X size={18} className="mx-auto" aria-hidden />
          </button>
        </div>

        <p className="mt-2 text-xs text-texto-secundario">
          Tu decisión queda visible para todo el equipo, para que nadie más
          recorra este punto en balde.
        </p>

        <div className="mt-4">
          <Opciones
            etiqueta="Motivo"
            opciones={MOTIVOS_DESCARTE}
            valor={motivo}
            onCambio={setMotivo}
          />
        </div>

        <div className="mt-4">
          <Campo
            etiqueta="Nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            ayuda="Opcional. Ayuda a auditar el criterio después."
          />
        </div>

        <div className="mt-4">
          <Boton
            ancho
            onClick={() => motivo && onDescartar(motivo, nota)}
            disabled={!motivo || guardando}
          >
            {guardando ? "Guardando" : "Descartar punto"}
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

export function BuscadorProspectos() {
  const llave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!llave) {
    return (
      <MensajeError
        titulo="Falta la llave de Google"
        detalle="No está configurada NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en este entorno."
      />
    );
  }

  return (
    <APIProvider apiKey={llave} libraries={["places"]}>
      <Buscador />
    </APIProvider>
  );
}
