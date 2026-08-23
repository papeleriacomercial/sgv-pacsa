import Link from "next/link";
import type { Semana } from "@/lib/semana";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";

const MONTO = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Fila({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: string;
  tono?: "normal" | "aviso" | "error";
}) {
  const color =
    tono === "error"
      ? "text-error"
      : tono === "aviso"
        ? "text-aviso"
        : "text-texto";

  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-texto-secundario">{etiqueta}</span>
      <span className={`shrink-0 font-mono ${color}`}>{valor}</span>
    </div>
  );
}

/**
 * Cómo va la semana, en cuatro bloques.
 *
 * **La ve él antes que nadie.** Ese es todo el punto: el jueves descubre que le
 * faltan seis clientes y los visita el viernes, sin que nadie se lo diga. Es lo
 * que convierte la herramienta en su instrumento en vez de en vigilancia.
 *
 * Nada de esto lo escribe: si tuviera que contar sus visitas, el cierre se
 * volvería una hora de trabajo y en tres semanas estaría inventando cifras.
 */
export function MiSemana({ semana }: { semana: Semana }) {
  const s = semana;

  // Registrada lejos del local no es una falta, es un hábito — y es una
  // conversación de veinte segundos. Se muestra sin acusar a nadie.
  const hayQueMirarElGps = s.visitas > 0 && s.verificadas < s.visitas * 0.7;

  return (
    <div className="flex flex-col gap-3">
      <Tarjeta className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-texto">Esfuerzo</p>
          <Insignia tono="neutro">
            {`${s.diasVendibles} ${s.diasVendibles === 1 ? "día vendible" : "días vendibles"}`}
          </Insignia>
        </div>
        <Fila etiqueta="Interacciones" valor={String(s.interacciones)} />
        <Fila
          etiqueta="Visitas · verificadas"
          valor={`${s.visitas} · ${s.verificadas}`}
          tono={hayQueMirarElGps ? "aviso" : "normal"}
        />
        <Fila etiqueta="Llamadas y correos" valor={String(s.llamadas)} />
        <Fila etiqueta="Cuentas distintas" valor={String(s.cuentasTocadas)} />
        {s.jornadasGastadas > 0 && (
          <Fila
            etiqueta="Fuera de venta"
            valor={`${s.jornadasGastadas} ${s.jornadasGastadas === 1 ? "jornada" : "jornadas"}`}
          />
        )}
        {hayQueMirarElGps && (
          <p className="text-xs text-aviso">
            {s.fueraDelLocal > 0
              ? `${s.fueraDelLocal} se registraron lejos del local.`
              : "Varias visitas quedaron sin ubicación."}{" "}
            Si fue por señal o por registrar al final del día, dilo en tu cierre.
          </p>
        )}
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-2">
        <p className="text-sm font-medium text-texto">Caza</p>
        <Fila etiqueta="Cuentas nuevas" valor={String(s.cuentasNuevas)} />
        <Fila etiqueta="Compraron de una" valor={String(s.aCliente)} />
        <Fila etiqueta="Descartadas en total" valor={String(s.descartadas)} />
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-texto">Cuidado</p>
          {s.clientes > 0 && (
            <Insignia
              tono={s.fueraDeCadencia.length === 0 ? "ok" : "error"}
            >
              {`${s.enCadencia} de ${s.clientes} al día`}
            </Insignia>
          )}
        </div>
        <Fila
          etiqueta="Compromisos cumplidos"
          valor={String(s.compromisosCumplidos)}
        />
        <Fila
          etiqueta="Compromisos vencidos"
          valor={String(s.compromisosVencidos)}
          tono={s.compromisosVencidos > 0 ? "error" : "normal"}
        />

        {/* Con nombre y no solo el porcentaje: un porcentaje se discute, una
            lista de ocho clientes se trabaja el lunes por la mañana. */}
        {s.fueraDeCadencia.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            <p className="text-xs text-texto-secundario">Te toca ver a:</p>
            {s.fueraDeCadencia.map((c) => (
              <Link
                key={c.id}
                href={`/cuentas/${c.id}`}
                className="flex items-baseline justify-between gap-2 text-sm text-texto underline"
              >
                <span>{c.nombre}</span>
                {c.dias !== null && (
                  <span className="shrink-0 font-mono text-xs text-texto-secundario">
                    {c.dias} días
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Tarjeta>

      {s.pedidos > 0 && (
        <Tarjeta className="flex flex-col gap-2">
          <p className="text-sm font-medium text-texto">Ventas</p>
          <Fila
            etiqueta="Pedidos"
            valor={`${s.pedidos} · ${MONTO.format(s.montoPedidos)}`}
          />
          <p className="text-xs text-texto-atenuado">
            Sale de lo que registraste, no de la factura. Zoho lo confirma
            después.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
