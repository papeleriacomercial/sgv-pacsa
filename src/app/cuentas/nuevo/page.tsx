"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, MapPinOff } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar } from "@/lib/cola";
import { obtenerUbicacion, calidadUbicacion, type Ubicacion } from "@/lib/gps";
import {
  LINEAS_PRODUCTO,
  ORIGENES,
  type LineaProducto,
  type Origen,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { asegurarCategoria, CampoCategoria } from "@/components/campo-categoria";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

type Duplicado = {
  id: string;
  nombre: string;
  vendedor: string;
  es_mio: boolean;
  distancia_m: number | null;
  coincide_por: string;
};

const POR_QUE: Record<string, string> = {
  place_id: "es el mismo punto",
  ruc: "mismo RUC",
  cercania: "a pocos metros",
  nombre: "nombre parecido",
};

export default function NuevaCuenta() {
  return (
    <Suspense fallback={<Cargando />}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();

  // Cuando el vendedor llega tocando un local en el mapa, el candidato viene
  // en la dirección: el `place_id`, la ubicación de Google y el nombre como
  // sugerencia. El nombre solo se vuelve dato propio cuando él lo confirma
  // aquí, que es lo que permiten los términos de Maps (§7.4).
  const parametros = useSearchParams();
  const placeId = parametros.get("place_id");
  const latDelMapa = parametros.get("lat");
  const lngDelMapa = parametros.get("lng");
  const vieneDelMapa = placeId !== null && latDelMapa !== null;
  // Si el punto se escogió armando una lista, la cuenta entra ahí al crearse.
  const listaId = parametros.get("lista");

  const [nombre, setNombre] = useState(parametros.get("nombre") ?? "");
  const [ruc, setRuc] = useState("");
  const [tipoComercio, setTipoComercio] = useState("");
  const [productos, setProductos] = useState<LineaProducto[]>([]);
  const [origen, setOrigen] = useState<Origen>(vieneDelMapa ? "busqueda" : "calle");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [notas, setNotas] = useState("");

  // Si el punto vino del mapa ya trae la ubicación de Google, así que el
  // estado nace con ella y no hay nada que buscar.
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(
    vieneDelMapa
      ? { lat: Number(latDelMapa), lng: Number(lngDelMapa), precisionM: 0 }
      : null,
  );
  const [buscandoGps, setBuscandoGps] = useState(!vieneDelMapa);

  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [ignorarDuplicados, setIgnorarDuplicados] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Cuál de los dos caminos se tocó. Se guarda en estado porque el aviso de
  // duplicados corta el primer envío, y al segundo hay que recordar a dónde iba.
  const [conVisita, setConVisita] = useState(false);

  // La ubicación se pide sola al abrir. El vendedor no tiene que acordarse.
  useEffect(() => {
    if (vieneDelMapa) return;

    obtenerUbicacion().then((leida) => {
      setUbicacion(leida);
      setBuscandoGps(false);
    });
  }, [vieneDelMapa]);

  async function revisarDuplicados() {
    if (nombre.trim().length < 4 && !ubicacion) return;

    const supabase = clienteNavegador();
    const { data } = await supabase.rpc("buscar_duplicados", {
      p_nombre: nombre.trim() || null,
      p_lat: ubicacion?.lat ?? null,
      p_lng: ubicacion?.lng ?? null,
      p_ruc: ruc.trim() || null,
      p_place_id: placeId,
    });

    setDuplicados((data as Duplicado[]) ?? []);
    setIgnorarDuplicados(false);
  }

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    // El aviso no bloquea: advierte una vez y deja decidir. Un bloqueo duro
    // frente al mostrador, con un falso positivo, vuelve la app un obstáculo.
    if (duplicados.length > 0 && !ignorarDuplicados) {
      setIgnorarDuplicados(true);
      return;
    }

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

    // La categoría escrita se suma al catálogo compartido, si es nueva, y
    // la cuenta se queda con la grafía del catálogo: si allí dice
    // «Panadería», no se guarda «panaderia» aunque se haya tecleado así.
    const categoria = tipoComercio.trim()
      ? await asegurarCategoria(tipoComercio)
      : null;

    // El id se genera aquí, no en la base: el celular tiene que poder crear
    // registros sin conexión y sincronizarlos después sin renumerar nada.
    const id = crypto.randomUUID();

    const { error: fallo } = await insertar("cuentas", {
      id,
      nombre: nombre.trim(),
      ruc: ruc.trim() || null,
      tipo_comercio: categoria,
      productos_interes: productos,
      origen,
      contacto_nombre: contactoNombre.trim() || null,
      contacto_telefono: contactoTelefono.trim() || null,
      notas: notas.trim() || null,
      lat: ubicacion?.lat ?? null,
      lng: ubicacion?.lng ?? null,
      // Lo único de Google Places que puede guardarse indefinidamente.
      place_id: placeId,
      vendedor_id: user.id,
      // No se manda `tipo`: la base la crea `sin_clasificar`. Llamarla
      // prospecto antes de que alguien la vea afirma algo que no ocurrió.
    }, `Cuenta nueva: ${nombre.trim()}`);

    if (fallo) {
      setError(fallo);
      setGuardando(false);
      return;
    }

    if (listaId) {
      await supabase
        .from("listas_cuentas")
        .insert({ lista_id: listaId, cuenta_id: id });
    }

    // Los dos caminos crean la misma cuenta sin clasificar; lo que cambia es a
    // dónde lleva. Desde la calle se sigue derecho a registrar la visita, que
    // es la que decide si es prospecto o se descarta.
    router.replace(conVisita ? `/cuentas/${id}/seguimiento` : `/cuentas/${id}`);
    router.refresh();
  }

  const calidad = ubicacion ? calidadUbicacion(ubicacion.precisionM) : null;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver />
        <h1 className="text-lg font-semibold text-marca">Nueva cuenta</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <Tarjeta>
          <div className="flex items-center gap-2">
            {ubicacion ? (
              <MapPin size={18} className="text-ok" aria-hidden />
            ) : (
              <MapPinOff size={18} className="text-aviso" aria-hidden />
            )}
            <div className="flex-1">
              {buscandoGps && (
                <p className="text-sm text-texto-secundario">
                  Buscando ubicación
                </p>
              )}
              {!buscandoGps && vieneDelMapa && (
                <Insignia tono="ok">Ubicación tomada del mapa</Insignia>
              )}
              {!buscandoGps && !vieneDelMapa && calidad && (
                <Insignia tono={calidad.tono}>{calidad.texto}</Insignia>
              )}
              {!buscandoGps && !ubicacion && (
                <>
                  <p className="text-sm font-medium text-texto">Sin ubicación</p>
                  <p className="text-xs text-texto-secundario">
                    Puedes guardar igual. El prospecto queda marcado para
                    ubicarlo después.
                  </p>
                </>
              )}
            </div>
          </div>
        </Tarjeta>

        <form onSubmit={crear} className="flex flex-col gap-4">
          <Tarjeta className="flex flex-col gap-4">
            <Campo
              etiqueta="Nombre del negocio"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={revisarDuplicados}
              ayuda="Es lo único obligatorio. Lo demás se completa después."
            />

            <Campo
              etiqueta="RUC"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              onBlur={revisarDuplicados}
              ayuda="Si lo tienes a mano. Hace falta antes de facturar."
            />

            <CampoCategoria valor={tipoComercio} onCambio={setTipoComercio} />
          </Tarjeta>

          {duplicados.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                {duplicados.length === 1
                  ? "Este punto podría estar registrado"
                  : "Hay puntos parecidos registrados"}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {duplicados.map((d) => (
                  <li key={d.id} className="text-sm text-amber-800">
                    <span className="font-medium">{d.nombre}</span>
                    {" — "}
                    {d.es_mio ? "es tuyo" : `asignado a ${d.vendedor}`}
                    <span className="text-xs">
                      {" ("}
                      {POR_QUE[d.coincide_por] ?? d.coincide_por}
                      {d.distancia_m !== null && `, ${d.distancia_m} m`}
                      {")"}
                    </span>
                    {d.es_mio && (
                      <Link
                        href={`/cuentas/${d.id}`}
                        className="ml-2 underline"
                      >
                        Ver
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {ignorarDuplicados && (
                <p className="mt-2 text-xs text-amber-800">
                  Toca Crear de nuevo para registrarlo de todos modos.
                </p>
              )}
            </div>
          )}

          <Tarjeta>
            <Opciones
              etiqueta="Productos de interés"
              opciones={LINEAS_PRODUCTO}
              valor={productos}
              multiple
              onCambio={(linea) =>
                setProductos((antes) =>
                  antes.includes(linea)
                    ? antes.filter((l) => l !== linea)
                    : [...antes, linea],
                )
              }
            />
          </Tarjeta>

          <Tarjeta>
            <Opciones
              etiqueta="Cómo lo encontraste"
              opciones={ORIGENES}
              valor={origen}
              onCambio={setOrigen}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <Campo
              etiqueta="Contacto"
              value={contactoNombre}
              onChange={(e) => setContactoNombre(e.target.value)}
              ayuda="Quién decide la compra."
            />
            <Campo
              etiqueta="Teléfono"
              type="tel"
              inputMode="tel"
              value={contactoTelefono}
              onChange={(e) => setContactoTelefono(e.target.value)}
            />
            <Campo
              etiqueta="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Tarjeta>

          {error && <MensajeError titulo="No se pudo crear" detalle={error} />}

          {/* Los dos caminos por los que nace una cuenta, cada uno con su botón.
              En la calle, parado frente al local, lo que sigue es contar cómo
              fue. En la oficina, planificando sobre el mapa, no ha pasado nada
              todavía y forzar un resultado sería inventarlo. */}
          <div className="flex flex-col gap-2">
            <Boton
              type="submit"
              ancho
              disabled={guardando || !nombre.trim()}
              onClick={() => setConVisita(true)}
            >
              {guardando && conVisita ? "Creando" : "Crear y registrar visita"}
            </Boton>
            <Boton
              type="submit"
              tono="secundario"
              ancho
              disabled={guardando || !nombre.trim()}
              onClick={() => setConVisita(false)}
            >
              {guardando && !conVisita ? "Creando" : "Crear solamente"}
            </Boton>
            <p className="text-xs text-texto-atenuado">
              Si estás frente al local, registra la visita ahora. Si la estás
              poniendo en el mapa para ir después, queda sin clasificar hasta
              que alguien la trabaje.
            </p>
          </div>
        </form>
      </main>
    </>
  );
}
