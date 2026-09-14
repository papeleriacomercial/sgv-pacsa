"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Desde qué cuenta va a salir el correo.
 *
 * **Se escribió porque pasó, y no se notó hasta que el correo llegó a la oficina.** Un iPhone con
 * Apple Mail por omisión mandó una cotización desde una cuenta de iCloud personal. La aplicación
 * nunca vio esa dirección: `mailto:` le entrega el correo al teléfono, y el teléfono usa **su**
 * cuenta configurada.
 *
 * La aplicación **no puede elegir el remitente** —desde la web no hay forma—, así que hace lo
 * único que sí puede: **decir en voz alta cuál debería ser**. Si el vendedor ve un remitente
 * distinto al abrir Gmail, lo nota en el acto, en vez de que se descubra semanas después porque
 * Verónica le respondió a una dirección que nadie lee.
 *
 * Es la misma idea que el aviso de sin conexión: cuando no se puede garantizar algo, se dice.
 */
export function DesdeQueCuenta() {
  const [correo, setCorreo] = useState<string | null>(null);

  useEffect(() => {
    clienteNavegador()
      .auth.getUser()
      .then(({ data }) => setCorreo(data.user?.email ?? null));
  }, []);

  // Mientras no se sepa no se dice nada: un hueco es mejor que una promesa a medias.
  if (!correo) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-borde bg-fondo p-3">
      <Mail size={16} className="mt-0.5 shrink-0 text-texto-atenuado" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm text-texto">
          El correo debe salir de{" "}
          <span className="font-medium break-all">{correo}</span>
        </p>
        <p className="text-xs text-texto-atenuado">
          Si al abrirse aparece otra cuenta, no lo envíes: en el iPhone se arregla en Ajustes ›
          Aplicaciones › Mail › Aplicación de correo por omisión › Gmail.
        </p>
      </div>
    </div>
  );
}
