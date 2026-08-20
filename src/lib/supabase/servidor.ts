import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * En Next.js 16 `cookies()` es asíncrono, por eso la función devuelve una
 * promesa. Cada petición crea su propio cliente: no se comparte entre usuarios.
 */
export async function clienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesAEscribir) {
          try {
            cookiesAEscribir.forEach(({ name, value, options }) =>
              almacenCookies.set(name, value, options),
            );
          } catch {
            // Un Server Component no puede escribir cookies. No es un error:
            // el refresco de la sesión lo hace src/proxy.ts en cada petición.
          }
        },
      },
    },
  );
}
