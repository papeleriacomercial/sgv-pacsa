"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  AYUDA_CLASE,
  CLASES_VENTA,
  TIPOS_LISTA,
  type ClaseVenta,
  type TipoLista,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

export default function NuevaLista() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoLista>("zona");
  const [clase, setClase] = useState<ClaseVenta | null>(null);
  const [poblado, setPoblado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nombre.trim()) return;
    setError(null);
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

    const id = crypto.randomUUID();

    const { error: fallo } = await supabase.from("listas").insert({
      id,
      vendedor_id: user.id,
      nombre: nombre.trim(),
      tipo,
      clase,
      poblado: tipo === "zona" ? poblado.trim() || null : null,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/listas/${id}`);
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/listas" />
        <h1 className="text-lg font-semibold text-marca">Nueva lista</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <form onSubmit={crear} className="flex flex-col gap-4">
          <Tarjeta className="flex flex-col gap-4">
            <Campo
              etiqueta="Nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              ayuda="Cómo la vas a reconocer: “Aguadulce”, “Panaderías Calle 50”, “Banca corporativa”."
            />

            <Opciones
              etiqueta="Qué clase de lista es"
              opciones={TIPOS_LISTA}
              valor={tipo}
              onCambio={setTipo}
              ayuda="Zona: se arma barriendo el mapa. Objetivos: se arma por nombre, uno ya sabe cuáles son."
            />

            {tipo === "zona" && (
              <Campo
                etiqueta="Poblado o zona"
                value={poblado}
                onChange={(e) => setPoblado(e.target.value)}
                ayuda="Opcional. Sirve para ordenar la ruta por cercanía."
              />
            )}
          </Tarjeta>

          {/* Lo que espera al armarla, no lo que resultó. Es lo que le permite
              planificar la mezcla antes de levantar el teléfono. */}
          <Tarjeta>
            <Opciones
              etiqueta="¿Qué esperas de esta lista?"
              opciones={CLASES_VENTA}
              valor={clase}
              onCambio={setClase}
              ayuda="Opcional. La misma categoría puede ser de las dos: un supermercado de tres tiendas cierra en semanas, uno corporativo tarda meses."
            />
            {clase && (
              <p className="mt-2 text-xs text-texto-atenuado">
                {AYUDA_CLASE[clase]}
              </p>
            )}
          </Tarjeta>

          {error && <MensajeError titulo="No se pudo crear" detalle={error} />}

          <Boton type="submit" ancho disabled={guardando || !nombre.trim()}>
            {guardando ? "Creando" : "Crear lista"}
          </Boton>
        </form>
      </main>
    </>
  );
}
