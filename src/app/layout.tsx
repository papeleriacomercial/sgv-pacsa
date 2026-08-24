import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Navegacion } from "@/components/navegacion";
import { BarraMarca } from "@/components/barra-marca";

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
  // Lo que se lee en la pestaña, al compartir un enlace y en la lista de
  // aplicaciones instaladas. Antes decía «SGV» a secas, que no le dice nada
  // a quien no sabe ya lo que es.
  title: {
    default: "SGV · Papelería Comercial",
    template: "%s · SGV",
  },
  description: "Sistema de Gestión de Ventas de Papelería Comercial.",
  applicationName: "SGV",
  appleWebApp: { capable: true, title: "SGV", statusBarStyle: "default" },
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
        {/* La identidad va arriba de todo y en todas las pantallas. Sin
            sesión no se dibuja: la pantalla de entrada trae la suya, más
            grande, porque ahí sí hay sitio y es lo primero que se ve. */}
        {rol && <BarraMarca rol={rol} />}
        {children}
        <Navegacion rol={rol} />
      </body>
    </html>
  );
}
