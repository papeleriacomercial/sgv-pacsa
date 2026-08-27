import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { clienteServidor } from "@/lib/supabase/servidor";
import { BotonVolver } from "@/components/boton-volver";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Vacio } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { LINEAS_PRODUCTO, type LineaProducto } from "@/lib/catalogos";
import { Barra, Comparativa } from "@/components/barras";

const DINERO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const MES = new Intl.DateTimeFormat("es-PA", {
  month: "short",
  year: "2-digit",
  timeZone: "America/Panama",
});

type PorMes = {
  anio: number;
  mes: string;
  canal: "calle" | "casa";
  vendedor_zoho: string | null;
  vendedor_id: string | null;
  documentos: number;
  clientes: number;
  total: string | number;
  por_cobrar: string | number;
};

type PorCliente = {
  contacto_id: string;
  nombre: string | null;
  cuenta_id: string | null;
  canal_habitual: "calle" | "casa";
  vendedores: number;
  total: string | number;
  por_cobrar: string | number;
};

type PorLinea = {
  linea: string;
  clientes: number;
  total: string | number;
};

type Nuevos = {
  mes: string;
  canal: "calle" | "casa";
  clientes: number;
  nuevos: number;
  total: string | number;
};

function nombreMes(iso: string) {
  return MES.format(new Date(`${iso}T12:00:00Z`));
}

/**
 * El negocio completo, no solo la fuerza de ventas (§7.6).
 *
 * **Es el módulo de retorno más rápido del sistema** porque no depende de que
 * nadie adopte nada: los datos ya existían en Zoho. Lo único que hacía falta
 * era traerlos y ordenarlos.
 *
 * Contesta las preguntas de la visión en el orden en que se hacen: cuánto
 * vende la empresa y por qué canal, quién lo firma, de quién depende —la
 * concentración—, si entran clientes nuevos, y qué se vende.
 *
 * Solo gerencia. No por secreto sino porque son las decisiones de gerencia: a
 * un vendedor, saber que la casa factura el doble que él no le dice qué hacer
 * el martes.
 */
export default async function Negocio({
  searchParams,
}: PageProps<"/tablero/negocio">) {
  const params = await searchParams;
  const pedido = Array.isArray(params.anio) ? params.anio[0] : params.anio;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  // La autorización de verdad la aplica el RLS —un vendedor que abriera estas
  // vistas vería lo suyo y nada más—; esto es para no enseñar una pantalla que
  // no va a poder leer.
  if (perfil?.rol !== "gerente") notFound();

  const { data: crudoMes } = await supabase.from("venta_por_mes").select("*");
  const todosLosMeses = (crudoMes ?? []) as PorMes[];

  // **Se lee por año calendario, no por doce meses móviles.** Es como el
  // negocio cierra sus números, y comparar «los últimos doce meses» contra
  // un ejercicio no compara nada.
  const anios = [...new Set(todosLosMeses.map((m) => m.anio))].sort(
    (a, b) => b - a,
  );
  const anio =
    pedido && anios.includes(Number(pedido)) ? Number(pedido) : (anios[0] ?? 0);

  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  const [{ data: crudoCli }, { data: crudoLin }, { data: crudoNue }] =
    await Promise.all([
      supabase.rpc("ranking_de_clientes", { p_desde: desde, p_hasta: hasta }),
      supabase.rpc("venta_por_linea", { p_desde: desde, p_hasta: hasta }),
      supabase.from("clientes_por_mes").select("*"),
    ]);

  const porMes = todosLosMeses.filter((m) => m.anio === anio);
  const todosLosClientes = (crudoCli ?? []) as PorCliente[];
  const clientes = todosLosClientes.slice(0, 12);
  const clientesTotales = todosLosClientes.length;
  const porLinea = (crudoLin ?? []) as PorLinea[];
  const nuevos = ((crudoNue ?? []) as Nuevos[]).filter((n) =>
    n.mes.startsWith(String(anio)),
  );

  if (porMes.length === 0) {
    return (
      <>
        <AvisoSinConexion />
        <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
          <BotonVolver alterno="/tablero" />
          <h1 className="text-lg font-semibold text-marca">El negocio</h1>
        </header>
        <main className="flex flex-1 flex-col p-4">
          <Tarjeta>
            <Vacio titulo="Todavía no hay facturación cargada">
              Corre la sincronización con Zoho y esta pantalla se llena sola.
            </Vacio>
          </Tarjeta>
        </main>
      </>
    );
  }

  const total = porMes.reduce((s, m) => s + Number(m.total), 0);
  const deCalle = porMes
    .filter((m) => m.canal === "calle")
    .reduce((s, m) => s + Number(m.total), 0);
  const porCobrar = porMes.reduce((s, m) => s + Number(m.por_cobrar), 0);

  // --- Los meses, con su reparto por canal --------------------------------
  const meses = new Map<string, { calle: number; casa: number }>();
  for (const m of porMes) {
    const p = meses.get(m.mes) ?? { calle: 0, casa: 0 };
    p[m.canal] += Number(m.total);
    meses.set(m.mes, p);
  }
  // **Todos los meses del año, no los últimos seis.** Cortar a seis dejaba
  // fuera enero y febrero, y un ejercicio al que le faltan dos meses no se
  // puede comparar con el anterior ni cuadrar con el total de arriba.
  const ordenMeses = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b));
  const techo = Math.max(...ordenMeses.map(([, v]) => v.calle + v.casa), 1);

  // **El mes en curso va aparte.** Comparar un mes de 26 días contra uno de 31
  // hace ver una caída que no existe, y es el error de lectura más fácil de
  // cometer en una pantalla como esta.
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Panama",
  });
  const mesActual = `${hoy.slice(0, 7)}-01`;
  const enCurso = ordenMeses.at(-1)?.[0] === mesActual;
  const diaDelMes = Number(hoy.slice(8, 10));

  // --- Quién firma ---------------------------------------------------------
  const firmas = new Map<string, number>();
  for (const m of porMes) {
    const clave = m.vendedor_zoho ?? "";
    firmas.set(clave, (firmas.get(clave) ?? 0) + Number(m.total));
  }
  const porFirma = [...firmas.entries()].sort((a, b) => b[1] - a[1]);
  const sinFirma = firmas.get("") ?? 0;

  // --- Concentración -------------------------------------------------------
  const top10 = clientes.slice(0, 10).reduce((s, c) => s + Number(c.total), 0);


  // --- Líneas de producto --------------------------------------------------
  const lineas = new Map<string, number>();
  for (const l of porLinea) {
    lineas.set(l.linea, (lineas.get(l.linea) ?? 0) + Number(l.total));
  }
  const totalLineas = [...lineas.values()].reduce((a, b) => a + b, 0);
  const porLineaOrden = [...lineas.entries()].sort((a, b) => b[1] - a[1]);

  // --- Clientes nuevos -----------------------------------------------------
  const nuevosPorMes = new Map<string, { clientes: number; nuevos: number }>();
  for (const n of nuevos) {
    const p = nuevosPorMes.get(n.mes) ?? { clientes: 0, nuevos: 0 };
    p.clientes += n.clientes;
    p.nuevos += n.nuevos;
    nuevosPorMes.set(n.mes, p);
  }
  const ultimosNuevos = [...nuevosPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno="/tablero" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-marca">El negocio</h1>
          <p className="text-xs text-texto-atenuado">
            Facturación de Zoho, año {anio}
            {enCurso && " — todavía abierto"}
          </p>
        </div>
      </header>

      {/* **Un ejercicio a la vez.** Mezclar dos años en la misma cifra no
          contesta ninguna pregunta: ni cómo cerró el anterior, ni cómo va
          este. Y el año en curso se rotula como abierto para que nadie lo
          compare de igual a igual contra uno cerrado. */}
      {anios.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-borde bg-superficie px-4 py-2">
          {anios.map((a) => (
            <Link
              key={a}
              href={a === anios[0] ? "/tablero/negocio" : `/tablero/negocio?anio=${a}`}
              aria-current={a === anio ? "true" : undefined}
              className={`min-h-tactil flex shrink-0 items-center rounded-lg border px-4 font-mono text-sm ${
                a === anio
                  ? "border-marca bg-marca text-white"
                  : "border-borde text-texto"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-6 p-4">
        {/* --- 1. Cuánto vende la empresa, y por qué canal --- */}
        <section className="flex flex-col gap-2">
          <Tarjeta className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-texto-secundario">Facturado en 12 meses</p>
              <p className="font-mono text-2xl text-texto">{DINERO.format(total)}</p>
            </div>

            <Comparativa
              partes={[
                { etiqueta: "La casa", valor: total - deCalle, tono: "marca" },
                { etiqueta: "Los vendedores", valor: deCalle, tono: "ok" },
              ]}
            />

            {porCobrar > 0 && (
              <p className="text-xs text-texto-atenuado">
                {DINERO.format(porCobrar)} sigue por cobrar.
              </p>
            )}
          </Tarjeta>
        </section>

        {/* --- 2. Los meses --- */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Mes a mes</h2>
          <Tarjeta className="flex flex-col gap-2">
            {ordenMeses.map(([mes, v]) => {
              const suma = v.calle + v.casa;
              const parcial = enCurso && mes === mesActual;
              return (
                <div key={mes} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="capitalize text-texto-secundario">
                      {nombreMes(mes)}
                      {parcial && (
                        <span className="ml-1.5 text-texto-atenuado">
                          · {diaDelMes} días
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-texto">
                      {DINERO.format(suma)}
                    </span>
                  </div>
                  <Barra
                    partes={[
                      { valor: v.casa, tono: "marca" },
                      { valor: v.calle, tono: "ok" },
                    ]}
                    techo={techo}
                    atenuada={parcial}
                  />
                </div>
              );
            })}

            <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-2 text-sm">
              <span className="text-texto-secundario">Total {anio}</span>
              <span className="font-mono text-texto">{DINERO.format(total)}</span>
            </div>

            {/* Sin esto, un mes de 26 días al lado de uno de 31 se lee como
                una caída. Es el error de lectura más fácil de cometer aquí. */}
            {enCurso && (
              <p className="text-xs text-texto-atenuado">
                El último mes va por la mitad: no se puede comparar contra los
                cerrados.
              </p>
            )}
          </Tarjeta>
        </section>

        {/* --- 3. Quién firma --- */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Quién firma la venta</h2>
          <Tarjeta className="flex flex-col gap-2">
            {porFirma.map(([nombre, monto]) => (
              <div key={nombre || "sin"} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span
                    className={
                      nombre ? "text-texto" : "font-medium text-aviso"
                    }
                  >
                    {/* El nombre viene de Zoho con el celular pegado. Aquí solo
                        estorba. */}
                    {nombre ? nombre.split(" ").slice(0, 2).join(" ") : "Sin vendedor"}
                  </span>
                  <span className="font-mono text-texto">
                    {DINERO.format(monto)} ·{" "}
                    {Math.round((monto / total) * 100)}%
                  </span>
                </div>
                <Barra
                  partes={[{ valor: monto, tono: nombre ? "marca" : "aviso" }]}
                  techo={porFirma[0][1]}
                />
              </div>
            ))}

            {/* **Cada sección cierra con su total.** Sin eso, los porcentajes
                no se pueden cuadrar contra la cifra grande de arriba, y una
                cifra que no se puede cuadrar no se cree. */}
            <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-2 text-sm">
              <span className="text-texto-secundario">Total</span>
              <span className="font-mono text-texto">{DINERO.format(total)}</span>
            </div>

            {sinFirma > 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                <strong>
                  {Math.round((sinFirma / total) * 100)}% de la venta no tiene
                  vendedor en Zoho.
                </strong>{" "}
                No es venta perdida: es venta que no se puede atribuir a nadie,
                y por eso no se puede premiar ni pedir cuentas de ella.
              </p>
            )}
          </Tarjeta>
        </section>

        {/* --- 4. De quién depende el negocio --- */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">De quién depende</h2>
          <Tarjeta className="flex flex-col gap-2">
            <p className="text-sm text-texto">
              Los diez primeros clientes son el{" "}
              <strong className="font-mono">
                {Math.round((top10 / total) * 100)}%
              </strong>{" "}
              de la venta.
            </p>
            <p className="text-xs text-texto-atenuado">
              Es la cifra que dice qué pasa si uno se va.
            </p>
            <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-2 text-sm">
              <span className="text-texto-secundario">
                Los diez primeros suman
              </span>
              <span className="font-mono text-texto">{DINERO.format(top10)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-texto-secundario">
                Los {clientesTotales} clientes del año
              </span>
              <span className="font-mono text-texto">{DINERO.format(total)}</span>
            </div>
          </Tarjeta>

          {clientes.slice(0, 10).map((c) => {
            const cuerpo = (
              <Tarjeta className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-texto">
                    {c.nombre ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-texto-atenuado">
                    {c.canal_habitual === "calle" ? "Vendedor" : "La casa"}
                    {c.vendedores > 1 && ` · ${c.vendedores} vendedores`}
                    {Number(c.por_cobrar) > 0 &&
                      ` · ${DINERO.format(Number(c.por_cobrar))} por cobrar`}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm text-texto">
                    {DINERO.format(Number(c.total))}
                  </span>
                  <span className="block font-mono text-xs text-texto-atenuado">
                    {Math.round((Number(c.total) / total) * 100)}%
                  </span>
                </span>
              </Tarjeta>
            );

            return c.cuenta_id ? (
              <Link key={c.contacto_id} href={`/cuentas/${c.cuenta_id}`} className="block">
                {cuerpo}
              </Link>
            ) : (
              <div key={c.contacto_id}>{cuerpo}</div>
            );
          })}
        </section>

        {/* --- 5. Clientes nuevos --- */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">
            Clientes que compran cada mes
          </h2>
          <Tarjeta className="flex flex-col gap-2">
            {ultimosNuevos.map(([mes, v]) => (
              <div
                key={mes}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="capitalize text-texto-secundario">
                  {nombreMes(mes)}
                </span>
                <span className="text-texto">
                  <span className="font-mono">{v.clientes}</span> compraron ·{" "}
                  <span className="font-mono text-ok">{v.nuevos}</span> por
                  primera vez
                </span>
              </div>
            ))}
            <p className="text-xs text-texto-atenuado">
              «Primera vez» es dentro de estos doce meses: quien volvió después
              de años sale como nuevo.
            </p>
          </Tarjeta>
        </section>

        {/* --- 6. Qué se vende --- */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-texto">Qué se vende</h2>
          <Tarjeta className="flex flex-col gap-2">
            {porLineaOrden.map(([linea, monto]) => (
              <div key={linea} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-texto">
                    {LINEAS_PRODUCTO[linea as LineaProducto] ?? linea}
                  </span>
                  <span className="font-mono text-texto">
                    {DINERO.format(monto)} ·{" "}
                    {Math.round((monto / totalLineas) * 100)}%
                  </span>
                </div>
                <Barra
                  partes={[{ valor: monto, tono: "marca" }]}
                  techo={porLineaOrden[0][1]}
                />
              </div>
            ))}

            <div className="flex items-baseline justify-between gap-2 border-t border-borde pt-2 text-sm">
              <span className="text-texto-secundario">Total con detalle</span>
              <span className="font-mono text-texto">
                {DINERO.format(totalLineas)}
              </span>
            </div>

            {/* **Decir por qué no cuadra es la mitad del trabajo.** Sin esta
                línea, la primera reacción es que la pantalla suma mal — y quien
                piensa eso una vez deja de creerle a la pantalla entera.

                Son tres razones distintas y conviene nombrarlas todas: de la
                venta de la casa no se guarda el detalle, el ITBMS se cobra pero
                no es producto, y mientras la carga esté incompleta falta
                además el detalle que todavía no se trajo. */}
            <p className="text-xs text-texto-atenuado">
              No cuadra con {DINERO.format(total)} por tres motivos: aquí solo
              entra la venta de los vendedores —de la de la casa se guarda la
              factura, no lo que llevaba dentro—, no se cuenta el ITBMS, y de
              algunos documentos todavía no se ha traído el detalle.
            </p>
          </Tarjeta>
        </section>
      </main>
    </>
  );
}
