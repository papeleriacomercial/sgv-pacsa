"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { compararRendimiento } from "@/lib/comparador";
import { generarComparador, nombreDelArchivo, rutaEnDeposito } from "@/lib/comparador-xlsx";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { insertar, actualizar, subir } from "@/lib/cola";
import { TIPOS_INTERACCION, type TipoInteraccion } from "@/lib/catalogos";

/**
 * Dentro de tres días, en el formato que espera un campo de fecha.
 *
 * **Tres no es un número redondo elegido al azar**: es la única señal disponible. No hay forma de
 * saber si el cliente abrió la hoja, así que el seguimiento es lo único que dice si sirvió.
 */
function enTresDias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

/** Quién entrega la hoja. El teléfono se guarda en su perfil la primera vez que lo escribe. */
export type Vendedor = { id: string; nombre: string | null; telefono: string | null };

/**
 * Comparador de Rendimiento — §7.10, etapa 2.
 *
 * El vendedor captura de pie, frente al comprador, y **el resultado se mueve mientras teclea**. Ése
 * es el punto: el argumento se demuestra en la conversación, no en un archivo que el cliente abrirá
 * después. El archivo es para cuando el vendedor ya no está.
 *
 * NINGÚN DATO DEL CLIENTE ES OBLIGATORIO, y es la razón de ser del módulo: si hubiera que exigirle
 * el precio que paga hoy, la herramienta no serviría para el cliente que no lo quiere decir — que es
 * justamente el que hay que convencer.
 *
 * DEJA RASTRO. La comparación queda en la ficha con una copia del archivo, y programa el próximo
 * paso a tres días — etapa 3a. Lo que falta es el catálogo de marcas de competencia, etapa 3b.
 */

/** Los dos calibres que hoy se ofrecen. Cuando exista catálogo de productos, saldrán de ahí. */
const CALIBRES = { "48": "48 g/m²", "55": "55 g/m²" } as const;
type Calibre = keyof typeof CALIBRES;

/** Texto a número, tolerando la coma decimal y el campo vacío. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

const cifra = (v: number | null, decimales = 2) =>
  v === null
    ? "—"
    : v.toLocaleString("es-PA", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      });

const dinero = (v: number | null, decimales = 2) =>
  v === null ? "—" : `$${cifra(v, decimales)}`;

/** Un renglón de resultado, con el número alineado a la derecha por la coma. */
function Renglon({
  rotulo,
  valor,
  fuerte = false,
}: {
  rotulo: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={`text-sm ${fuerte ? "font-medium text-texto" : "text-texto-secundario"}`}>
        {rotulo}
      </span>
      <span
        className={`shrink-0 tabular-nums ${fuerte ? "text-base font-semibold text-texto" : "text-sm text-texto"}`}
      >
        {valor}
      </span>
    </div>
  );
}

export function CompararRendimiento({
  cuenta,
  vendedor,
}: {
  cuenta: { id: string; nombre: string };
  vendedor: Vendedor;
}) {
  // Lo que el cliente quiso decir. Se guarda como texto para que el campo pueda quedar vacío: un
  // cero se leería como «no paga nada», que es otra cosa.
  const [precioCliente, setPrecioCliente] = useState("");
  const [rollosCliente, setRollosCliente] = useState("");
  const [metrosCliente, setMetrosCliente] = useState("");
  const [cajasPedido, setCajasPedido] = useState("");
  const [semanas, setSemanas] = useState("");

  // Lo nuestro.
  const [precioNuestro, setPrecioNuestro] = useState("");
  const [rollosNuestro, setRollosNuestro] = useState("");
  const [metrosNuestro, setMetrosNuestro] = useState("");
  const [calibre, setCalibre] = useState<Calibre | null>(null);

  // La marca que usa hoy. Va al registro de la bitácora; en la etapa 3b saldrá del catálogo.
  const [marca, setMarca] = useState("");

  // EL TELÉFONO SE PIDE ACÁ Y NO EN UNA PANTALLA DE PERFIL, porque el SGV no tiene una. Se pregunta
  // donde hace falta, se guarda en el perfil, y a partir de la segunda vez ya viene puesto.
  const [telefono, setTelefono] = useState(vendedor.telefono ?? "");

  // EL PRÓXIMO PASO. Se crea solo, y la fecha se puede cambiar antes de generar: el vendedor sabe si
  // ese local no abre el jueves, y corregirlo después desde la agenda es un paso que nadie da.
  const [fechaSeguimiento, setFechaSeguimiento] = useState(enTresDias);
  const [accion, setAccion] = useState<TipoInteraccion>("visita");

  const router = useRouter();
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Qué pasó con el registro, después de que la hoja ya salió.
   *
   * **GENERAR UNA HOJA NO CONFIRMABA NADA.** Se compartía el archivo y la pantalla quedaba igual que
   * antes, así que el vendedor no tenía cómo distinguir «guardado» de «no guardado» — ni de «quedó
   * esperando señal». El 2 de septiembre de 2026 el usuario probó contra una compilación vieja que
   * no grababa, y **la pantalla no le dio ninguna señal de eso**: tuvo que deducirlo.
   *
   * Los tres estados son distintos y se dicen distinto:
   *
   * · `bien`   — está en la ficha, y el seguimiento en la agenda.
   * · `espera` — quedó guardado en este teléfono y sale al recuperar señal. **No es una falla**, y
   *              decirlo como si lo fuera haría que el vendedor lo repita y queden dos.
   * · `falla`  — no se guardó y no se va a guardar solo.
   */
  const [registro, setRegistro] = useState<{
    tono: "bien" | "espera" | "falla";
    texto: string;
  } | null>(null);

  const cliente = {
    precioCaja: aNumero(precioCliente),
    rollosCaja: aNumero(rollosCliente),
    metrosRollo: aNumero(metrosCliente),
    cajasPedido: aNumero(cajasPedido),
    semanasEntrePedidos: aNumero(semanas),
  };
  const nuestro = {
    precioCaja: aNumero(precioNuestro),
    rollosCaja: aNumero(rollosNuestro),
    metrosRollo: aNumero(metrosNuestro),
    calibre: calibre ? Number(calibre) : null,
  };

  // Las cuentas son puras y baratas: se rehacen con cada tecla a propósito, que es lo que hace que
  // el resultado se mueva mientras el cliente mira.
  const r = useMemo(
    () => compararRendimiento(cliente, nuestro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      precioCliente,
      rollosCliente,
      metrosCliente,
      cajasPedido,
      semanas,
      precioNuestro,
      rollosNuestro,
      metrosNuestro,
    ],
  );

  // La hoja no sale en blanco completo: nuestros tres números son el mínimo.
  const puedeArmar =
    nuestro.precioCaja !== null && nuestro.rollosCaja !== null && nuestro.metrosRollo !== null;

  // LA COMPROBACIÓN DEL ANEXO, no un argumento de venta: lo que proponemos tiene que durarle lo
  // mismo que le dura hoy. Si las dos cifras se separan, hay un dato mal capturado — y es mucho
  // mejor descubrirlo acá que delante del cliente con la hoja ya abierta.
  const descuadre =
    r.semanasQueDura !== null &&
    cliente.semanasEntrePedidos !== null &&
    Math.abs(r.semanasQueDura - cliente.semanasEntrePedidos) > 0.5;

  /**
   * Deja la comparación en la bitácora de la cuenta y programa el próximo paso.
   *
   * *«El vendedor va a estar haciendo varias de estas comparaciones en diferentes clientes, y no va
   * a tener la memoria de qué fue lo que le ofreció a uno en particular.»* La hoja se la lleva el
   * cliente; sin esto **no queda copia de nuestro lado**.
   *
   * NUNCA LEVANTA UN ERROR. La hoja ya está entregada cuando esto corre, así que un fallo acá se
   * avisa sin bloquear. Lo que sea falta de señal lo guarda la cola y sale al reconectar.
   *
   * EL ORDEN NO ES ARBITRARIO: el compromiso primero porque la comparación lo referencia; la fila de
   * la comparación antes que el archivo porque **el permiso del depósito comprueba que esa fila
   * exista**; y la ruta del archivo se escribe al final, cuando la subida ya ocurrió, para que no
   * quede apuntando a un archivo que nunca llegó.
   */
  async function registrar(archivo: File) {
    const idComparacion = crypto.randomUUID();
    const conQuien = cuenta.nombre;

    try {
      let idCompromiso: string | null = crypto.randomUUID();
      const paso = await insertar(
        "compromisos",
        {
          id: idCompromiso,
          cuenta_id: cuenta.id,
          // No nace de una visita registrada, igual que un seguimiento programado a mano.
          visita_id: null,
          vendedor_id: vendedor.id,
          descripcion: `Dar seguimiento a la comparación de costo entregada a ${conQuien}`,
          fecha_compromiso: fechaSeguimiento,
          tipo_accion: accion,
        },
        `Seguimiento de la comparación con ${conQuien}`,
      );
      if (paso.error) idCompromiso = null;

      const fila = await insertar(
        "comparaciones",
        {
          id: idComparacion,
          cuenta_id: cuenta.id,
          vendedor_id: vendedor.id,
          marca_competencia: marca.trim() || null,
          cliente_precio_caja: cliente.precioCaja,
          cliente_rollos_caja: cliente.rollosCaja,
          cliente_metros_rollo: cliente.metrosRollo,
          cliente_cajas_pedido: cliente.cajasPedido,
          cliente_semanas: cliente.semanasEntrePedidos,
          nuestro_precio_caja: nuestro.precioCaja,
          nuestro_rollos_caja: nuestro.rollosCaja,
          nuestro_metros_rollo: nuestro.metrosRollo,
          nuestro_calibre: nuestro.calibre,
          // EL RESULTADO QUE SE LE ENSEÑÓ, aunque sea recalculable: es lo que se dijo esa tarde.
          costo_metro_cliente: r.costoPorMetroCliente,
          costo_metro_nuestro: r.costoPorMetroNuestro,
          cajas_equivalentes: r.cajasEquivalentes,
          ahorro_por_pedido: r.ahorroPorPedido,
          diferencia_al_ano: r.diferenciaAlAno,
          compromiso_id: idCompromiso,
        },
        `Comparación de costo con ${conQuien}`,
      );
      if (fila.error) {
        setRegistro({
          tono: "falla",
          texto: `La hoja salió, pero no quedó registrada en la ficha: ${fila.error}`,
        });
        return;
      }

      const ruta = rutaEnDeposito(idComparacion);
      const subida = await subir(
        "comparaciones",
        ruta,
        archivo,
        idComparacion,
        `Copia de la comparación con ${conQuien}`,
      );
      if (subida.error) {
        setRegistro({
          tono: "falla",
          texto: `Quedó en la ficha, pero la copia del archivo no se pudo guardar: ${subida.error}`,
        });
        return;
      }

      await actualizar(
        "comparaciones",
        idComparacion,
        { archivo_path: ruta },
        `Copia de la comparación con ${conQuien}`,
      );

      // LO QUE QUEDÓ EN COLA NO ES UNA FALLA, y decirlo como si lo fuera haría que el vendedor
      // repita la comparación y queden dos en la ficha del mismo cliente.
      const enCola = paso.encolada || fila.encolada || subida.encolada;
      const cuando = new Date(`${fechaSeguimiento}T12:00:00`).toLocaleDateString("es-PA", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      setRegistro(
        enCola
          ? {
              tono: "espera",
              texto: `Guardado en este teléfono: entra a la ficha de ${conQuien} y a tu agenda en cuanto haya señal.`,
            }
          : {
              tono: "bien",
              texto: `Quedó en la ficha de ${conQuien}, con la copia del archivo. Te toca volver el ${cuando}.`,
            },
      );
    } catch (e) {
      setRegistro({
        tono: "falla",
        texto: `La hoja salió, pero no quedó registrada: ${e instanceof Error ? e.message : "error desconocido"}`,
      });
    }
  }

  async function armarYCompartir() {
    setError(null);
    setRegistro(null);
    setArmando(true);
    try {
      const blob = await generarComparador({
        nuestro,
        cliente,
        nombreCliente: cuenta.nombre,
        vendedor: { nombre: vendedor.nombre, telefono: telefono.trim() || null },
      });
      const archivo = new File([blob], nombreDelArchivo(cuenta.nombre), { type: blob.type });

      // Se recuerda el teléfono para la próxima. VA APARTE DE LA HOJA a propósito: si el guardado
      // falla —sin señal en la calle, que es el caso normal— la hoja sale igual y lo único que pasa
      // es que la próxima vez se vuelve a pedir. Frenar al vendedor con el cliente delante por no
      // haber podido guardar un teléfono sería el peor intercambio posible.
      const nuevo = telefono.trim();
      if (nuevo && nuevo !== (vendedor.telefono ?? "")) {
        try {
          await clienteNavegador().from("perfiles").update({ telefono: nuevo }).eq("id", vendedor.id);
        } catch {
          /* la hoja ya está armada y es lo que importa */
        }
      }

      // PRIMERO SE ENTREGA. El registro va después: si algo de aquello falla —sin señal, que en la
      // calle es lo normal— el cliente igual se lleva su hoja.
      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({
            files: [archivo],
            title: "Comparación de costo real",
            text: `Comparación de costo para ${cuenta.nombre}`,
          });
        } catch {
          // Cancelar no es un error: la hoja se vuelve a armar cuando quiera.
        }
      } else {
        // Sin hoja de compartir —un escritorio— se descarga.
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = archivo.name;
        enlace.click();
        URL.revokeObjectURL(url);
      }

      await registrar(archivo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo armar la hoja. Intenta de nuevo.");
    } finally {
      setArmando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- 1. Lo que compra hoy ----------------------------------------- */}
      <Tarjeta className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto">El rollo que usa hoy</h2>
          <p className="text-xs text-texto-atenuado">
            Ninguno es obligatorio. Anota lo que el cliente quiera decirte.
          </p>
        </div>

        {/* Va al registro de la bitácora, para saber contra quién se compitió en cada local. En la
            etapa 3b saldrá del catálogo de marcas en vez de escribirse. */}
        <Campo
          etiqueta="Marca que usa hoy"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Como la conozca el cliente"
        />

        <Campo
          etiqueta="Precio que paga por caja"
          inputMode="decimal"
          value={precioCliente}
          onChange={(e) => setPrecioCliente(e.target.value)}
          placeholder="$"
        />

        <Campo
          etiqueta="Rollos por caja"
          inputMode="numeric"
          value={rollosCliente}
          onChange={(e) => setRollosCliente(e.target.value)}
        />

        {/* EL CAMPO DONDE SE PIERDE LA VENTA. La competencia rotula «80 × 70» sin decir la unidad:
            el 80 todos lo leen como ancho, y el 70 se lee como metros cuando son milímetros de
            diámetro. El aviso va acá y no en un manual porque acá es donde el vendedor está por
            escribir el número equivocado, con la caja del cliente delante. */}
        <Campo
          etiqueta="Metros de papel por rollo"
          inputMode="decimal"
          value={metrosCliente}
          onChange={(e) => setMetrosCliente(e.target.value)}
          ayuda="Si la caja dice 80 × 70, eso son milímetros: ancho y diámetro del rollo. No son metros. Si no lo sabe, déjalo vacío y ofrécele medírselo."
        />

        <Campo
          etiqueta="Cajas que compra por pedido"
          inputMode="numeric"
          value={cajasPedido}
          onChange={(e) => setCajasPedido(e.target.value)}
        />

        <Campo
          etiqueta="Cada cuántas semanas repite el pedido"
          inputMode="numeric"
          value={semanas}
          onChange={(e) => setSemanas(e.target.value)}
        />
      </Tarjeta>

      {/* --- 2. Nuestra oferta -------------------------------------------- */}
      <Tarjeta className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto">Nuestra oferta</h2>
          <p className="text-xs text-texto-atenuado">
            Los tres primeros van siempre. La hoja nunca sale en blanco.
          </p>
        </div>

        <Campo
          etiqueta="Precio por caja"
          inputMode="decimal"
          value={precioNuestro}
          onChange={(e) => setPrecioNuestro(e.target.value)}
          placeholder="$"
        />

        <Campo
          etiqueta="Rollos por caja"
          inputMode="numeric"
          value={rollosNuestro}
          onChange={(e) => setRollosNuestro(e.target.value)}
        />

        <Campo
          etiqueta="Metros de papel por rollo"
          inputMode="decimal"
          value={metrosNuestro}
          onChange={(e) => setMetrosNuestro(e.target.value)}
        />

        <Opciones
          etiqueta="Calibre del papel"
          opciones={CALIBRES}
          valor={calibre}
          onCambio={(v) => setCalibre(v)}
          ayuda="Mientras más delgado el papel, más metros caben en el mismo diámetro de rollo."
        />
      </Tarjeta>

      {/* --- 3. El resultado, en vivo -------------------------------------- */}
      <Tarjeta className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-texto">Lo que ve el cliente</h2>

        <div className="flex flex-col divide-y divide-borde">
          <div className="pb-2">
            <Renglon
              rotulo="Costo por metro — el que compra hoy"
              valor={dinero(r.costoPorMetroCliente, 4)}
            />
            <Renglon
              rotulo="Costo por metro — el nuestro"
              valor={dinero(r.costoPorMetroNuestro, 4)}
              fuerte
            />
          </div>

          <div className="py-2">
            <Renglon
              rotulo="Cajas nuestras que equivalen a su pedido"
              valor={r.cajasEquivalentes === null ? "—" : cifra(r.cajasEquivalentes, 0)}
            />
            <Renglon rotulo="Lo que le cuesta hoy ese pedido" valor={dinero(r.costoPedidoActual)} />
            <Renglon rotulo="Lo que le costaría con nosotros" valor={dinero(r.costoPedidoNuestro)} />
            <Renglon rotulo="Ahorro en cada pedido" valor={dinero(r.ahorroPorPedido)} fuerte />
          </div>

          <div className="pt-2">
            <Renglon rotulo="Gasto al año — como compra hoy" valor={dinero(r.gastoAnoActual)} />
            <Renglon rotulo="Gasto al año — con nosotros" valor={dinero(r.gastoAnoNuestro)} />
            <Renglon rotulo="Diferencia a su favor en el año" valor={dinero(r.diferenciaAlAno)} fuerte />
          </div>
        </div>

        {descuadre && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Lo que le proponemos le duraría {cifra(r.semanasQueDura, 1)} semanas y hoy le dura{" "}
            {cifra(cliente.semanasEntrePedidos, 1)}. Deberían dar casi igual: revisa los rollos por
            caja o los metros por rollo antes de mandar la hoja.
          </p>
        )}
      </Tarjeta>

      {/* --- 4. Con qué firma sale ------------------------------------------ */}
      <Tarjeta className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto">Cómo sale firmada</h2>
          <p className="text-xs text-texto-atenuado">
            Esto es lo que el cliente lee arriba de la hoja. El logo de la casa va encima.
          </p>
        </div>

        <p className="rounded-lg bg-fondo px-3 py-2 text-xs text-texto-secundario">
          {vendedor.nombre
            ? ["Vendedor que le visita: " + vendedor.nombre, telefono.trim()]
                .filter(Boolean)
                .join(" · ")
            : "Tu perfil no tiene nombre, así que la hoja saldrá sin este renglón."}
        </p>

        <Campo
          etiqueta="Tu teléfono"
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="6000-0000"
          ayuda="Queda guardado en tu perfil: solo lo escribes la primera vez."
        />
      </Tarjeta>

      {/* --- 5. El próximo paso --------------------------------------------- */}
      <Tarjeta className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto">El próximo paso</h2>
          <p className="text-xs text-texto-atenuado">
            Se agenda solo al generar la hoja. Cambia la fecha si sabes que no conviene.
          </p>
        </div>

        <Campo
          etiqueta="Volver a buscarlo el"
          type="date"
          value={fechaSeguimiento}
          onChange={(e) => setFechaSeguimiento(e.target.value)}
          ayuda="Tres días es la única señal que tenemos: no hay forma de saber si abrió la hoja."
        />

        <Opciones
          etiqueta="Cómo"
          opciones={TIPOS_INTERACCION}
          valor={accion}
          onCambio={(v) => setAccion(v)}
        />
      </Tarjeta>

      {/* --- 6. El archivo -------------------------------------------------- */}
      {/* NO ES DECORACIÓN: es la única forma que tiene el vendedor de saber si la comparación quedó
          guardada. Sin esto, «grabó» y «no grabó» se ven exactamente igual. */}
      {registro && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            registro.tono === "bien"
              ? "bg-green-50 text-green-900"
              : registro.tono === "espera"
                ? "bg-amber-50 text-amber-900"
                : "bg-error/10 text-error"
          }`}
        >
          {registro.texto}
        </p>
      )}

      {/* SIN ESTE BOTÓN, VOLVER ENSEÑA EL EXPEDIENTE DE ANTES.
          Lo encontró el usuario el 2 de septiembre de 2026: grabó, salió el verde, subió con el
          dedo, tocó «volver» y la comparación no estaba. El botón de volver **navega**, y la
          aplicación guarda una copia de cada pantalla que ya visitaste — así que devolvía la copia
          del expediente de antes de la comparación.
          `router.refresh()` tira esa copia; recién entonces se navega.
          **Y NO SE RECARGA LA PÁGINA ENTERA A PROPÓSITO**: en el iPhone del usuario, arrastrar para
          refrescar lo devuelve a la pantalla de ingreso. Una recarga completa acá le haría lo
          mismo, y perdería el trabajo. */}
      {registro && registro.tono !== "falla" && (
        <Boton
          ancho
          onClick={() => {
            router.refresh();
            router.push(`/cuentas/${cuenta.id}`);
          }}
        >
          Volver al expediente
        </Boton>
      )}

      {error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <Boton ancho onClick={armarYCompartir} disabled={!puedeArmar || armando}>
        {armando ? "Armando la hoja…" : "Generar y compartir la hoja"}
      </Boton>

      {!puedeArmar && (
        <p className="text-center text-xs text-texto-atenuado">
          Faltan el precio, los rollos y los metros de nuestra oferta.
        </p>
      )}
    </div>
  );
}
