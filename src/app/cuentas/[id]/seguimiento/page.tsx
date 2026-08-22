"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera, MapPin, MapPinOff } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { subirFoto } from "@/lib/fotos";
import { obtenerUbicacion, calidadUbicacion, type Ubicacion } from "@/lib/gps";
import {
  RESULTADOS,
  RESULTADOS_CON_RECONTACTO,
  TIPOS_INTERACCION,
  type Resultado,
  type TipoInteraccion,
} from "@/lib/catalogos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Opciones } from "@/components/ui/opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { MensajeError } from "@/components/ui/estados";
import { AvisoSinConexion } from "@/components/ui/aviso-sin-conexion";
import { BotonVolver } from "@/components/boton-volver";

function hoyEnPanama() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Panama",
  });
}

export default function RegistrarVisita() {
  const router = useRouter();
  const { id: prospectoId } = useParams<{ id: string }>();

  const [tipo, setTipo] = useState<TipoInteraccion>("visita");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [proximoPaso, setProximoPaso] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // El check-in arranca solo al abrir la pantalla, no con un botón: es uno de
  // los gestos que hay que quitar para bajar de 30 segundos.
  useEffect(() => {
    obtenerUbicacion().then((leida) => {
      setUbicacion(leida);
      setBuscandoGps(false);
    });
  }, []);

  const exigeRecontacto =
    resultado !== null && RESULTADOS_CON_RECONTACTO.includes(resultado);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!resultado) return;
    setError(null);
    setGuardando(true);

    const supabase = clienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Se cerró la sesión. Vuelve a entrar.");
      setGuardando(false);
      return;
    }

    const visitaId = crypto.randomUUID();

    // La foto se sube antes de insertar la visita, no después. Las visitas no
    // tienen política de UPDATE —son bitácora—, así que no se les puede pegar
    // la ruta de la foto más tarde.
    let fotoPath: string | null = null;
    if (foto) {
      fotoPath = await subirFoto(supabase, user.id, visitaId, foto);
      if (!fotoPath) {
        setError("No se pudo subir la foto. Revisa la señal e intenta de nuevo.");
        setGuardando(false);
        return;
      }
    }

    const { error: falloVisita } = await supabase.from("seguimientos").insert({
      id: visitaId,
      cuenta_id: prospectoId,
      vendedor_id: user.id,
      tipo,
      resultado,
      notas: notas.trim() || null,
      proveedor_actual: proveedor.trim() || null,
      precio_referencia: precio ? Number(precio) : null,
      foto_path: fotoPath,
      checkin_lat: ubicacion?.lat ?? null,
      checkin_lng: ubicacion?.lng ?? null,
      checkin_precision_m: ubicacion?.precisionM ?? null,
      sin_gps: ubicacion === null,
    });

    if (falloVisita) {
      setError(falloVisita.message);
      setGuardando(false);
      return;
    }

    const { error: falloCompromiso } = await supabase.from("compromisos").insert({
      id: crypto.randomUUID(),
      cuenta_id: prospectoId,
      visita_id: visitaId,
      vendedor_id: user.id,
      descripcion: proximoPaso.trim(),
      fecha_compromiso: fechaCompromiso,
    });

    if (falloCompromiso) {
      setError(
        `La visita quedó guardada, pero el compromiso no: ${falloCompromiso.message}`,
      );
      setGuardando(false);
      return;
    }

    router.replace(`/cuentas/${prospectoId}`);
    router.refresh();
  }

  const calidad = ubicacion ? calidadUbicacion(ubicacion.precisionM) : null;
  const listo = resultado !== null && proximoPaso.trim() && fechaCompromiso;

  return (
    <>
      <AvisoSinConexion />

      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <BotonVolver alterno={`/cuentas/`} />
        <h1 className="text-lg font-semibold text-marca">Registrar seguimiento</h1>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <Tarjeta>
          <div className="flex items-center gap-2">
            {ubicacion ? (
              <MapPin size={18} className="text-ok" aria-hidden />
            ) : (
              <MapPinOff size={18} className="text-aviso" aria-hidden />
            )}
            <div className="flex-1">
              {buscandoGps && (
                <p className="text-sm text-texto-secundario">Tomando check-in</p>
              )}
              {!buscandoGps && calidad && (
                <Insignia tono={calidad.tono}>{calidad.texto}</Insignia>
              )}
              {!buscandoGps && !ubicacion && (
                <>
                  <p className="text-sm font-medium text-texto">Sin GPS</p>
                  <p className="text-xs text-texto-secundario">
                    La visita se guarda marcada como sin ubicación.
                  </p>
                </>
              )}
            </div>
          </div>
        </Tarjeta>

        <form onSubmit={guardar} className="flex flex-col gap-4">
          <Tarjeta>
            <Opciones
              etiqueta="Resultado"
              opciones={RESULTADOS}
              valor={resultado}
              onCambio={setResultado}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <Campo
              etiqueta="Próximo paso"
              required
              value={proximoPaso}
              onChange={(e) => setProximoPaso(e.target.value)}
              ayuda="Qué te comprometiste a hacer."
            />
            <Campo
              etiqueta="Fecha del compromiso"
              type="date"
              required
              min={hoyEnPanama()}
              value={fechaCompromiso}
              onChange={(e) => setFechaCompromiso(e.target.value)}
              ayuda={
                exigeRecontacto
                  ? "Este resultado necesita fecha: es cuándo vuelves antes de que se le acabe el stock."
                  : undefined
              }
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3">
            <label className="text-sm font-medium text-texto">Evidencia</label>
            <label className="min-h-tactil flex cursor-pointer items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto">
              <Camera size={18} aria-hidden />
              {foto ? foto.name : "Tomar foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <p className="text-xs text-texto-secundario">
              Estos dos campos no son obligatorios, pero en seis meses producen
              el mapa de quién domina cada zona y a qué precio. Capturarlos
              después es capturarlos nunca.
            </p>
            <Campo
              etiqueta="Proveedor actual"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
            <Campo
              etiqueta="Precio que paga hoy"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <Opciones
              etiqueta="Tipo de interacción"
              opciones={TIPOS_INTERACCION}
              valor={tipo}
              onCambio={setTipo}
            />
            <Campo
              etiqueta="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Tarjeta>

          {error && <MensajeError titulo="No se pudo guardar" detalle={error} />}

          <Boton type="submit" ancho disabled={guardando || !listo}>
            {guardando ? "Guardando" : "Guardar visita"}
          </Boton>
        </form>
      </main>
    </>
  );
}
