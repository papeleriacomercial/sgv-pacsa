import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * En Next.js 16 el antiguo `middleware.ts` se llama `proxy.ts`. La
 * funcionalidad es la misma; solo cambió el nombre del archivo y de la función
 * exportada.
 *
 * Hace dos cosas:
 *
 * 1. Refresca la sesión de Supabase en cada petición y reescribe las cookies.
 *    Sin esto, la sesión expira y los Server Components ven un usuario nulo.
 * 2. Redirige de forma optimista según haya sesión o no.
 *
 * El punto 2 es solo una comprobación optimista, como advierte la guía de
 * autenticación de Next.js: el proxy corre en cada ruta, incluidas las
 * precargadas. **La autorización de verdad la hace el RLS en la base de datos**,
 * no este archivo. Ver docs/03-seguridad-rls.md.
 */

// El manifiesto tiene que servirse sin sesión: el teléfono lo pide *antes*
// de que nadie entre, y redirigirlo a /entrar rompe la instalación en la
// pantalla de inicio sin dar ningún error visible. Los íconos ya salían
// libres porque el `matcher` excluye los .svg.
// `/recuperar` y `/nueva-clave` **tienen que ser públicas**, y la segunda es la
// que no se ve venir: quien llega desde el enlace del correo todavía no tiene
// sesión. Supabase manda su credencial en el fragmento de la dirección —después
// del `#`— y eso **nunca llega al servidor**, así que el proxy vería a un
// desconocido y lo mandaría a /entrar. El enlace del correo no funcionaría
// nunca, sin dar ningún error que explique por qué.
const RUTAS_PUBLICAS = [
  "/entrar",
  "/recuperar",
  "/nueva-clave",
  "/manifest.webmanifest",
];

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesAEscribir, cabeceras) {
          cookiesAEscribir.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          respuesta = NextResponse.next({ request });
          cookiesAEscribir.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
          // Impiden que un CDN cachee una respuesta con cookies de sesión y le
          // sirva el token de un usuario a otro.
          Object.entries(cabeceras ?? {}).forEach(([clave, valor]) =>
            respuesta.headers.set(clave, valor),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((publica) => ruta.startsWith(publica));

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    return NextResponse.redirect(destino);
  }

  if (user && esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
