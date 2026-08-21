"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/**
 * Una oportunidad es un punto más una línea de producto. Se separan del
 * prospecto porque un mismo local puede comprar rollos fiscales y no bolsas, y
 * cada negociación avanza a su ritmo. Es lo que permite medir la tasa de
 * cierre por producto (§7.3).
 */
export default function NuevaOportunidad() {
  const router = useRouter();
  const { id: prospectoId } = useParams<{ id: string }>();

  const [linea, setLinea] = useState<LineaProducto | null>(null);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    if (!linea) return;
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

    const { error: fallo } = await supabase.from("oportunidades").insert({
      id: crypto.randomUUID(),
      prospecto_id: prospectoId,
      vendedor_id: user.id,
      linea,
      monto_estimado: monto ? Number(monto) : null,
      descripcion: descripcion.trim() || null,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/prospectos/${prospectoId}`);
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <Link
          href={`/prospectos/${prospectoId}`}
          className="text-sm text-texto-secundario"
        >
          Volver
        </Link>
        <h1 className="text-lg font-semibold text-marca">Nueva oportunidad</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <form onSubmit={crear} className="flex flex-col gap-4">
          <Tarjeta>
            <Opciones
              etiqueta="Línea de producto"
              opciones={LINEAS_PRODUCTO}
              valor={linea}
              onCambio={setLinea}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <Campo
              etiqueta="Monto estimado"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              ayuda="Lo que crees que compra al mes. Un estimado sirve; en blanco, no."
            />
            <Campo
              etiqueta="Detalle"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              ayuda="Cantidad, presentación, lo que aplique."
            />
          </Tarjeta>

          {error && <MensajeError titulo="No se pudo crear" detalle={error} />}

          <Boton type="submit" ancho disabled={guardando || !linea}>
            {guardando ? "Creando" : "Crear oportunidad"}
          </Boton>
        </form>
      </main>
    </>
  );
}
