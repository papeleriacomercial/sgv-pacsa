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
  --color-marca: #1d293d;
  --color-marca-suave: #314158;
  --color-fondo: #f8fafc;
  --color-superficie: #ffffff;
  --color-borde: #e2e8f0;

  --color-texto: #1d293d;
  --color-texto-secundario: #45556c;
  --color-texto-atenuado: #90a1b9;

  --color-aviso: #fe9a00;
  --color-ok: #00a63e;
  --color-error: #e7000b;
  --color-info: #155dfc;

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --spacing-tactil: 2.75rem;
}
```

Es el contenido real de `src/app/globals.css`. `--spacing-tactil` es lo que produce la
clase `min-h-tactil` que usan el botón y el campo: los 44px quedan en un solo lugar.

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

> **Deuda heredada, ya corregida.** El andamiaje de `create-next-app` dejaba en
> `globals.css` una regla `body { font-family: Arial, Helvetica, sans-serif; }` que pisaba
> las dos fuentes cargadas: exactamente el error que §17.1 describe del SGP. Se eliminó en
> el Tramo 2; el `body` ahora lleva la clase `font-sans`.

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

Contenido fijo, en tres líneas —actualizado 2026-08-24—:

| Línea | Izquierda | Derecha |
|---|---|---|
| 1 | Nombre | Semáforo de estado (color + ícono + etiqueta) |
| 2 | Tipo de comercio | Lista a la que pertenece, si tiene |
| 3 | **Zona**, y de quién es cuando hay varios vendedores a la vista | Última interacción, o cuánto lleva esperando si es un potencial |

Si un dato falta, se muestra en `slate-400` como dato ausente. No se omite la línea: la
ficha debe tener siempre la misma altura para que las listas sean escaneables.

**El puntaje estimado salió de la ficha.** Era el puntaje 1–5 de §7.5, que se
alimenta de la facturación de Zoho y todavía no existe; como el campo nunca llegó a la base,
todas las fichas decían «Sin calificar». Un tercio de la tarjeta gastado en no decir nada,
mientras la cartera se mezclaba sin que se supiera si una cuenta era de Aguadulce o de
Chitré. Vuelve cuando §7.6 lo haga real.

**Qué contesta cada línea:** arriba, *qué es*; en medio, *de qué tipo y a qué grupo*; abajo,
*dónde queda y de quién es*, contra *cuándo se le habló*. Con la cartera de tres vendedores
mezclada, esa tercera línea es la que evita tener que abrir la cuenta para orientarse.

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

## Modo oscuro: descartado

Se eliminó el bloque `prefers-color-scheme: dark` que traía el andamiaje. La aplicación
tiene un único tema claro. §17 no lo pide, y un tema oscuro que se activa solo según la
configuración del celular cambia el contraste justo cuando más se necesita. Si aparece la
necesidad, se agregará como preferencia explícita del usuario, nunca automática.

Ver D-006 en `06-decisiones.md`.

---

## Identidad — agregado 2026-08-24

La aplicación no decía en ninguna parte de quién era ni cómo se llamaba. La maqueta de
referencia (`docs/sgv-preview.html`, heredada del SGP) resolvía eso con un bloque en la barra
lateral: **Papelería Comercial** en blanco sobre azul marino, y debajo «SGV · Gerencia».

Aquí no hay barra lateral —esto se usa con una mano en la calle— así que ese bloque **se
acuesta**:

| Dónde | Qué se ve |
|---|---|
| Todas las pantallas con sesión | Una franja de 32 px: `Papelería Comercial` a la izquierda, `SGV · <rol>` a la derecha, sobre `--color-marca`, con filo ámbar de 2 px |
| Pantalla de entrada | El bloque completo: dueño arriba, sistema debajo. Es la única pantalla con sitio de sobra y la primera que ve alguien que no conoce la aplicación |
| Pestaña del navegador | `SGV · Papelería Comercial` |
| Instalada en el teléfono | `SGV` bajo el ícono; `SGV · Papelería Comercial` en la lista de aplicaciones |

**Una línea y no dos.** La cabecera de cada pantalla ya ocupa unos 48 px; un bloque de marca de
dos líneas encima dejaría casi cien de cromo antes del primer dato, en un teléfono y a pleno
sol.

**El filo ámbar** es la regla del ámbar en su otro sentido: en el cromo significa **identidad**,
no riesgo. Es el mismo gesto que el subrayado naranja del SGP, y es lo que hace que quien usa el
SGP reconozca el SGV de inmediato.

**El ícono** (`src/app/icon.svg`) es el monograma SGV en blanco sobre marino, con una barra
ámbar debajo — el mismo filo, en pequeño. Sustituye al favicon que traía Next.js de fábrica.

**Pendiente:** el ícono de pantalla de inicio de iOS necesita un PNG; hoy solo hay SVG, que
Android sí acepta.
