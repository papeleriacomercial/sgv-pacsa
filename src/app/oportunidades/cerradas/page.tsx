import { redirect } from "next/navigation";
import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";

type Fila = {
  id: string;
  numero: string | null;
  tipo: "factura" | "entrega";
  fecha: string;
  total: string | number;
  saldo: string | number;
  cuenta_id: string | null;
  cuentas: { nombre: string } | { nombre: string }[] | null;
};

function nombreDe(c: Fila["cuentas"]) {
  if (!c) return "Cliente";
  return Array.isArray(c) ? (c[0]?.nombre ?? "Cliente") : c.nombre;
}

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
});

const DIA = new Intl.DateTimeFormat("es-PA", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Panama",
});

/**
 * El detalle de lo que suma la venta del mes.
 *
 * **Un total sin su detalle no se puede discutir, y por eso no se cree.** Si el
 * vendedor ve «$8 963» y no puede abrir qué lo compone, la primera vez que no
 * le cuadre con lo que él recuerda va a dejar de mirarlo.
 *
 * Aquí está factura por factura, con su fecha, su cliente y si está cobrada.
 */
export default async function Cerradas() {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const primero = new Date();
  primero.setDate(1);
  const desde = primero.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("transacciones_zoho")
    .select("id, numero, tipo, fecha, total, saldo, cuenta_id, cuentas(nombre)")
    .eq("perfil_id", user.id)
    .gte("fecha", desde)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  const filas = (data ?? []) as unknown as Fila[];
  const total = filas.reduce((s, f) => s + Number(f.total), 0);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/oportunidades" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-marca">Ventas del mes</h1>
          <p className="text-xs text-texto-atenuado">
            {filas.length} {filas.length === 1 ? "documento" : "documentos"} ·{" "}
            {DINERO.format(total)}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-2 p-4">
        {filas.length === 0 && (
          <Tarjeta>
            <Vacio titulo="Todavía no hay ventas este mes">
              Aparecen solas cuando la oficina factura o despacha. No hay que
              registrarlas.
            </Vacio>
          </Tarjeta>
        )}

        {filas.map((f) => {
          const saldo = Number(f.saldo);
          const cuerpo = (
            <Tarjeta className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-texto">
                  {nombreDe(f.cuentas)}
                </p>
                <p className="shrink-0 font-mono text-sm text-texto">
                  {DINERO.format(Number(f.total))}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-texto-atenuado">
                  {DIA.format(new Date(`${f.fecha}T12:00:00Z`))}
                  {f.numero && <span className="font-mono">{f.numero}</span>}
                </span>

                {/* La entrega es la orden anulada: mercancía despachada y
                    cobrada. Se distingue porque el vendedor la reconoce como
                    algo distinto de una factura. */}
                <Insignia tono={f.tipo === "factura" ? "neutro" : "info"}>
                  {f.tipo === "factura" ? "Factura" : "Entrega"}
                </Insignia>
              </div>

              {saldo > 0 && (
                <p className="text-xs text-aviso">
                  {DINERO.format(saldo)} por cobrar
                </p>
              )}
            </Tarjeta>
          );

          return f.cuenta_id ? (
            <Link key={f.id} href={`/cuentas/${f.cuenta_id}`} className="block">
              {cuerpo}
            </Link>
          ) : (
            <div key={f.id}>{cuerpo}</div>
          );
        })}
      </main>
    </>
  );
}
