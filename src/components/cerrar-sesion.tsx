"use client";

import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";

export function CerrarSesion() {
  const router = useRouter();

  async function salir() {
    const supabase = clienteNavegador();
    await supabase.auth.signOut();
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <Boton tono="secundario" onClick={salir}>
      Cerrar sesión
    </Boton>
  );
}
