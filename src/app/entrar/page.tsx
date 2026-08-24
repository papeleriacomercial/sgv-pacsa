"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

export default function Entrar() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setEntrando(true);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (fallo) {
      // Supabase no distingue correo inexistente de contraseña incorrecta, y
      // está bien: decirlo revelaría qué correos están registrados.
      setError("Correo o contraseña incorrectos.");
      setEntrando(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <AvisoSinConexion />
      <main className="flex flex-1 items-center justify-center p-4">
        <Tarjeta className="w-full max-w-sm">
          {/* Aquí sí va el bloque completo, como en la maqueta: el dueño
              arriba y el sistema debajo. Es la única pantalla donde hay
              sitio de sobra y la primera que ve alguien que no conoce la
              aplicación. */}
          <div className="-mx-4 -mt-4 mb-6 rounded-t-lg border-b-2 border-b-aviso bg-marca px-4 py-4">
            <p className="text-lg font-semibold tracking-tight text-white">
              Papelería Comercial
            </p>
            <p className="mt-0.5 text-sm text-texto-atenuado">
              SGV · Sistema de Gestión de Ventas
            </p>
          </div>

          <form onSubmit={entrar} className="mt-6 flex flex-col gap-4">
            <Campo
              etiqueta="Correo"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />

            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />

            {error && <MensajeError titulo={error} />}

            <Boton type="submit" ancho disabled={entrando}>
              {entrando ? "Entrando" : "Entrar"}
            </Boton>
          </form>
        </Tarjeta>
      </main>
    </>
  );
}
