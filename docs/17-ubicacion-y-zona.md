# Ubicación y zona

**Fecha:** 2026-09-13 · **Estado:** construido el 2026-09-14 (D-073 a D-076)

Este documento separa dos cosas que hoy comparten un solo campo: **dónde está una cuenta** y
**por dónde pasa el vendedor**. Se escribió porque la confusión ya llegó a una reunión y a los
datos, y porque el arreglo toca cuatro pantallas.

---

## El problema, en una frase

El campo `poblado` de una cuenta lo escribe el vendedor a mano, y **se le está metiendo el
nombre del recorrido en vez del nombre del lugar.**

Hay dieciséis cuentas que dicen vivir en un pueblo llamado `CALIDONIA Y CENTARL`. Ese pueblo no
existe: es el nombre de una lista. Y esas dieciséis cuentas están repartidas, en la realidad, en
**diez corregimientos y cuatro provincias** — de Calidonia a Penonomé, y hasta Los Santos.

No es un campo sucio que haya que limpiar. **Es un campo que no significa nada.**

---

## Las dos palabras que causaron la confusión

En la ciudad de Panamá, «zona» quiere decir el recorrido de un día: «de San Francisco a
Betania». En el interior, «poblado» quiere decir el pueblo. Son dos ideas distintas y estaban
compartiendo columna.

| Palabra | Qué significa | Dónde vive | ¿Cambia? | ¿Cuántas por cuenta? |
|---|---|---|---|---|
| **Zona** | El recorrido de un día | El **nombre de la lista** | Cada semana | Varias |
| **Ubicación** | Dónde está el punto | Tres columnas de la cuenta | Nunca | Una |

La prueba de que no pueden compartir campo es aritmética: **el recorrido es de varios a varios.**
Un punto en Betania va a estar este mes en «San Francisco–Betania» y el próximo en otro. Eso no
cabe en una columna de texto, y para eso ya existe `listas_cuentas`.

`CHILIBRE-LA CABIMA` es un nombre de lista perfecto. El problema nunca fue que existiera: es que
se copiaba al campo de la ubicación.

---

## Lo que se midió antes de decidir

Sobre las 759 cuentas vivas, el 13 de septiembre de 2026:

- **383 no tenían poblado.** De las 376 que sí tenían algo escrito, **todas tienen coordenadas**:
  ni una sola se queda sin poder recalcularse. Es el dato que permite rehacerlo todo sin perder
  nada de lo que alguien escribió.
- **45 poblados distintos escritos de 48 formas.** `Chitré`/`Chitre`, `Las tablas`/`Las Tablas`,
  `Penonome`/`Penonomé`, y `Chorrera` junto a `La Chorrera` sin que nada los junte.
- **Seis filas que no son lugares:** `WJ4V+7W2`, `Manzana 070301 99-35`, `Carr. Interamericana`,
  `Hacia`, `Frente a la estación de combustible el Puma`, `PEDREGAL`.
- **De 240 direcciones escritas, 232 son un pegado de Google** y solo 8 las escribió una persona.
  De las pegadas, **112 empiezan con un código plus**, que es Google diciendo «aquí no sé la
  dirección».

Ese último número es el que más dice: **le estamos pidiendo al vendedor que teclee lo que la
máquina ya sabe, y no le estamos capturando lo único que solo él sabe.**

---

## Los cuatro campos

| Campo | ¿Lo escribe alguien? | De dónde sale |
|---|---|---|
| **Provincia** | No | El punto en el mapa |
| **Distrito** | No | El punto en el mapa |
| **Corregimiento** | No | El punto en el mapa |
| **Cómo llegar** | **Sí, a mano** | La cabeza del vendedor |

Y la **zona** en el nombre de la lista, que es donde el vendedor ya la pone.

### Por qué tres y no uno

**Porque los dos vendedores necesitan niveles distintos.** El del interior agrupa por distrito
—Aguadulce, Chitré— y ahí el distrito *es* el pueblo. El de la ciudad necesita el corregimiento,
porque toda la ciudad de Panamá es un solo distrito y decir «distrito de Panamá» no ubica nada.

Un campo no puede servir a los dos. **Ese fue el error original.**

Y porque tres columnas filtran y una línea de texto no: «todo Herrera», «distrito de Aguadulce»,
«corregimiento de Betania» pasan a ser un clic cada uno, y los números suman.

### Por qué «Cómo llegar» sí se escribe

Es el único campo de los cuatro que una máquina no puede producir:

> «Frente al estadio Rico Cedeño»
> «Frente a la estación de combustible el Puma, Av. Juan Demóstenes Aroseme»

Eso lo escribió alguien que estuvo parado ahí. Ningún polígono, ninguna API y ningún dato oficial
lo va a dar nunca, y en el interior —donde no hay números de casa— es literalmente cómo se llega.

La regla queda así: **todo lo que el mapa puede saber, el vendedor no lo escribe; lo único que el
mapa no puede saber, sí.** Se deja de pegar la salida de Google ahí, y se limpian los 232 pegados,
que hoy hacen que el campo parezca lleno cuando está vacío de información.

### Lo que cambia para el vendedor

**Nada, y menos trabajo.** Busca el comercio en Google Maps como siempre, pone el punto, y los
tres campos aparecen llenos. Su tarea pasa de «escribe el pueblo» a «marca el punto», que es una
sola cosa, más fácil con una mano y a pleno sol, y que ya se le pide para el mapa.

---

## De dónde salen los límites

El Estado panameño tiene dibujados los contornos de cada corregimiento. Ese archivo se carga
**una vez** como una tabla en la base, y ahí se queda: no es un servicio, no se consulta por
internet, no cuesta y no se cae. El cálculo —«¿dentro de qué contorno cayó este punto?»— corre
dentro de Postgres al guardar, en milisegundos.

**Funciona mejor que preguntarle a Google**, y por razones concretas: sirve con mala señal en el
interior, es instantáneo, no cuesta por consulta, da los corregimientos oficiales en vez de
nombres de barrio como «Obarrio» o «El Cangrejo» que no agrupan con nada, y no choca con la
restricción legal de Places —de Google solo se puede guardar indefinidamente el `place_id`.

### Qué archivo, y por qué no el del INEC

| Fuente | Corregimientos | Distritos | Licencia | ¿Se puede bajar? |
|---|---|---|---|---|
| INEC, GeoNode | — | — | oficial | Sí, pero es de **2015 a 1:250.000** |
| geoBoundaries | 632 | 76 | **sin definir** | Sí |
| **Smithsonian 2024** | **699** | — | **CC-BY-SA-4.0** | **Sí, `Extract` permitido** |
| IGN Tommy Guardia 2025 | 730 | 94 | oficial | **No: sirve nombres, no geometría** |

El del INEC está a 1:250.000, escala a la que el borde tiene cientos de metros de imprecisión: no
distingue Betania de Bella Vista, que es justo para lo que se necesita.

**El mejor es el del Instituto Geográfico Nacional Tommy Guardia** —2025, a 1:25.000, con la ley y
la gaceta de cada corregimiento— pero su servidor entrega los nombres y la imagen del mapa, **no
los polígonos**. Sin geometría no se puede calcular nada.

**Se construye con el del Smithsonian y se pide el oficial en paralelo.** El diseño no depende de
cuál archivo sea —depende de tener polígonos con los tres nombres— así que cambiarlo después es
una migración y nada más. No tiene sentido dejar el trabajo parado esperando una solicitud.

La capa del Smithsonian trae **provincia, distrito y corregimiento en la misma fila**, más el
código oficial del censo y una marca de si es cabecera. Un solo cálculo llena los tres campos.

**La licencia CC-BY-SA obliga a dar crédito.** Para uso interno basta una línea de atribución en
la documentación; lo que exige es que si algún día se distribuye la base derivada, se comparta
igual.

---

## La comprobación

Se calcularon los tres niveles para las 552 cuentas que tienen coordenadas, y se contrastaron
contra lo que el vendedor había escrito a mano. **Con dos archivos distintos, para que el
resultado no dependiera de uno:**

| | geoBoundaries (632) | Smithsonian (699) |
|---|---|---|
| Puntos resueltos | 551 de 552 | **551 de 552** |
| Coinciden con el vendedor | 88% | **87%** |

**El archivo más nuevo no subió la puntería, y eso es lo que había que comprobar.** Las
discrepancias no son del archivo: son de los humanos. De las 48 que quedan, **16 vienen del
nombre de una lista.**

Y del 87% que coincide, el desglose confirma el diagnóstico: **277 habían escrito el distrito**
—los del interior— y **51 el corregimiento** —los de la ciudad. Los dos niveles estaban ahí,
mezclados en una sola columna.

La basura se resuelve sola: `WJ4V+7W2` cae en Santa Ana, Los Santos. `Hacia` cae en Progreso,
Barú. `Frente a la estación de combustible el Puma` cae en Penonomé.

**Y se cerró una duda que llevaba días abierta:** de las cuentas que decían `San Francisco`, 38
están en el corregimiento de San Francisco **de la capital** y solo una en el de Veraguas.

### Cómo queda la cartera

```
213  Panamá          55  Los Santos       5  Chiriquí, Bocas y Colón
113  Coclé           42  Veraguas
 92  Herrera         31  Panamá Oeste
```

Y aparecen agrupaciones que el texto libre nunca pudo dar: `Omar Torrijos (San Miguelito)` con 16,
`Barrio Colón (La Chorrera)` con 12, `San Juan Bautista (Chitré)` con 16.

---

## Qué hay que desmontar

Tres sitios dan por sentado que la ubicación es texto libre y que la lista la dicta:

1. **[`src/lib/potenciales.ts`](../src/lib/potenciales.ts)** — el poblado de la lista **se hereda**
   a cada cuenta que entra desde ella. Es el mecanismo por el que el nombre del recorrido se
   convirtió en la ubicación de dieciséis cuentas. **Se elimina.**
2. **[`src/app/listas/[id]/cruzada/page.tsx`](../src/app/listas/%5Bid%5D/cruzada/page.tsx)** —
   filtra con igualdad exacta de texto contra el poblado de la lista. Si se limpian los datos sin
   tocar esto, **la pantalla se queda vacía sin dar error**. Pasa a filtrar por los corregimientos
   presentes en la lista.
3. **[`src/components/buscador-prospectos.tsx`](../src/components/buscador-prospectos.tsx)** — el
   prellenado del campo desde la lista. Ya no hace falta.

La cotización también compone la dirección con el poblado
([`src/lib/cotizacion-pdf.ts`](../src/lib/cotizacion-pdf.ts)); ahí mejora sola, porque hoy imprime
`CALIDONIA Y CENTARL` y pasaría a imprimir `Betania`.

---

## Lo que este diseño no resuelve

**Las 207 cuentas sin coordenadas se quedan sin ubicación.** No hay de dónde sacarla. Pero deja de
ser un hueco invisible y se vuelve una tarea con un aviso claro: marcar el punto. Es la misma
acción que ya se pide para el mapa.

**Va a haber casos correctos pero sorprendentes.** Dos cuentas que el vendedor puso en `Chitré`
caen en **La Villa de Los Santos**, y el polígono tiene razón: son pueblos pegados, separados por
el río, pero de provincias distintas. El vendedor dice «Chitré» porque es donde trabaja; el mapa
dice Los Santos porque es donde está.

Por eso la corrección tiene que existir — **pero no como texto libre.** Se puede escoger otro de
la lista oficial, nunca escribir, y la corrección queda en `auditoria`. Así nadie inventa un
nombre, y si alguien corrige mucho, se nota.

**Faltan 31 corregimientos** respecto a la división de 2025 (699 contra 730): los creados
últimamente. Un punto dentro de uno nuevo resuelve al corregimiento viejo que lo contenía. **El
distrito siempre queda bien**; el corregimiento puede quedar desactualizado en esos casos. Es otra
razón para pedir el archivo oficial, sin que sea motivo para esperarlo.

**Un punto no cayó en ningún polígono** de 552. O está mal marcado o está en el mar. Hay que
mirarlo al construir.

---

## Orden de construcción

1. **Activar PostGIS** y cargar la capa de corregimientos como tabla propia, con la geometría
   simplificada. El archivo crudo pesa cientos de megas; simplificado baja a pocos.
2. **Las tres columnas** en `cuentas`, y la función que las llena desde el punto. Con disparador,
   para que las cargas masivas tampoco puedan escribir una ubicación inventada.
3. **Rellenar las 552** que tienen coordenadas, en la misma migración.
4. **Las pantallas:** la ubicación de solo lectura en el expediente y en la edición, «Cómo llegar»
   como campo libre y opcional, y los tres filtros en la cartera.
5. **Desmontar los tres acoplamientos** de la sección anterior. Va en el mismo empujón que el
   paso 3, no después.
6. **La corrección auditada**, que es lo último porque solo hace falta cuando alguien encuentre un
   caso de borde.
