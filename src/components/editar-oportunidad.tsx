"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import {
  ETAPAS,
  LINEAS_PRODUCTO,
  MOTIVOS_PERDIDA,
  MOTIVOS_CON_RECONTACTO,
  type Etapa,
  type LineaProducto,
  type MotivoPerdida,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

export type Oportunidad = {
  id: string;
  cuenta_id: string;
  nombre: string;
  linea: LineaProducto;
  descripcion: string | null;
  monto_estimado: string | number | null;
  etapa: Etapa;
  motivo_perdida: MotivoPerdida | null;
  fecha_recontacto: string | null;
  fecha_cierre_estimada: string | null;
};

export function EditarOportunidad({
  oportunidad,
  vencida,
}: {
  oportunidad: Oportunidad;
  vencida: boolean;
}) {
  const router = useRouter();

  const [nombre, setNombre] = useState(oportunidad.nombre);
  const [linea, setLinea] = useState<LineaProducto>(oportunidad.linea);
  const [monto, setMonto] = useState(
    oportunidad.monto_estimado ? String(oportunidad.monto_estimado) : "",
  );
  const [descripcion, setDescripcion] = useState(oportunidad.descripcion ?? "");
  const [etapa, setEtapa] = useState<Etapa>(oportunidad.etapa);
  const [motivo, setMotivo] = useState<MotivoPerdida | null>(
    oportunidad.motivo_perdida,
  );
  const [fechaRecontacto, setFechaRecontacto] = useState(
    oportunidad.fecha_recontacto ?? "",
  );
  const [fechaCierre, setFechaCierre] = useState(
    oportunidad.fecha_cierre_estimada ?? "",
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esPerdida = etapa === "perdido";
  const cerrandola = esPerdida || etapa === "ganado";
  const exigeFecha =
    esPerdida && motivo !== null && MOTIVOS_CON_RECONTACTO.includes(motivo);

  // La misma regla que impone la base, comprobada antes de chocar con ella.
  const fechaMovida = fechaCierre > hoyEnPanama();
  const listo =
    nombre.trim() !== "" &&
    (!esPerdida || motivo !== null) &&
    (!exigeFecha || fechaRecontacto !== "") &&
    (!vencida || fechaMovida || cerrandola);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!listo) return;
    setError(null);
    setGuardando(true);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("oportunidades")
      .update({
        nombre: nombre.trim(),
        linea,
        monto_estimado: monto ? Number(monto) : null,
        descripcion: descripcion.trim() || null,
        etapa,
        motivo_perdida: esPerdida ? motivo : null,
        fecha_recontacto: exigeFecha ? fechaRecontacto : null,
        fecha_cierre_estimada: fechaCierre || null,
      })
      .eq("id", oportunidad.id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    router.refresh();
    setGuardando(false);
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      {/* La oportunidad vencida se congela: obliga a volver a comprometerse con
          una fecha en vez de arrastrarla muerta en el pipeline. Cerrarla como
          ganada o perdida sí se permite, para no tener que inventar una fecha
          futura solo para registrar que se perdió. */}
      {vencida && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <p className="text-sm font-medium">Esta oportunidad está vencida</p>
          <p className="text-xs">
            Pasó su fecha estimada de cierre. Muévela a una fecha futura para
            poder editarla, o ciérrala como ganada o perdida.
          </p>
        </div>
      )}

      <Tarjeta className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre de la oportunidad"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Campo
          etiqueta="Fecha estimada de cierre"
          type="date"
          value={fechaCierre}
          onChange={(e) => setFechaCierre(e.target.value)}
          error={
            vencida && !fechaMovida && !cerrandola
              ? "Elige una fecha futura para desbloquear la edición."
              : undefined
          }
        />
      </Tarjeta>

      <Tarjeta>
        <Opciones
          etiqueta="Etapa"
          opciones={ETAPAS}
          valor={etapa}
          onCambio={(nueva) => {
            setEtapa(nueva);
            if (nueva !== "perdido") {
              setMotivo(null);
              setFechaRecontacto("");
            }
          }}
        />
      </Tarjeta>

      {esPerdida && (
        <Tarjeta>
          <Opciones
            etiqueta="Motivo de la pérdida"
            opciones={MOTIVOS_PERDIDA}
            valor={motivo}
            onCambio={(nuevo) => {
              setMotivo(nuevo);
              if (!MOTIVOS_CON_RECONTACTO.includes(nuevo)) setFechaRecontacto("");
            }}
            ayuda="Obligatorio. Sin motivo, la base no deja marcarla como perdida."
          />
        </Tarjeta>
      )}

      {exigeFecha && (
        <Tarjeta>
          <Campo
            etiqueta="Fecha de recontacto"
            type="date"
            required
            min={hoyEnPanama()}
            value={fechaRecontacto}
            onChange={(e) => setFechaRecontacto(e.target.value)}
            ayuda="Este motivo no cierra la venta, la aplaza."
          />
        </Tarjeta>
      )}

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
        />
        <Campo
          etiqueta="Detalle"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </Tarjeta>

      {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

      <Boton type="submit" ancho disabled={guardando || !listo}>
        {guardando ? "Guardando" : "Guardar oportunidad"}
      </Boton>
    </form>
  );
}
