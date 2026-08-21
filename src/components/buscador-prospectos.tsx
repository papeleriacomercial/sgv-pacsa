"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Check, MapPin, Search, X } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { obtenerUbicacion, type Ubicacion } from "@/lib/gps";
import {
  CATEGORIAS,
  ETAPAS,
  ETIQUETAS_CATEGORIA,
  MOTIVOS_DESCARTE,
  TONO_ETAPA,
  type Categoria,
  type Etapa,
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

type Estado = {
  place_id: string;
  prospecto_id: string | null;
  es_mio: boolean | null;
  vendedor: string | null;
  etapa: Etapa | null;
  ultima_visita: string | null;
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
  estado: Estado | null;
};

const FECHA = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "medium",
  timeZone: "America/Panama",
});

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
  const places = useMapsLibrary("places");

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [radio, setRadio] = useState(3000);
  const [texto, setTexto] = useState("");

  const [resultados, setResultados] = useState<Candidato[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elegidos, setElegidos] = useState<string[]>([]);
  const [descartando, setDescartando] = useState<Candidato | null>(null);
  const [guardando, setGuardando] = useState(false);

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
      const campos = ["id", "displayName", "location"];
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
        });
        encontrados = r;
      }

      const lista: Candidato[] = encontrados
        .filter((p) => p.id && p.location)
        .map((p) => ({
          placeId: p.id!,
          nombre: p.displayName ?? "Sin nombre",
          lat: p.location!.lat(),
          lng: p.location!.lng(),
          distanciaM: ubicacion
            ? distancia(ubicacion, p.location!.lat(), p.location!.lng())
            : null,
        }))
        // Ordenada por cercanía: es lo que convierte la lista en una ruta.
        .sort((a, b) => (a.distanciaM ?? 0) - (b.distanciaM ?? 0))
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
      }));

    const { error: fallo } = await supabase.from("prospectos").insert(filas);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.push("/");
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
            <p className="text-xs text-texto-secundario">
              Ordenados por cercanía
            </p>
          </div>

          {resultados.map((c) => (
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
            />
          ))}
        </>
      )}

      {elegidos.length > 0 && (
        <div className="sticky bottom-16 z-10">
          <Boton ancho onClick={agregarElegidos} disabled={guardando}>
            {guardando
              ? "Agregando"
              : `Agregar ${elegidos.length} a mis prospectos`}
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

function Resultado({
  candidato,
  elegido,
  onElegir,
  onDescartar,
}: {
  candidato: Candidato;
  elegido: boolean;
  onElegir: () => void;
  onDescartar: () => void;
}) {
  const e = candidato.estado;
  const yaEsProspecto = e?.prospecto_id != null;
  const descartado = e?.motivo_descarte != null;

  return (
    <Tarjeta
      className={`flex flex-col gap-2 ${elegido ? "border-marca" : ""} ${
        descartado ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-base font-semibold text-texto">{candidato.nombre}</p>
          {candidato.distanciaM !== null && (
            <p className="flex items-center gap-1 font-mono text-xs text-texto-secundario">
              <MapPin size={12} aria-hidden />
              {candidato.distanciaM < 1000
                ? `${candidato.distanciaM} m`
                : `${(candidato.distanciaM / 1000).toFixed(1)} km`}
            </p>
          )}
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
        {!yaEsProspecto && !descartado && <Insignia tono="ok">Nuevo</Insignia>}

        {yaEsProspecto && e?.es_mio && (
          <>
            <Insignia tono={TONO_ETAPA[e.etapa as Etapa]}>
              {`Tuyo · ${ETAPAS[e.etapa as Etapa]}`}
            </Insignia>
            {e.prospecto_id && (
              <Link
                href={`/prospectos/${e.prospecto_id}`}
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

      {e?.ultima_visita && (
        <p className="text-xs text-texto-secundario">
          Última visita {FECHA.format(new Date(e.ultima_visita))}
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
