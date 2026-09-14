import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Que el teléfono no se quede con la pantalla vieja después de un despliegue.
   *
   * **Pasó el 14 de septiembre de 2026 y costó una confusión:** se corrigió un botón, se desplegó,
   * y en el iPhone del usuario seguía apareciendo torcido. El código estaba bien —se comprobó en
   * el paquete compilado— pero el teléfono seguía sirviendo la página guardada. Sólo se arregló
   * **cerrando la aplicación por completo y volviendo a abrirla**.
   *
   * **Y el problema real no es ése, sino el que no se ve:** el usuario lo notó porque sabía que
   * había un cambio y lo estaba buscando. Los vendedores no van a saber. Cada despliegue puede
   * quedarse sin llegarles durante días sin que nadie reporte nada raro — simplemente no ven la
   * mejora. En el peor caso, una pantalla vieja hablándole a una base ya cambiada.
   *
   * `no-store` sobre el documento lo evita. **No cuesta rendimiento**, y esa es la parte que lo
   * hace fácil de decidir: todas las pantallas ya se generan en el servidor en cada visita —salen
   * marcadas como dinámicas en la compilación—, así que hoy ya necesitan red para cargar. Lo único
   * que cambia es que el teléfono deja de reutilizar la copia vieja.
   *
   * **Lo que NO entra, y es deliberado:** `_next/static` e `_next/image`. Esos archivos llevan un
   * nombre distinto en cada compilación, así que guardarlos es seguro **y es lo que hace que la
   * aplicación cargue rápido con mala señal en el interior**. Meterlos aquí volvería a bajar todo
   * el JavaScript en cada apertura, que es justo lo que un vendedor en la calle no puede pagar.
   *
   * **No es garantía absoluta.** iOS en modo aplicación es terco y en algún caso raro puede seguir
   * haciendo falta cerrarla del todo. Es el remedio estándar, no una promesa.
   */
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
