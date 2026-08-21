"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { TIPOS_CUENTA, type TipoCuenta } from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";

/**
 * Marca la cuenta como cliente, o la devuelve a prospecto.
 *
 * Es el hecho comercial más importante de una cuenta: la primera venta. Por
 * eso el cambio queda registrado en `auditoria` sin que nadie lo reporte.
 *
 * La marca es del vendedor. Cuando exista la integración, Zoho la confirma o
 * la corrige; si el vendedor marcó cliente y Zoho no tiene facturas, eso es un
 * hallazgo. Ver D-010 en docs/06-decisiones.md.
 */
export function CambiarTipoCuenta({
  id,
  tipo,
}: {
  id: string;
  tipo: TipoCuenta;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  const destino: TipoCuenta = tipo === "prospecto" ? "cliente" : "prospecto";

  async function cambiar() {
    setGuardando(true);
    const supabase = clienteNavegador();
    await supabase.from("cuentas").update({ tipo: destino }).eq("id", id);
    router.refresh();
    setGuardando(false);
  }

  return (
    <Boton tono="secundario" ancho onClick={cambiar} disabled={guardando}>
      {guardando
        ? "Guardando"
        : tipo === "prospecto"
          ? "Marcar como cliente"
          : `Volver a ${TIPOS_CUENTA.prospecto.toLowerCase()}`}
    </Boton>
  );
}
