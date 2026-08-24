"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  LINEAS_PRODUCTO,
  TIPOS_PUNTO,
  VOLUMENES,
  type LineaProducto,
  type TipoPunto,
  type Volumen,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { CampoCadencia } from "@/components/campo-cadencia";
import { asegurarCategoria, CampoCategoria } from "@/components/campo-categoria";
import { CampoCoordenadas } from "@/components/campo-coordenadas";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

/**
 * Completar el expediente después.
 *
 * El alta pide solo nombre y ubicación, para que crear un prospecto frente al
 * mostrador tome segundos. Esa decisión solo funciona si existe este lugar
 * donde terminar de llenar los datos con calma.
 */
export default function EditarProspecto() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");
  const [tipoComercio, setTipoComercio] = useState("");
  const [productos, setProductos] = useState<LineaProducto[]>([]);
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [contactoWhatsapp, setContactoWhatsapp] = useState("");
  const [contactoCorreo, setContactoCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [volumen, setVolumen] = useState<Volumen | null>(null);
  const [direccion, setDireccion] = useState("");
  const [poblado, setPoblado] = useState("");
  const [tipoPunto, setTipoPunto] = useState<TipoPunto>("local");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [cadencia, setCadencia] = useState("");

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("cuentas")
      .select(
        "nombre, ruc, tipo_comercio, productos_interes, contacto_nombre, contacto_telefono, contacto_whatsapp, contacto_correo, notas, volumen, tipo_punto, direccion, poblado, lat, lng, dias_cadencia",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data, error: fallo }) => {
        if (fallo) setError(fallo.message);
        if (data) {
          setNombre(data.nombre ?? "");
          setRuc(data.ruc ?? "");
          setTipoComercio(data.tipo_comercio ?? "");
          setProductos((data.productos_interes as LineaProducto[]) ?? []);
          setContactoNombre(data.contacto_nombre ?? "");
          setContactoTelefono(data.contacto_telefono ?? "");
          setContactoWhatsapp(data.contacto_whatsapp ?? "");
          setContactoCorreo(data.contacto_correo ?? "");
          setNotas(data.notas ?? "");
          setVolumen((data.volumen as Volumen) ?? null);
          setDireccion(data.direccion ?? "");
          setPoblado(data.poblado ?? "");
          setTipoPunto((data.tipo_punto as TipoPunto) ?? "local");
          setLat(data.lat === null ? "" : String(data.lat));
          setLng(data.lng === null ? "" : String(data.lng));
          setCadencia(data.dias_cadencia ? String(data.dias_cadencia) : "");
        }
        setCargando(false);
      });
  }, [id]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    // Media coordenada no ubica nada, y guardarla dejaría la cuenta en un
    // estado que el mapa no sabe dibujar. O las dos o ninguna.
    const numLat = lat.trim() === "" ? null : Number(lat);
    const numLng = lng.trim() === "" ? null : Number(lng);

    if ((numLat === null) !== (numLng === null)) {
      setError("Las coordenadas van completas: latitud y longitud, o ninguna.");
      return;
    }

    if (
      (numLat !== null && (Number.isNaN(numLat) || Math.abs(numLat) > 90)) ||
      (numLng !== null && (Number.isNaN(numLng) || Math.abs(numLng) > 180))
    ) {
      setError("Esas coordenadas no existen. Revísalas o márcalas en el mapa.");
      return;
    }

    setGuardando(true);

    // La categoría escrita se suma al catálogo compartido, si es nueva, y
    // la cuenta se queda con la grafía del catálogo.
    const categoria = tipoComercio.trim()
      ? await asegurarCategoria(tipoComercio)
      : null;

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cuentas")
      .update({
        nombre: nombre.trim(),
        ruc: ruc.trim() || null,
        tipo_comercio: categoria,
        productos_interes: productos,
        contacto_nombre: contactoNombre.trim() || null,
        contacto_telefono: contactoTelefono.trim() || null,
        contacto_whatsapp: contactoWhatsapp.trim() || null,
        contacto_correo: contactoCorreo.trim() || null,
        notas: notas.trim() || null,
        volumen,
        tipo_punto: tipoPunto,
        direccion: direccion.trim() || null,
        poblado: poblado.trim() || null,
        lat: numLat,
        lng: numLng,
        dias_cadencia: cadencia ? Number(cadencia) : null,
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/cuentas/${id}`);
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/${id}`} />
        <h1 className="text-lg font-semibold text-marca">Editar cuenta</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {cargando && <Cargando />}

        {!cargando && (
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <Tarjeta className="flex flex-col gap-4">
              <Campo
                etiqueta="Nombre del negocio"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <Campo
                etiqueta="RUC"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                ayuda="Hace falta antes de facturar."
              />
              <CampoCategoria valor={tipoComercio} onCambio={setTipoComercio} />
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-4">
              <Opciones
                etiqueta="Volumen de venta"
                opciones={VOLUMENES}
                valor={volumen}
                onCambio={setVolumen}
                ayuda="Tu estimación de cuánto puede comprar esta cuenta."
              />

              <CampoCadencia valor={cadencia} onCambio={setCadencia} />
            </Tarjeta>

            {/* La oficina de negociación no es una tienda: no vende, no recibe
                entregas y no hace pedidos. Marcarla como local la metería en
                las rutas de reparto, donde no pinta nada. */}
            <Tarjeta>
              <Opciones
                etiqueta="¿Qué es este punto?"
                opciones={TIPOS_PUNTO}
                valor={tipoPunto}
                onCambio={setTipoPunto}
                ayuda="Casi siempre es un local. Oficina es donde se negocia el acuerdo de una cadena."
              />
            </Tarjeta>

            {/* Dónde queda la cuenta, las tres formas juntas: para el mapa las
                coordenadas, para llegar la dirección, para agrupar el poblado. */}
            <Tarjeta className="flex flex-col gap-4">
              <CampoCoordenadas
                cuentaId={id}
                lat={lat}
                lng={lng}
                onCambio={(nuevaLat, nuevaLng) => {
                  setLat(nuevaLat);
                  setLng(nuevaLng);
                }}
              />
              <Campo
                etiqueta="Dirección"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                ayuda="Cómo se llega. Las coordenadas sirven al mapa, esto a la gente."
              />
              <Campo
                etiqueta="Poblado o distrito"
                value={poblado}
                onChange={(e) => setPoblado(e.target.value)}
                ayuda="Aguadulce, La Chorrera, David. Permite agrupar la cartera por zona."
              />
            </Tarjeta>

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
                etiqueta="WhatsApp"
                type="tel"
                inputMode="tel"
                value={contactoWhatsapp}
                onChange={(e) => setContactoWhatsapp(e.target.value)}
              />
              <Campo
                etiqueta="Correo"
                type="email"
                inputMode="email"
                value={contactoCorreo}
                onChange={(e) => setContactoCorreo(e.target.value)}
              />
              <Campo
                etiqueta="Notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </Tarjeta>

            {error && (
              <MensajeError titulo="No se pudo guardar" detalle={error} />
            )}

            <Boton type="submit" ancho disabled={guardando || !nombre.trim()}>
              {guardando ? "Guardando" : "Guardar cambios"}
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}
