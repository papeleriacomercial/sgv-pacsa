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

/**
 * Leyenda de colores.
 *
 * En la lista, cada tarjeta trae su estado escrito. En el mapa no: hasta que
 * tocas el pin, el color va solo. Esta leyenda es lo que cumple la regla de
 * §17 —los estados nunca dependen solo del color— en la vista de mapa.
 */
const LEYENDA = [
  { color: COLOR.ok, texto: "Nuevo" },
  { color: COLOR.info, texto: "Tuyo" },
  { color: COLOR.aviso, texto: "De otro vendedor" },
  { color: COLOR.atenuado, texto: "Descartado" },
  { color: COLOR.marca, texto: "Elegido" },
];

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-borde bg-superficie px-3 py-2">
      {LEYENDA.map(({ color, texto }) => (
        <span
          key={texto}
          className="flex items-center gap-1.5 text-xs text-texto-secundario"
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {texto}
        </span>
      ))}
    </div>
  );
}

/** El color del pin dice en qué estado está el punto (§17). */
function colorDe(c: Candidato) {
  if (c.estado?.motivo_descarte) return COLOR.atenuado;
  if (c.estado?.es_mio) return COLOR.info;
  if (c.estado?.cuenta_id) return COLOR.aviso;
  return COLOR.ok;
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
  const listaId = useSearchParams().get("lista");
  const places = useMapsLibrary("places");

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [radio, setRadio] = useState(3000);
  const [texto, setTexto] = useState("");

  const [resultados, setResultados] = useState<Candidato[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elegidos, setElegidos] = useState<string[]>([]);
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

  async function buscar(modo: "cerca" | "texto") {
    if (!places) return;
    setError(null);
    setBuscando(true);
    setResultados(null);
    setElegidos([]);

    try {
      const tipos = categorias.flatMap((c) => [...CATEGORIAS[c].tipos]);
      // `userRatingCount` pertenece al tramo Enterprise de Places, más caro por
      // llamada pero con su propia cuota gratuita de 10.000 al mes. A este
      // volumen sigue costando cero, y sin ese número la lista es una fila de
      // nombres indistinguibles.
      const campos = ["id", "displayName", "location", "userRatingCount"];
      let encontrados: google.maps.places.Place[] = [];

      if (modo === "cerca") {
        if (!ubicacion) {
          setError("No hay ubicación. Activa el GPS o busca por texto.");
          setBuscando(false);
          return;
        }
        const { places: r } = await places.Place.searchNearby({
          fields: campos,
          locationRestriction: {
            center: { lat: ubicacion.lat, lng: ubicacion.lng },
            radius: radio,
          },
          includedPrimaryTypes: tipos.length > 0 ? tipos : undefined,
          maxResultCount: 20,
          rankPreference: places.SearchNearbyRankPreference.DISTANCE,
        });
        encontrados = r;
      } else {
        const { places: r } = await places.Place.searchByText({
          fields: campos,
          textQuery: texto,
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

      setResultados(await marcarEstados(lista));
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

    const filas = resultados
      .filter((c) => elegidos.includes(c.placeId))
      .map((c) => ({
        id: crypto.randomUUID(),
        nombre: c.nombre,
        place_id: c.placeId,
        lat: c.lat,
        lng: c.lng,
        origen: "busqueda",
        vendedor_id: user.id,
        // Sin `tipo`: entran sin clasificar. Agregarlas en tanda desde el
        // directorio no las convierte en prospectos, solo las pone en la cola
        // de lo que hay que ir a ver (D-015).
      }));

    const { error: fallo } = await supabase.from("cuentas").insert(filas);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    // Si venía armando una lista, los recién creados entran ahí. Sin esto los
    // cincuenta puntos del domingo caerían sueltos en la cartera, que es el
    // problema que las listas existen para resolver.
    if (listaId) {
      const { error: falloLista } = await supabase.from("listas_cuentas").insert(
        filas.map((f) => ({ lista_id: listaId, cuenta_id: f.id })),
      );

      if (falloLista) {
        setError(
          `Las cuentas quedaron creadas, pero no entraron a la lista: ${falloLista.message}`,
        );
        setGuardando(false);
        return;
      }
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

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-col gap-4">
        <Opciones
          etiqueta="Qué buscas"
          opciones={ETIQUETAS_CATEGORIA}
          valor={categorias}
          multiple
          onCambio={(c) =>
            setCategorias((a) =>
              a.includes(c) ? a.filter((x) => x !== c) : [...a, c],
            )
          }
        />

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
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-3">
        <Campo
          etiqueta="O busca un área o una marca"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          ayuda="Farmacias en Aguadulce · Supermercados Calle 50 · Banco General"
        />
        <Boton
          tono="secundario"
          ancho
          onClick={() => buscar("texto")}
          disabled={buscando || !places || texto.trim().length < 3}
        >
          <span className="flex items-center justify-center gap-2">
            <Search size={16} aria-hidden />
            Buscar por texto
          </span>
        </Boton>
      </Tarjeta>

      {error && <MensajeError titulo={error} />}
      {buscando && <Cargando texto="Buscando" />}

      {resultados?.length === 0 && (
        <Tarjeta>
          <Vacio titulo="Sin resultados">
            Prueba con otra categoría, más distancia, o escribe el área a mano.
          </Vacio>
        </Tarjeta>
      )}

      {resultados && resultados.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-texto">
              {resultados.length} encontrados
            </p>
            <div className="flex gap-1">
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

          <Leyenda />

          {/* Ordenar por reseñas es lo que separa un supermercado de 400 de
              una tienda de 12. Es el proxy de tráfico de §7.5. */}
          <div className="flex gap-2">
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
            <div className="h-[60vh] w-full overflow-hidden rounded-lg border border-borde">
              <MapaCandidatos
                candidatos={ordenados}
                abierto={abierto}
                onAbrir={setAbierto}
                sucursales={sucursales}
                contando={contando}
                onContarSucursales={contarSucursales}
                elegidos={elegidos}
                onElegir={(id) =>
                  setElegidos((a) =>
                    a.includes(id) ? a.filter((x) => x !== id) : [...a, id],
                  )
                }
              />
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
              : `Agregar ${elegidos.length} a mi cartera`}
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

function MapaCandidatos({
  candidatos,
  abierto,
  onAbrir,
  elegidos,
  onElegir,
  sucursales,
  contando,
  onContarSucursales,
}: {
  candidatos: Candidato[];
  abierto: Candidato | null;
  onAbrir: (c: Candidato | null) => void;
  elegidos: string[];
  onElegir: (placeId: string) => void;
  sucursales: Record<string, number>;
  contando: boolean;
  onContarSucursales: (c: Candidato) => void;
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
      disableDefaultUI
      zoomControl
      style={{ height: "100%", width: "100%" }}
    >
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

          {!abierto.estado?.cuenta_id && !abierto.estado?.motivo_descarte && (
            <button
              type="button"
              onClick={() => onElegir(abierto.placeId)}
              className="mt-1 block text-xs font-medium underline"
            >
              {elegidos.includes(abierto.placeId) ? "Quitar" : "Elegir"}
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

        {!yaEsProspecto && !descartado && (
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
