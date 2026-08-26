"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";

/**
 * Salir de la sesión.
 *
 * La variante `compacta` vive en la barra de marca, **al lado de quién está
 * dentro**, que es donde la busca cualquiera. Antes era un botón suelto en la
 * cabecera de Agenda y de Cuentas: en dos pantallas de nueve, y en ninguna
 * junto al nombre del que había entrado.
 */
export function CerrarSesion({ compacta = false }: { compacta?: boolean }) {
  const router = useRouter();

  async function salir() {
    const supabase = clienteNavegador();
    await supabase.auth.signOut();
    router.replace("/entrar");
    router.refresh();
  }

  if (compacta) {
    return (
      <button
        type="button"
        onClick={salir}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="min-h-tactil flex w-11 shrink-0 items-center justify-center rounded-lg text-texto-atenuado hover:bg-white/10 hover:text-white"
      >
        <LogOut size={18} aria-hidden />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Junto a cerrar sesión porque es el mismo cajón mental: «cosas de
          mi cuenta». Nadie va a buscar su contraseña a otra parte. */}
      <Link href="/nueva-clave" className="block">
        <Boton tono="secundario" ancho>
          <span className="flex items-center justify-center gap-2">
            <KeyRound size={16} aria-hidden />
            Cambiar mi contraseña
          </span>
        </Boton>
      </Link>
      <Boton tono="secundario" onClick={salir}>
        Cerrar sesión
      </Boton>
    </div>
  );
}
