"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";

/**
 * Marca un compromiso como cumplido.
 *
 * Es lo que saca al prospecto de la lista de vencidos. Sin este botón, la
 * agenda del día se llena de compromisos que ya se hicieron y deja de servir.
 */
export function CumplirCompromiso({ id }: { id: string }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  async function cumplir() {
    setGuardando(true);
    const supabase = clienteNavegador();
    await supabase
      .from("compromisos")
      .update({ cumplido_en: new Date().toISOString() })
      .eq("id", id);
    router.refresh();
    setGuardando(false);
  }

  return (
    <Boton tono="secundario" onClick={cumplir} disabled={guardando}>
      {guardando ? "Marcando" : "Ya lo hice"}
    </Boton>
  );
}
