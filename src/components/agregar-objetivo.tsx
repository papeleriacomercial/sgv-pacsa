"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

/**
 * Escribir un objetivo en una lista, sin pasar por el mapa.
 *
 * **Por qué no sirve la búsqueda aquí.** El líder que arma una lista de bancos
 * escribe «Banco General» y la búsqueda le devuelve sucursales. Él no quiere
 * una sucursal: quiere llegar a alguien en la oficina central. La sucursal ni
 * decide ni compra — es el caso que el motivo de descarte «se negocia en
 * Panamá» ya había señalado desde el otro lado.
 *
 * **Lo único obligatorio es el nombre.** Ese es el punto: el objetivo entra en
 * cuanto se decide ir por él, aunque no se sepa nada más. Lo demás son cuatro
 * campos que casi siempre están vacíos al principio y se llenan a medida que
 * los averigua — y esa lista de huecos es su tarea de investigación, escrita
 * sola.
 */
export function AgregarObjetivo({
  listaId,
  ejemplo,
}: {
  listaId: string;
  /** Un nombre de muestra acorde a la lista, para no arrancar en blanco. */
  ejemplo: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");

  function limpiar() {
    setNombre("");
    setDireccion("");
    setContacto("");
    setTelefono("");
    setCorreo("");
    setError(null);
  }

  async function guardar() {
    if (nombre.trim().length < 2) return;
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Se cerró la sesión. Vuelve a entrar.");
      setGuardando(false);
      return;
    }

    // El identificador se genera aquí, no en la base (§16).
    const id = crypto.randomUUID();

    const { error: fallo } = await supabase.from("cuentas").insert({
      id,
      nombre: nombre.trim(),
      // Sin coordenadas y a propósito: un objetivo no está en el mapa hasta
      // que se sepa a qué oficina hay que ir, y a veces nunca lo está.
      direccion: direccion.trim() || null,
      contacto_nombre: contacto.trim() || null,
      contacto_telefono: telefono.trim() || null,
      contacto_correo: correo.trim() || null,
      origen: "objetivo",
      // Oficina y no local: no entra a rutas de reparto, aquí solo se negocia.
      tipo_punto: "oficina",
      vendedor_id: user.id,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    const { error: falloLista } = await supabase
      .from("listas_cuentas")
      .insert({ lista_id: listaId, cuenta_id: id });

    if (falloLista) {
      setError(falloLista.message);
      setGuardando(false);
      return;
    }

    // Se queda abierto: armar una lista de objetivos es escribir seis o siete
    // seguidos, y cerrar el formulario en cada uno obliga a seis toques de más.
    limpiar();
    setGuardando(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg bg-marca px-3 text-base font-medium text-white"
      >
        <Plus size={18} aria-hidden />
        Agregar un objetivo
      </button>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      <Campo
        etiqueta="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={ejemplo}
        ayuda="Lo único que hace falta para empezar."
      />

      <p className="text-xs text-texto-atenuado">
        Lo de abajo es lo que tienes que averiguar. Déjalo vacío si todavía no
        lo sabes y vuelve a llenarlo cuando lo consigas.
      </p>

      <Campo
        etiqueta="Dónde queda la oficina"
        value={direccion}
        onChange={(e) => setDireccion(e.target.value)}
        placeholder="Torre Banco General, Calle Aquilino de la Guardia"
      />
      <Campo
        etiqueta="Con quién hay que hablar"
        value={contacto}
        onChange={(e) => setContacto(e.target.value)}
        placeholder="Jefe de compras, nombre si lo sabes"
      />
      <Campo
        etiqueta="Teléfono"
        type="tel"
        inputMode="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <Campo
        etiqueta="Correo"
        type="email"
        inputMode="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
      />

      {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

      <div className="grid grid-cols-2 gap-2">
        <Boton
          tono="secundario"
          onClick={() => {
            limpiar();
            setAbierto(false);
          }}
          disabled={guardando}
        >
          Cerrar
        </Boton>
        <Boton onClick={guardar} disabled={guardando || nombre.trim().length < 2}>
          {guardando ? "Guardando" : "Agregar"}
        </Boton>
      </div>
    </Tarjeta>
  );
}
