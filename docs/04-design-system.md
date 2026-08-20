# Sistema de diseño

Deriva de §17 de `00-vision.md`. Los valores provienen de la medición del código del SGP,
no de una propuesta nueva: ambos sistemas son de la misma empresa y deben reconocerse entre
sí.

---

## El principio que manda

**La restricción no es estética, es física.** El vendedor usa el celular a pleno sol, con
una mano y con prisa. De ahí se derivan las tres reglas duras: contraste alto, áreas
táctiles grandes y poco texto por pantalla.

**El color significa estado, no decora.** Los colores saturados se reservan para el
semáforo de estados. Queda un solo acento de marca para las acciones primarias. Esto es lo
que evita que el tablero se vuelva ilegible y lo que da coherencia automática entre
pantallas.

---

## Tokens de color

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Marca / acción | `slate-800` | `#1D293D` | Barra lateral, botón principal, títulos |
| Fondo de pantalla | `slate-50` | `#F8FAFC` | Base |
| Borde por omisión | `slate-200` | `#E2E8F0` | Tarjetas, tablas, campos |
| Texto atenuado | `slate-400` | `#90A1B9` | Etiquetas, dato ausente |
| Texto secundario | `slate-500` / `slate-600` | `#62748E` / `#45556C` | Descripciones y párrafo |
| Activo en navegación | `amber-500` | `#FE9A00` | Barra izquierda del ítem activo, subrayado de pestaña |
| Estado: advertencia / dormido | `amber-500` | `#FE9A00` | |
| Estado: conforme / ganado | `green-600` | `#00A63E` | |
| Estado: error / vencido / perdido | `red-600` | `#E7000B` | |
| Estado: informativo / en curso | `blue-600` | `#155DFC` | |

### La regla del ámbar

El ámbar tiene dos significados según dónde aparezca, y no pueden mezclarse:

- **En el cromo** (navegación, pestaña activa) significa **identidad**.
- **En los datos** significa **riesgo o dormido**.
- **Nunca como botón de acción.** Esa función la toma `slate-800`, para que no compitan.

### Un solo verde

En el SGP conviven `green` y `emerald` para el mismo concepto. Aquí solo existe `green`.

### Los estados nunca dependen solo del color

Siempre acompañados de ícono o etiqueta. Es requisito de legibilidad bajo sol antes que de
accesibilidad, aunque sirva para las dos cosas.

---

## Declaración de tokens

**Ningún color, tamaño ni radio se escribe suelto en el JSX.** Todos los tokens se declaran
una sola vez, en `src/app/globals.css`, dentro del bloque `@theme` de Tailwind v4:

```css
@theme {
  --color-marca: #1D293D;
  --color-fondo: #F8FAFC;
  --color-borde: #E2E8F0;
  --color-texto-atenuado: #90A1B9;
  --color-texto-secundario: #45556C;

  --color-estado-aviso: #FE9A00;
  --color-estado-ok: #00A63E;
  --color-estado-error: #E7000B;
  --color-estado-info: #155DFC;
}
```

Los tonos claros de cada estado (`-50`, `-100`, `-200`, `-700`) se toman de las paletas
`amber`, `green`, `red` y `blue` que Tailwind ya trae, para no declarar cuarenta variables
que nadie va a mantener. Lo que se fija arriba es el tono sólido canónico de cada estado.

**Por qué importa:** el SGP no declaró ninguna variable. Cambiar el gris de los bordes allá
exige reemplazar 1.120 apariciones a mano.

---

## Tipografía

**Una sola familia sans para toda la interfaz, más una monoespaciada** para identificadores
y medidas: números de orden, códigos, cantidades y montos. Es la convención tipográfica más
firme del SGP y aplica igual aquí, donde casi todo son cifras.

- Sans: **Geist**
- Mono: **Geist Mono**

Ambas ya vienen cargadas por `next/font` en `src/app/layout.tsx`, declaradas una sola vez.
No se agregan más familias.

> **Deuda heredada que hay que corregir en el Tramo 2.** El andamiaje de `create-next-app`
> dejó en `globals.css` una regla `body { font-family: Arial, Helvetica, sans-serif; }` que
> pisa las dos fuentes cargadas. Es exactamente el error que §17.1 describe del SGP: fuentes
> cargadas que no se usan porque una regla de `body` las anula. Hay que eliminarla y dejar
> que el `body` use la variable de la fuente sans.

### Escala de tamaños

**Un solo sistema.** Se usan las clases de Tailwind (`text-xs` … `text-2xl`) y nunca
valores arbitrarios del tipo `text-[12px]`. Mezclar los dos sistemas es lo que produjo la
inconsistencia del SGP.

---

## Medidas

- **Alto táctil mínimo de 44px en todo control.** Innegociable: se usa en la calle con una
  mano. En el SGP solo 5 variantes lo cumplen, y allá se usa de pie con una tableta.
- **`rounded-lg` como radio constante** en tarjetas, campos, botones e insignias.
- Íconos de `lucide-react`, de 14 a 18px.

---

## Patrones de estado

| Patrón | Composición |
|---|---|
| Insignia | Fondo `-100`, texto `-700` u `-800` |
| Franja de aviso | Fondo `-50`, borde `-200`, texto `-700` |

Ejemplo: un prospecto vencido lleva insignia `bg-red-100 text-red-700`, con ícono y la
palabra "Vencido". Nunca solo el color.

---

## Componentes compartidos

Se construyen una vez y se usan en todas partes. Su ausencia en el SGP produjo ocho
variantes distintas de campo de formulario.

| Componente | Responsabilidad |
|---|---|
| Tarjeta | Contenedor con borde y radio estándar |
| Insignia | Estado con color, ícono y etiqueta |
| Campo | Etiqueta, control de 44px, error y ayuda |
| Tabla | Densidad de oficina, cabecera fija, orden |
| Botón | Primario (`slate-800`), secundario, destructivo |

**Sin acentos por sección.** El SGP hereda índigo, púrpura, cian y violeta por módulo. Aquí
no: el color es estado, no sección.

---

## Elemento firma: la ficha de punto

Un solo componente que representa a un cliente o prospecto y se ve **idéntico** en el mapa,
en la lista de búsqueda, en el plan del día y en el expediente. Es lo que hace que todo el
sistema se sienta uno solo.

Contenido fijo:

1. Nombre
2. Tipo de comercio
3. Semáforo de estado (color + ícono + etiqueta)
4. Potencial estimado
5. Última interacción

Si un dato falta, se muestra en `slate-400` como dato ausente. No se omite la línea: la
ficha debe tener siempre la misma altura para que las listas sean escaneables.

---

## Estados obligatorios en toda pantalla

Ninguna pantalla se da por terminada sin los cuatro:

1. **Cargando**
2. **Vacío** — con qué hacer a continuación, no solo "sin resultados"
3. **Error**
4. **Sin conexión** — y siempre indicando **qué quedó pendiente de sincronizar**

El cuarto es el que más se olvida y el más importante: el vendedor necesita saber que su
trabajo no se perdió.

---

## Dos densidades, un solo sistema de tokens

- **Campo (móvil).** Una acción principal por pantalla, tarjetas grandes, mínimo texto.
- **Oficina y gerencia (escritorio).** Tablas densas, filtros persistentes, comparativas.

Cambia la densidad, no los tokens.

---

## Lenguaje de interfaz

Verbos en voz activa y consistentes de principio a fin. Si el botón dice "Guardar visita",
la confirmación dice "Visita guardada" — no "Registro almacenado con éxito".

Los nombres son los que la persona reconoce, no los del sistema por dentro: "prospecto", no
"registro"; "visita", no "interacción de tipo 1".

---

## Deuda del SGP que aquí no se repite

Lista de verificación. Cada punto se revisa antes de dar por cerrada una pantalla.

1. Todos los tokens declarados como variables, ninguno suelto en el JSX.
2. Una sola tipografía sans, declarada una vez, sin reglas que la pisen.
3. Un solo verde.
4. Componentes compartidos de tarjeta, insignia, campo y tabla.
5. 44px de alto táctil en todo control.
6. Un solo sistema de tamaños de texto.
7. Sin acentos de color por sección.

---

## Decisión pendiente

**Modo oscuro.** El andamiaje trae un bloque `prefers-color-scheme: dark` que invierte los
colores automáticamente. §17 no lo pide, y para una aplicación que se lee a pleno sol un
tema oscuro automático puede empeorar el contraste justo cuando más se necesita.

Propuesta: **eliminarlo en el Tramo 2** y trabajar con un solo tema claro en Fase 1. Si más
adelante aparece la necesidad, se agrega como preferencia explícita del usuario, no
automática.
