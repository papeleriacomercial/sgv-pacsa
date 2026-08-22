"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

/**
 * Una oportunidad es un punto más una línea de producto. Se separan del
 * prospecto porque un mismo local puede comprar rollos fiscales y no bolsas, y
 * cada negociación avanza a su ritmo. Es lo que permite medir la tasa de
 * cierre por producto (§7.3).
 */
export default function NuevaOportunidad() {
  const router = useRouter();
  const { id: prospectoId } = useParams<{ id: string }>();

  const [nombre, setNombre] = useState("");
  const [linea, setLinea] = useState<LineaProducto | null>(null);
  const [fechaCierre, setFechaCierre] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    if (!linea || !nombre.trim()) return;
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
      cuenta_id: prospectoId,
      vendedor_id: user.id,
      nombre: nombre.trim(),
      linea,
      fecha_cierre_estimada: fechaCierre || null,
      monto_estimado: monto ? Number(monto) : null,
      descripcion: descripcion.trim() || null,
    });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.replace(`/cuentas/${prospectoId}`);
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/`} />
        <h1 className="text-lg font-semibold text-marca">Nueva oportunidad</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <form onSubmit={crear} className="flex flex-col gap-4">
          <Tarjeta className="flex flex-col gap-4">
            <Campo
              etiqueta="Nombre de la oportunidad"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              ayuda="Qué se está vendiendo. Ej: 100 cajas de rollos térmicos 80mm."
            />
            <Campo
              etiqueta="Fecha estimada de cierre"
              type="date"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              ayuda="Cuándo esperas cerrarla. Si se vence, la oportunidad se congela hasta que la muevas."
            />
          </Tarjeta>

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

          <Boton type="submit" ancho disabled={guardando || !linea || !nombre.trim()}>
            {guardando ? "Creando" : "Crear oportunidad"}
          </Boton>
        </form>
      </main>
    </>
  );
}
