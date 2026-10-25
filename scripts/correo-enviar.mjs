// ===========================================================================
// Mandar un correo de verdad, desde el servidor
//
// **Hasta hoy el sistema no sabía mandar correos.** `src/lib/correo.ts` arma
// enlaces `mailto:` y `https://mail.google.com/…` que abre el teléfono del
// vendedor: el correo lo manda él, con su cuenta, apretando «enviar». Eso es lo
// correcto para una cotización —queda en su bandeja de enviados y el cliente le
// responde a él— pero no sirve para un reporte que tiene que salir el día 1 a
// las siete de la mañana sin que nadie esté delante.
//
// ---------------------------------------------------------------------------
// Por qué una contraseña de aplicación de Gmail y no un servicio de correo
// ---------------------------------------------------------------------------
//
// Las tres cuentas del sistema —GitHub, Supabase, Vercel— son del mismo correo
// de la empresa. Un servicio aparte sería una cuarta cuenta que alguien tiene
// que heredar el día que el dueño no esté, y el Manual de Sucesión del proyecto
// hermano existe precisamente para que eso no pase.
//
// Una contraseña de aplicación es un permiso de 16 caracteres que Google emite
// para un programa concreto: **no es la contraseña de la cuenta**, se revoca
// sola desde la cuenta y no abre el correo ni nada más. Se genera una vez en
// myaccount.google.com → Seguridad → Verificación en dos pasos → Contraseñas de
// aplicaciones, y se guarda como secreto del repositorio.
//
// ---------------------------------------------------------------------------
// Si no hay credenciales, no es un error
// ---------------------------------------------------------------------------
//
// **El reporte se escribe en disco igual.** Un trabajo nocturno que se cae
// entero porque falta un secreto deja al usuario sin el reporte Y sin saber por
// qué; así, el PDF queda guardado y la tarea dice en una línea que el correo no
// salió. El archivo se puede bajar a mano mientras la credencial no esté.
// ===========================================================================

import nodemailer from "nodemailer";

/** Las credenciales del remitente. Sin ellas no se manda, pero nada se rompe. */
export const DE_CORREO = ["CORREO_USUARIO", "CORREO_CLAVE_APP"];

export function puedeMandar(env) {
  return DE_CORREO.every((k) => env[k]);
}

/**
 * Manda un correo con sus adjuntos.
 *
 * @param {Record<string,string>} env
 * @param {{ para: string[], asunto: string, cuerpo: string,
 *           adjuntos?: { nombre: string, contenido: Buffer }[] }} correo
 * @returns {Promise<boolean>} Si salió. `false` cuando faltan credenciales.
 */
export async function mandarCorreo(env, correo) {
  if (!puedeMandar(env)) {
    console.log(
      `\n  El correo NO se mandó: faltan ${DE_CORREO.filter((k) => !env[k]).join(" y ")}.` +
        "\n  El archivo quedó guardado; el envío se activa poniendo esos secretos.\n",
    );
    return false;
  }

  // **Las direcciones se limpian acá y no en quien llama.** Una lista con un
  // hueco —un vendedor sin correo en su perfil— haría fallar el envío entero y
  // nadie recibiría nada. Se manda a los que sí tienen y se dice cuántos no.
  const para = [...new Set((correo.para ?? []).map((d) => (d ?? "").trim()).filter(Boolean))];
  if (para.length === 0) {
    console.log("\n  El correo NO se mandó: ninguna dirección válida.\n");
    return false;
  }

  const transporte = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.CORREO_USUARIO, pass: env.CORREO_CLAVE_APP },
  });

  await transporte.sendMail({
    from: `SGV · Papelería Comercial <${env.CORREO_USUARIO}>`,
    to: para.join(", "),
    subject: correo.asunto,
    text: correo.cuerpo,
    attachments: (correo.adjuntos ?? []).map((a) => ({
      filename: a.nombre,
      content: a.contenido,
    })),
  });

  console.log(`  Correo enviado a ${para.join(", ")}.`);
  return true;
}
