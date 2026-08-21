"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

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

  useEffect(() => {
    const supabase = clienteNavegador();
    supabase
      .from("prospectos")
      .select(
        "nombre, ruc, tipo_comercio, productos_interes, contacto_nombre, contacto_telefono, contacto_whatsapp, contacto_correo, notas",
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
        }
        setCargando(false);
      });
  }, [id]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("prospectos")
      .update({
        nombre: nombre.trim(),
        ruc: ruc.trim() || null,
        tipo_comercio: tipoComercio.trim() || null,
        productos_interes: productos,
        contacto_nombre: contactoNombre.trim() || null,
        contacto_telefono: contactoTelefono.trim() || null,
        contacto_whatsapp: contactoWhatsapp.trim() || null,
        contacto_correo: contactoCorreo.trim() || null,
        notas: notas.trim() || null,
      })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/prospectos/${id}`);
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <Link href={`/prospectos/${id}`} className="text-sm text-texto-secundario">
          Volver
        </Link>
        <h1 className="text-lg font-semibold text-marca">Editar prospecto</h1>
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
              <Campo
                etiqueta="Tipo de comercio"
                value={tipoComercio}
                onChange={(e) => setTipoComercio(e.target.value)}
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
