import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { TipoInteraccion } from "@/lib/catalogos";
import {
  ListaSeguimientos,
  type Compromiso,
} from "@/components/lista-seguimientos";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

type Fila = {
  id: string;
  cuenta_id: string;
  descripcion: string;
  fecha_compromiso: string;
  tipo_accion: string;
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(cuentas: Fila["cuentas"]) {
  if (!cuentas) return "Cuenta";
  return Array.isArray(cuentas) ? (cuentas[0]?.nombre ?? "Cuenta") : cuentas.nombre;
}

export default async function Seguimientos() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // **Los míos, no los que puedo ver.** Esta pantalla es «a qué me
  // comprometí yo»: el líder viéndola llena de los compromisos de Albert no
  // sabe cuáles tiene que cumplir él. Cómo va el equipo es otra pregunta y
  // se contesta en el tablero.
  const { data } = await supabase
    .from("compromisos")
    .select("id, cuenta_id, descripcion, fecha_compromiso, tipo_accion, cuentas(nombre)")
    .eq("vendedor_id", user.id)
    .is("deleted_at", null)
    .is("cumplido_en", null)
    .order("fecha_compromiso", { ascending: true });

  const compromisos: Compromiso[] = ((data ?? []) as Fila[]).map((c) => ({
    id: c.id,
    cuenta_id: c.cuenta_id,
    cuenta: nombreDe(c.cuentas),
    descripcion: c.descripcion,
    fecha_compromiso: c.fecha_compromiso,
    tipo_accion: c.tipo_accion as TipoInteraccion,
  }));

  return (
    <>
      <AvisoSinConexion />

      <header className="border-b border-borde bg-superficie px-4 py-3">
        <h1 className="text-lg font-semibold text-marca">Seguimientos</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {/* El día se calcula en el servidor, en hora de Panamá: si lo calculara
            el navegador, un celular con el huso mal puesto mostraría los
            vencidos de otro día. */}
        <ListaSeguimientos compromisos={compromisos} hoy={hoyEnPanama()} />
      </main>
    </>
  );
}
