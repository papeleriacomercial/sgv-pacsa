import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes que corren en el navegador.
 *
 * Usa la llave `anon`, que es pública por diseño: viaja al navegador. Lo que
 * protege los datos es el RLS, no el secreto de la llave. Ver
 * docs/03-seguridad-rls.md.
 */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
