"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

/** Lo que exige Supabase por omisión. Menos que esto lo rechaza la base. */
const MINIMO = 6;

/**
 * Ponerse una contraseña nueva.
 *
 * **Sirve para las dos veces que hace falta**, y son distintas: al llegar desde
 * el enlace del correo —ahí Supabase ya dejó una sesión abierta al abrir la
 * página— y cuando alguien decide cambiarla estando dentro.
 *
 * Se detecta cuál es mirando si hay sesión, no leyendo la dirección. El enlace
 * de recuperación trae su credencial en el fragmento de la URL —después del
 * `#`— y el cliente de Supabase la consume solo al arrancar; para cuando esta
 * pantalla mira, la diferencia ya no se nota y tampoco importa.
 */
export default function NuevaClave() {
  const router = useRouter();
  const [mirando, setMirando] = useState(true);
  const [haySesion, setHaySesion] = useState(false);

  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const supabase = clienteNavegador();

    // El enlace del correo tarda un instante en convertirse en sesión. Sin
    // esperar a ese aviso, la pantalla decía «enlace vencido» a quien acababa
    // de tocarlo.
    const { data: escucha } = supabase.auth.onAuthStateChange((_, sesion) => {
      if (sesion) {
        setHaySesion(true);
        setMirando(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHaySesion(true);
      setMirando(false);
    });

    return () => escucha.subscription.unsubscribe();
  }, []);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (clave.length < MINIMO) {
      setError(`Tiene que tener al menos ${MINIMO} caracteres.`);
      return;
    }
    if (clave !== repetida) {
      setError("Las dos no coinciden.");
      return;
    }

    setGuardando(true);
    const supabase = clienteNavegador();
    const { error: fallo } = await supabase.auth.updateUser({ password: clave });

    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }

    setListo(true);
    setGuardando(false);
  }

  if (mirando) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Cargando texto="Comprobando el enlace" />
      </main>
    );
  }

  return (
    <>
      <AvisoSinConexion />

      <main className="flex flex-1 items-center justify-center p-4">
        <Tarjeta className="flex w-full max-w-sm flex-col gap-4">
          {!haySesion ? (
            <>
              <h1 className="text-lg font-semibold text-marca">
                El enlace ya no sirve
              </h1>
              <p className="text-sm text-texto-secundario">
                Los enlaces vencen a la hora, y solo se pueden usar una vez.
                Pide otro y listo.
              </p>
              <Link href="/recuperar" className="block">
                <Boton ancho>Pedir otro enlace</Boton>
              </Link>
            </>
          ) : listo ? (
            <>
              <h1 className="text-lg font-semibold text-marca">
                Contraseña cambiada
              </h1>
              <p className="text-sm text-texto-secundario">
                Ya quedó. Es la que vas a usar de ahora en adelante.
              </p>
              <Boton ancho onClick={() => router.replace("/")}>
                Entrar
              </Boton>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-lg font-semibold text-marca">
                  Tu contraseña nueva
                </h1>
                <p className="mt-1 text-sm text-texto-secundario">
                  Al menos {MINIMO} caracteres. Que te la puedas acordar en la
                  calle.
                </p>
              </div>

              <form onSubmit={guardar} className="flex flex-col gap-4">
                <Campo
                  etiqueta="Contraseña nueva"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
                {/* Se pide dos veces porque no se ve lo que se escribe, y una
                    contraseña con un dedazo deja a alguien fuera sin que nadie
                    sepa por qué. */}
                <Campo
                  etiqueta="Otra vez, para estar seguros"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />

                {error && (
                  <MensajeError titulo="No se pudo guardar" detalle={error} />
                )}

                <Boton type="submit" ancho disabled={guardando}>
                  {guardando ? "Guardando" : "Guardar"}
                </Boton>
              </form>
            </>
          )}
        </Tarjeta>
      </main>
    </>
  );
}
