"use client";

import { useState } from "react";
import Link from "next/link";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/**
 * Pedir un enlace para volver a entrar.
 *
 * **Sin esto, olvidar la contraseña un martes en Chitré significa quedar fuera
 * hasta que alguien con acceso a Supabase la reponga.** Con cuatro personas en
 * la calle eso iba a pasar, y el que se queda fuera un día vuelve a la libreta.
 *
 * No dice si el correo existe o no. Contestar «ese correo no está registrado»
 * le regala a cualquiera la lista de quién trabaja aquí; y a quien de verdad se
 * equivocó de correo, el mensaje de éxito no le hace daño — no le llega nada y
 * lo vuelve a intentar.
 */
export default function Recuperar() {
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedir(evento: React.FormEvent) {
    evento.preventDefault();
    if (!correo.trim()) return;
    setEnviando(true);
    setError(null);

    const supabase = clienteNavegador();
    const { error: fallo } = await supabase.auth.resetPasswordForEmail(
      correo.trim(),
      // A dónde vuelve al tocar el enlace del correo. Se arma con la dirección
      // desde la que se pidió, así funciona igual en el teléfono, en la tablet
      // y en la vista previa sin tener que configurar cada una.
      { redirectTo: `${window.location.origin}/nueva-clave` },
    );

    if (fallo) {
      setError(fallo.message);
      setEnviando(false);
      return;
    }

    setListo(true);
    setEnviando(false);
  }

  return (
    <>
      <AvisoSinConexion />

      <main className="flex flex-1 items-center justify-center p-4">
        <Tarjeta className="flex w-full max-w-sm flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold text-marca">
              Volver a entrar
            </h1>
            <p className="mt-1 text-sm text-texto-secundario">
              Te mandamos un enlace al correo para que pongas una contraseña
              nueva.
            </p>
          </div>

          {listo ? (
            <>
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
                Si ese correo está registrado, ya salió el enlace. Revisa tu
                bandeja — y el correo no deseado, que ahí caen seguido.
              </p>
              <p className="text-xs text-texto-atenuado">
                El enlace vence en una hora. Si no te llega, vuelve a pedirlo.
              </p>
              <Link href="/entrar" className="block">
                <Boton tono="secundario" ancho>
                  Volver
                </Boton>
              </Link>
            </>
          ) : (
            <form onSubmit={pedir} className="flex flex-col gap-4">
              <Campo
                etiqueta="Correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />

              {error && (
                <MensajeError titulo="No se pudo enviar" detalle={error} />
              )}

              <Boton type="submit" ancho disabled={enviando}>
                {enviando ? "Enviando" : "Mandarme el enlace"}
              </Boton>

              <Link
                href="/entrar"
                className="min-h-tactil flex items-center justify-center text-sm text-texto-secundario"
              >
                Me acordé, volver a entrar
              </Link>
            </form>
          )}
        </Tarjeta>
      </main>
    </>
  );
}
