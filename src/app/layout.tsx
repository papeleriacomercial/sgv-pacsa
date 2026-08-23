import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Navegacion } from "@/components/navegacion";

type Rol = "gerente" | "lider" | "vendedor" | "administracion";

/**
 * El rol para la barra de navegación.
 *
 * Se lee aquí y no en cada pantalla porque la barra vive en el layout. Si no
 * hay sesión —o la consulta falla— la barra ni se dibuja: la pantalla de
 * entrada no tiene a dónde navegar.
 */
async function rolDelUsuario(): Promise<Rol | undefined> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  return (data?.rol as Rol) ?? "vendedor";
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SGV",
  description: "Sistema de Gestión de Ventas",
};

export const viewport: Viewport = {
  themeColor: "#1d293d",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const rol = await rolDelUsuario();

  return (
    <html
      lang="es-PA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Navegacion rol={rol} />
      </body>
    </html>
  );
}
