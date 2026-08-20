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
          <h1 className="text-2xl font-semibold text-marca">SGV</h1>
          <p className="mt-1 text-sm text-texto-secundario">
            Sistema de Gestión de Ventas
          </p>

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
