"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Store } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { TIPOS_PUNTO, type TipoPunto } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";

type Fila = { id: string; nombre: string };

/**
 * La cuenta dentro de su cadena.
 *
 * Starbucks es **un cliente con diez puntos**, no once clientes. Creadas como
 * cuentas sueltas inflan la cartera y arruinan la tasa de conversión: el
 * líder aparecería ganando once clientes nuevos donde negoció una vez.
 *
 * Las dos son cuentas de verdad —la tienda tiene dirección e historia, la
 * madre tiene RUC y contrato— así que basta con que una cuelgue de otra.
 *
 * **Quién puede colgar:** el vendedor sobre sus propias cuentas, porque nadie
 * más sabe que la tienda que acaba de visitar pertenece a la cadena que él
 * atiende. Una cadena nacional cruza territorios —la madre es del líder,
 * Multiplaza del de ciudad, Santiago del interior— y ahí el RLS no deja ver la
 * madre ajena: esos los engancha el líder, que es quien negocia las cadenas.
 */
export function CadenaCuenta({
  id,
  cuentaMadreId,
  tipoPunto,
}: {
  id: string;
  cuentaMadreId: string | null;
  tipoPunto: TipoPunto;
}) {
  const router = useRouter();
  const [madre, setMadre] = useState<Fila | null>(null);
  const [sucursales, setSucursales] = useState<Fila[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [candidatas, setCandidatas] = useState<Fila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = clienteNavegador();

    // Se consulta siempre y se resuelve a null en el callback: limpiar el
    // estado aquí mismo sería un setState síncrono dentro del efecto.
    supabase
      .from("cuentas")
      .select("id, nombre")
      .eq("id", cuentaMadreId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle()
      .then(({ data }) => setMadre(cuentaMadreId ? ((data as Fila) ?? null) : null));

    supabase
      .from("cuentas")
      .select("id, nombre")
      .eq("cuenta_madre_id", id)
      .is("deleted_at", null)
      .order("nombre")
      .then(({ data }) => setSucursales((data ?? []) as Fila[]));
  }, [id, cuentaMadreId]);

  async function abrirSelector() {
    setEligiendo(true);
    const supabase = clienteNavegador();

    // Solo las que podrían ser madre: no ella misma, no las que ya cuelgan de
    // alguien, y las oficinas primero porque es lo normal en una cadena.
    const { data } = await supabase
      .from("cuentas")
      .select("id, nombre, tipo_punto")
      .neq("id", id)
      .is("cuenta_madre_id", null)
      .is("deleted_at", null)
      .order("tipo_punto", { ascending: false })
      .order("nombre")
      .limit(50);

    setCandidatas((data ?? []) as Fila[]);
  }

  async function colgarDe(madreId: string | null) {
    setGuardando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase
      .from("cuentas")
      .update({ cuenta_madre_id: madreId })
      .eq("id", id);

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setEligiendo(false);
    setGuardando(false);
    router.refresh();
  }

  // Una oficina de negociación con sucursales colgando: es la cabeza de una
  // cadena y conviene que se vea como tal.
  const esCabeza = sucursales.length > 0;

  if (eligiendo) {
    return (
      <Tarjeta className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-texto">
            ¿De qué cuenta forma parte?
          </p>
          <p className="text-xs text-texto-secundario">
            La cuenta madre es donde vive el contrato. Si no aparece aquí,
            probablemente sea de otro vendedor: eso lo engancha el líder.
          </p>
        </div>

        {candidatas.length === 0 && (
          <p className="text-xs text-texto-atenuado">
            No hay otras cuentas tuyas que puedan ser madre.
          </p>
        )}

        {candidatas.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={guardando}
            onClick={() => colgarDe(c.id)}
            className="min-h-tactil rounded-lg border border-borde bg-superficie px-3 text-left text-sm text-texto"
          >
            {c.nombre}
          </button>
        ))}

        {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

        <Boton tono="secundario" ancho onClick={() => setEligiendo(false)}>
          Cancelar
        </Boton>
      </Tarjeta>
    );
  }

  if (!madre && !esCabeza && tipoPunto === "local") {
    return (
      <button
        type="button"
        onClick={abrirSelector}
        className="min-h-tactil flex items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto"
      >
        <Building2 size={16} aria-hidden />
        Forma parte de una cadena
      </button>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      {madre && (
        <div className="flex items-start gap-2">
          <Building2 size={18} className="mt-0.5 shrink-0 text-marca" aria-hidden />
          <div className="flex-1">
            <p className="text-xs text-texto-secundario">Es un punto de</p>
            <Link
              href={`/cuentas/${madre.id}`}
              className="text-base font-semibold text-texto underline"
            >
              {madre.nombre}
            </Link>
          </div>
          <button
            type="button"
            disabled={guardando}
            onClick={() => colgarDe(null)}
            className="shrink-0 text-xs text-texto-atenuado underline"
          >
            Desligar
          </button>
        </div>
      )}

      {esCabeza && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Store size={18} className="shrink-0 text-marca" aria-hidden />
            <p className="text-sm font-medium text-texto">
              {sucursales.length}{" "}
              {sucursales.length === 1 ? "punto" : "puntos"} cuelgan de aquí
            </p>
          </div>
          {/* Un cliente, muchos puntos: así se cuenta bien la cartera y así se
              ve de un vistazo si la cadena está atendida completa. */}
          <ul className="flex flex-col gap-1">
            {sucursales.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/cuentas/${s.id}`}
                  className="text-sm text-texto-secundario underline"
                >
                  {s.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tipoPunto === "oficina" && (
        <p className="text-xs text-texto-atenuado">
          {TIPOS_PUNTO.oficina}: aquí se negocia. No entra a rutas de reparto ni
          recibe entregas.
        </p>
      )}

      {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}
    </Tarjeta>
  );
}
