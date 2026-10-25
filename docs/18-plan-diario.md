# 18 · El plan diario

**Estado: ACORDADO Y EN CONSTRUCCIÓN — 2026-10-25.** Reemplaza el contrato semanal como mecánica
de planificación.

> **Lo aprobado, y en qué orden va.** El usuario aprobó ir directo a producción el 25 de octubre de
> 2026 —*«los vendedores ahora mismo no están haciendo uso full time de la herramienta y podemos
> aventurarnos»*— con una condición que se comprobó pieza por pieza antes de escribir código: *«lo
> importante es que no se les borre sus listas, sus cuentas, sus mapas»*. **No se altera ninguna
> tabla existente**; todo entra en tablas nuevas.
>
> | | |
> |---|---|
> | **Capa 1 · el plan diario** | Escrita, compila y con pruebas. **Falta aplicar la migración**: hasta entonces no se publica en `main`, porque la pantalla ofrecería un botón que no puede guardar |
> | **Capa 2 · los cierres declarados** (§5) | Sin empezar |
> | **Capa 3 · el tablero de gerencia** (§4.4) | Sin empezar |
> | **Capa 4 · el reporte semanal por correo** (§4.5) | Sin empezar. El envío ya existe: `scripts/correo-enviar.mjs` |
> | **El histórico mensual** (§5.8) | **Construido y corriendo.** No dependía de nada de acá |

> **Y hoy no hay ambiente de prueba.** Está comprobado y escrito en
> [16-paso-a-produccion.md](16-paso-a-produccion.md): Vercel sirve una sola base para `production`,
> `preview` y `development`, así que la rama `dev` escribe en producción. El usuario decidió salir
> así a propósito, para poder avisarles a los vendedores y recoger su reacción.

> **De qué se trata, en una frase.** El vendedor arma su día antes de empezarlo y lo cierra antes de
> irse —con lo que vendió, en cantidad y en plata—; la semana deja de ser el plan y pasa a ser la
> rendición.

---

## 1 · Por qué se cambia

El contrato semanal **no se está cumpliendo**, y el usuario lo describió sin adornos:

> *«Algunos no reparten su semana y sencillamente no veo esto, no tengo un mecanismo de
> reclamo… no hay consecuencias. Por lo tanto, sigo vendiendo, me siguen pagando mis
> comisiones. Y la herramienta se queda como algo opcional.»*

Y sobre las tres preguntas del cierre:

> *«Esto de las preguntas, de qué te frena, qué te sorprendió, eso no está funcionando. Yo
> estaba agarrando eso de poner cualquier frase ahí.»*

**El concepto se lo había advertido a sí mismo.** `10-concepto.html` dice: *«un relato suelto
se vuelve teatro en un mes; uno anclado tiene que reconciliar con la realidad»*. Puso tres
preguntas concretas justamente para evitarlo. **No alcanzó, y conviene entender por qué: la
pregunta estaba anclada a números, pero no había nada que dependiera de la respuesta.** Un
ancla sin consecuencia es decoración.

### El diagnóstico, en cuatro renglones

| | |
|---|---|
| **La frecuencia** | Un ritual semanal compite con cinco días de ruido. Uno diario es parte de empezar a trabajar |
| **La visibilidad** | Gerencia no ve quién no planificó hasta que pasó la semana |
| **La consecuencia** | No hay ninguna, ni blanda ni dura |
| **El contenido** | El cierre pregunta por sensaciones y no por metas |

---

## 2 · El ciclo, de punta a punta

```
      MAÑANA                    DURANTE EL DÍA              ANTES DE IRSE
  ┌──────────────┐          ┌──────────────────┐        ┌──────────────┐
  │ Abrir el día │ ───────▶ │  Trabajar        │ ─────▶ │ Cerrar el día│
  │              │          │                  │        │              │
  │ · Seguimientos│         │ El plan es la    │        │ Un toque por │
  │   que el      │         │ lista del día:   │        │ línea:       │
  │   sistema     │         │ se trabaja desde │        │ ¿se hizo?    │
  │   impone      │         │ él, no aparte    │        │              │
  │ · Hasta 3     │         │                  │        │ Lo no hecho  │
  │   acciones    │         │                  │        │ cae en el    │
  │   propias     │         │                  │        │ plan de      │
  │ · Una nota    │         │                  │        │ mañana       │
  └──────────────┘          └──────────────────┘        └──────────────┘
                                                                │
   VIERNES ───────────────────────────────────────────────────┘
   Al cerrar el viernes, el reporte de la semana se genera solo.
```

**La semana cambia de papel.** Deja de ser donde se planifica y pasa a ser donde se rinde
cuentas:

| | Antes | Ahora |
|---|---|---|
| **Planificación** | Semanal | **Diaria** |
| **Rendición** | Semanal | Semanal, **en una página** |
| **Respuesta de gerencia** | Semanal | Semanal, **sobre esa página** |

---

## 3 · Las cuatro reglas que lo sostienen

Sin estas cuatro, esto vuelve a ser teatro en un mes. No son detalles de pantalla.

### 3.1 · Hora de corte

**El plan se abre antes de las 9:00** —decidido por el usuario el 25 de octubre de 2026, y queda
como parámetro para poder moverlo sin desplegar—. Un plan que se puede hacer a las 3 de la tarde no
es un plan: es un reporte de lo que ya pasó.

Pasada la hora, el día **sigue funcionando** —se puede trabajar— pero queda marcado como
*«arrancó sin plan»*, y eso es lo que se ve y lo que cuenta.

> **Por qué no se traba la aplicación.** Es tentador y es el peor de los frenos: un vendedor
> sin plan que no puede registrar una visita **no registra la visita, pero la visita ocurre
> igual**. Se traba el dato, no la conducta, y encima se le regala la excusa — *«no pude usar
> la herramienta»*. Lo que se traba, si acaso, es lo que a él le sirve.

### 3.2 · Los seguimientos no se escogen: se imponen

El sistema ya sabe qué compromisos vencen hoy y cuáles están vencidos. **Esa sección aparece
armada y no se puede saltar** — se despacha, aunque sea posponiendo con motivo.

> **Por qué primero.** Es práctica estándar y la razón es aritmética: una oportunidad abierta
> convierte mucho mejor que un contacto frío. Prospectar con el embudo sucio es trabajar por
> lo más caro.

### 3.3 · Tres acciones propias, no más

Los seguimientos no cuentan —son rutina—. **Lo que el vendedor decide son hasta tres
acciones.** Si quiere una cuarta, quita una.

> **Una lista de doce es una lista de cero.** La restricción es la que obliga a elegir, y
> elegir es justamente lo que gerencia quiere ver.

### 3.4 · Se escoge, no se escribe

Cada acción se arma **eligiendo de lo que ya existe** —una lista, cuentas del catálogo,
reparto— y lleva **su meta en número**.

```
  Acción 1   Llamar en frío  →  lista «Chitré Centro» (25 contactos)  →  meta: 10
  Acción 2   Visitar         →  lista «Ruta Azuero» (8 cuentas)       →  meta: 5
  Acción 3   Reparto         →  3 entregas
```

**El texto libre existe, pero colgado de algo.** La nota del día —*«hoy cierro con la cuenta
tal, está esperando aprobación»*— va **atada a una cuenta real**, no suelta. Así mañana el
sistema puede preguntar *«¿cerró?»*.

---

## 4 · Las pantallas

### 4.1 · La Agenda del vendedor — hoy y cómo queda

**Hoy** `/` se llama *Agenda* y muestra compromisos del día, paradas y sus listas: es un
**tablero de lo que hay**. Lo que le falta es el acto de comprometerse.

**No se reemplaza: se le pone un sombrero.** Arriba del todo, el plan del día; debajo, lo que
ya tiene. Antes de abrir el plan, la pantalla está en un solo estado.

```
┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│  Lunes 26 de octubre                    │   │  Lunes 26 · plan abierto 8:47           │
│                                         │   │                                         │
│  ┌───────────────────────────────────┐  │   │  SEGUIMIENTOS DE HOY          3 de 5 ✓  │
│  │                                   │  │   │  ─────────────────────────────────────  │
│  │     Todavía no armas tu día       │  │   │  ✓ Súper Rey · llamar                   │
│  │                                   │  │   │  ✓ Farmacia Lux · cotización            │
│  │        [ Armar mi día ]           │  │   │  ○ Mini Max · visita     [hacer][posponer]│
│  │                                   │  │   │                                         │
│  │   Son 2 minutos. Tienes 5         │  │   │  MIS ACCIONES                           │
│  │   seguimientos esperando.         │  │   │  ─────────────────────────────────────  │
│  └───────────────────────────────────┘  │   │  1 · Llamar en frío                     │
│                                         │   │      Chitré Centro · meta 10      4/10  │
│  ── lo de siempre, debajo ──            │   │  2 · Visitar                            │
│  Paradas · Tus listas · Reponer         │   │      Ruta Azuero · meta 5         2/5   │
│                                         │   │  3 · Reparto · 3 entregas         0/3   │
│                                         │   │                                         │
│                                         │   │  NOTA DEL DÍA                           │
│                                         │   │  «Cierro con Súper Rey, espera          │
│                                         │   │   aprobación» → Súper Rey, S.A.         │
│                                         │   │                                         │
│                                         │   │          [ Cerrar mi día ]              │
└─────────────────────────────────────────┘   └─────────────────────────────────────────┘
        ANTES DE ARMAR EL DÍA                          DURANTE EL DÍA
```

**El contador de cada acción sube solo** con lo que el vendedor registra en el resto de la
aplicación. No se teclea: si visitó, la visita ya está.

### 4.2 · Armar el día

Tres pasos, sin texto libre hasta el final.

```
┌─────────────────────────────────────────┐
│  Armar el lunes 26                      │
│                                         │
│  1 · TUS SEGUIMIENTOS            5      │
│     Ya están. No hace falta elegir.     │
│     2 vencidos · 3 para hoy             │
│                                         │
│  2 · ¿QUÉ MÁS VAS A HACER?   hasta 3    │
│     [+ Llamar en frío ]                 │
│     [+ Visitar        ]                 │
│     [+ Reparto        ]                 │
│                                         │
│     ── al tocar «Visitar» ──            │
│     ¿De dónde?   ( ) Una lista          │
│                  ( ) Cuentas sueltas    │
│     Lista: [ Ruta Azuero ▾ ] 8 cuentas  │
│     ¿Cuántas mínimo?  [ 5 ]             │
│                       la semana pasada  │
│                       hiciste 4 de 6    │
│                                         │
│  3 · ALGO MÁS (opcional)                │
│     [ ................ ] sobre [cuenta▾]│
│                                         │
│            [ Abrir mi día ]             │
└─────────────────────────────────────────┘
```

> **El renglón gris bajo la meta es lo que evita que se fije en lo que ya cumple.** Sin
> referencia, todo el mundo promete lo que sabe que puede. Más adelante ese renglón se vuelve
> una propuesta de verdad — ver §8.

### 4.3 · Cerrar el día

Un toque por línea. **Si toma diez minutos, muere en una semana.**

```
┌─────────────────────────────────────────┐
│  Cerrar el lunes 26                     │
│                                         │
│  Seguimientos      5 de 5    ✓          │
│                                         │
│  1 · Llamadas Chitré   meta 10 · hizo 10 ✓
│  2 · Visitas Azuero    meta 5  · hizo 2  │
│       ¿Qué pasó?                         │
│       ( ) Me faltó tiempo                │
│       (•) Cambió el día de un cliente    │
│       ( ) Otra cosa → [ ........ ]       │
│       ☑ Pasar las 3 que faltan a mañana  │
│  3 · Reparto           3 de 3        ✓   │
│                                          │
│  ¿CERRASTE ALGO HOY?                     │
│  ─────────────────────────────────────   │
│  Súper Rey, S.A.                         │
│     Cotización C-0412       $1 240,00 ✓  │
│     ya la marcaste ganada hoy            │
│                                          │
│  [ + Agregar un cierre sin documento ]   │
│                                          │
│  Hoy declarado:            $1 240,00     │
│                                          │
│  Nota: ¿cerró Súper Rey?  [sí] [todavía] │
│                                          │
│            [ Cerrar el día ]             │
└─────────────────────────────────────────┘
```

**Lo que ya marcó ganado durante el día aparece solo.** No se teclea dos veces: la cotización
cerrada trae su cuenta, su monto y sus renglones. Lo único que se captura a mano es la venta que no
pasó por documento — y de eso trata §5.

**Lo no cumplido cae solo en el plan de mañana.** Ahí está la secuencia que el usuario pedía
—*«qué van a hacer con aquellas metas que no se cumplieron, cómo la van a rescatar»*— pero
diaria en vez de semanal, y sin que nadie redacte nada.

**Los motivos son una lista corta, no una caja.** Una lista se puede contar al cabo de dos
meses; *«el tráfico»* escrito cuarenta veces, no.

### 4.4 · El tablero de gerencia — una línea por persona

**Ésta es la pantalla que decide si todo lo demás sobrevive.**

```
┌──────────────────────────────────────────────────────────────┐
│  Lunes 26 de octubre                                9:14 am  │
│                                                              │
│  Eduardo    plan 8:47   seg 3/5   acciones 2/3     ▸         │
│  Marcos     plan 9:02   seg 5/5   acciones 3/3     ▸         │
│  Líder      SIN PLAN ← segundo día seguido         ▸         │
│                                                              │
│  ── esta semana ──                                           │
│  Eduardo    5 de 5 días con plan  ·  4 cerrados  ·  $12 400  │
│  Marcos     5 de 5                ·  5 cerrados  ·  $8 150   │
│  Líder      3 de 5                ·  2 cerrados  ·  $21 900  │
│             con plan / cerrados / facturado del mes          │
└──────────────────────────────────────────────────────────────┘
```

> **Por qué una línea y no las agendas.** Con tres personas, leer las agendas completas son
> **quince documentos por semana**. Se leen tres semanas y se deja — igual que se dejó de leer
> el cierre semanal, y entonces el plan diario vuelve a ser opcional. **El gerente no revisa
> lo que se cumple: revisa lo que se rompe.** La línea se lee en diez segundos todos los días
> durante dos años.

**Y se puede entrar al detalle.** Pedido expreso del usuario: *«si ellos ponen que solamente
van a haber 3 clientes, poder ver cuáles son esos 3 clientes… y entender si efectivamente son
clientes que demandan mucho tiempo o sencillamente se puso una meta muy fácil»*. El `▸` abre
el plan completo del día: qué listas, qué cuentas, qué metas.

**Gerencia no interviene en el día.** Lo dijo el usuario y conviene respetarlo: mira, y si
algo le llama la atención lo trata por fuera. **La intervención escrita es semanal.**

### 4.5 · El reporte de la semana

**Se genera solo al cerrar el viernes.** El vendedor no lo redacta: es la suma de cinco días
de hechos. Una página, 8½ × 11, para imprimir.

```
┌─────────────────────────────────────────────────────────────┐
│  SEMANA DEL 26 AL 30 DE OCTUBRE          Eduardo Pérez      │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  DISCIPLINA        5 de 5 días con plan · 5 cerrados        │
│                                                             │
│  LO QUE PROMETIÓ Y LO QUE HIZO                              │
│         Llamadas    50  →  47      94%                      │
│         Visitas     25  →  18      72%                      │
│         Reparto     12  →  12     100%                      │
│         Seguimientos 22 →  20      91%                      │
│                                                             │
│  POR DÍA           L  M  X  J  V                            │
│         plan       ✓  ✓  ✓  ✓  ✓                            │
│         cumplido  80 100 60 90 100 %                        │
│                                                             │
│  LO QUE NO SALIÓ, Y POR QUÉ                                 │
│         Visitas Azuero · 7 pendientes                       │
│         Motivo más repetido: cambió el día del cliente (3)  │
│                                                             │
│  LO QUE CERRÓ      3 cotizaciones emitidas                  │
│         Súper Rey, S.A.      25 fardos      $1 240          │
│         Mini Max           1 000 bolsas       $890          │
│         Farmacia Lux       venta directa    $2 150          │
│                            ─────────────────────────        │
│         Declarado en la semana              $4 280          │
│         Facturado de esa semana             $4 280   ✓      │
│                                                             │
│  EL MES            octubre, al viernes 30                   │
│         Facturado                          $12 400          │
│         Comisión ganada (1,5 % sin ITBMS)     $186,00       │
│         Mejor mes del año: agosto          $18 260          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  OBSERVACIÓN DE GERENCIA                                    │
│  ........................................................   │
│  ........................................................   │
└─────────────────────────────────────────────────────────────┘
```

**La observación de gerencia queda en el histórico**, igual que hoy: la tabla `cierres` ya
tiene `respuesta`, `respondido_por` y `respondido_en`. No hace falta inventar nada.

---

## 5 · Los cierres: lo que se vendió

**Es la mitad que faltaba.** Un plan diario que sólo cuenta llamadas y visitas mide el esfuerzo y no
el resultado, y el usuario lo cortó al leerlo: *«falta lo principal, enganchar los cierres, que
diariamente también pueda reportar qué cerró y por qué cantidad»*.

### 5.1 · Casi nada de esto hay que construir

**Lo primero es decir qué ya existe**, porque la respuesta cambia el diseño entero:

| | |
|---|---|
| `transacciones_zoho` | Cada factura y cada entrega, con su fecha, su total y su vendedor. La trae la pasada de noche |
| `renglones_zoho` | Qué se vendió en cada una: producto, **cantidad** y precio |
| `ventas_del_mes` | Lo vendido por vendedor y por **mes calendario**, con y sin ITBMS |
| `comision_del_mes()` | La comisión ya ganada: **1,5 % sobre el neto**, calculada al leer y nunca guardada |
| `cotizaciones` → ganada | El vendedor ya puede cerrar una cotización como ganada, con su monto y sus renglones |

**Entonces el cierre no es un dato nuevo que haya que capturar: es un dato que ya llega.** Lo que
falta es que llegue *el mismo día*, que el vendedor lo vea, y que lo que él dice cuadre con lo que la
contabilidad factura.

### 5.2 · Dos números, y nunca se mezclan

```
   DECLARADO                          FACTURADO
   lo que el vendedor dice que cerró  lo que Books emitió
   el mismo día, de memoria           de noche, con número de documento

   Sirve para: el pulso del día       Sirve para: el mes, la comisión,
   y la conversación del viernes      y cualquier cifra que alguien cobre
                      ╲                  ╱
                       ╲                ╱
                  LA DIFERENCIA ENTRE LOS DOS
                  es el número que de verdad informa
```

**La comisión se calcula sólo sobre lo facturado. Nunca sobre lo declarado.** Es la regla más
importante del capítulo: en el momento en que un número que el vendedor teclea pueda mover lo que
cobra, deja de ser información y pasa a ser una negociación. Hoy ya es así —`comision_del_mes` lee
`transacciones_zoho`— y **esto lo deja escrito para que no se afloje después**.

**Y no se suman.** Un tablero que mostrara «vendido: $5 520» mezclando los dos sería el caso de los
dos números ciertos que juntos engañan. Van en renglones separados, con su nombre.

### 5.3 · Por dónde entra un cierre

Tres caminos, y sólo uno se teclea:

**a · La cotización o la orden de venta que se gana.** Ya está construido: el vendedor la marca
`ganada` desde la cuenta y el sistema guarda cuándo y quién. **Trae la cantidad gratis**, porque los
renglones del documento ya existen. En el cierre del día aparece sola.

**b · La venta sin documento** — la del mostrador, la de la libreta, la que se despachó del camión.
Es la única captura manual, y se diseña para que tome veinte segundos:

```
┌─────────────────────────────────────────┐
│  Agregar un cierre                      │
│                                         │
│  Cliente   [ buscar en mis cuentas ▾ ]  │
│                                         │
│  Monto     [ $ .......... ]             │
│            sin ITBMS                    │
│                                         │
│  ¿Qué le vendiste? (opcional)           │
│  [ + producto del catálogo ]            │
│      Bolsa kraft #8   [ 25 ] fardos     │
│                                         │
│            [ Guardar ]                  │
└─────────────────────────────────────────┘
```

**El cliente se escoge, no se escribe** —de sus cuentas, como todo lo demás del plan—, y **los
renglones son opcionales a propósito**: la factura los va a traer igual, y obligarlo a teclear
veinticinco fardos en un teléfono para que mañana lleguen solos es trabajo doble, y el trabajo doble
termina inventándose.

**c · La factura que nadie declaró.** Llega de noche y se le acredita al vendedor por
`vendedores_zoho`, que ya funciona. **No es un error**: un cliente puede llamar a la oficina y
comprar sin que el vendedor lo sepa ese día. Pero si pasa seguido, es información — ver §5.5.

### 5.4 · Cómo se empareja con la factura

Lo pidió el usuario: *«hay que entender cómo se puede capturar esta información y que coincida con
las facturas que pueda estar emitiendo el sistema»*.

**Hoy no hay forma exacta de amarrarlos.** `transacciones_zoho` guarda el número del documento de
Books, pero **nada apunta de vuelta a la cotización del SGV**. Así que el emparejamiento va en tres
intentos, del más seguro al más barato:

| | Cómo | Qué tan firme |
|---|---|---|
| **1** | **Que la factura lleve escrito el código del SGV** en su campo de referencia — `C-0412`, `OV-0133` | Exacto. **Pero depende de una persona:** quien factura en la oficina tiene que teclearlo |
| **2** | Misma cuenta + mismo monto ± tolerancia + dentro de una ventana de días | Firme en la práctica. Es lo que va a resolver la mayoría |
| **3** | Misma cuenta + hay facturas de esos días que nadie reclamó | Aproximado. **Se propone y alguien confirma** |

**El paso 1 se propone y no se da por hecho**, porque es la trampa conocida: un segundo paso que
alguien tiene que apretar es un paso que se olvida. Si la oficina lo teclea, el cuadre es perfecto;
**si un día no lo teclea, el paso 2 tiene que alcanzar solo.** Por eso se construyen los tres y no
nada más el primero.

**Y nada se empareja en silencio cuando dudó.** Un emparejamiento automático que se equivoca le
quita una venta a un vendedor y se la da a otro, y eso se descubre el día del pago.

### 5.5 · Las tres excepciones que esto destapa

Son el verdadero rendimiento del capítulo. Ninguna existe hoy:

| | Qué significa |
|---|---|
| **Declaró y no se facturó** (pasados N días) | O el cliente se echó para atrás, o la orden se quedó trabada en la oficina. **Las dos cosas hay que saberlas**, y hoy no se sabe ninguna |
| **Se facturó y no lo declaró** | Vendió y no lo reportó, o la venta entró por la oficina sin que él se enterara. Si es lo segundo y pasa seguido, ese cliente ya no es de calle |
| **El monto no coincide** | Declaró $1 240 y la factura dice $980. Puede ser un descuento que dio la oficina — **y eso el vendedor tiene que verlo** |

### 5.6 · El mes y la semana: cada uno con su calendario

El usuario planteó el problema exacto: *«si el día 30 cae a media semana, cierra su número de la
semana y al día siguiente inicia su conteo del mes siguiente, pero el reporte de la semana mantiene
su integridad de lunes a viernes»*.

**Es correcto, y es lo que ya hace la base.** `ventas_del_mes` agrupa por `date_trunc('month')`, así
que el mes es calendario y no se negocia. La semana es de lunes a viernes y tampoco.

**La regla que lo resuelve sin excepciones: un cierre pertenece al mes de la fecha de su factura.**
No del día en que el vendedor lo declaró, ni de la semana en que lo trabajó. Es lo que hace que su
número cuadre con el de contabilidad — que es todo el punto.

Y entonces la semana partida no es un problema de datos, sino de cómo se imprime:

```
   SEMANA DEL 28 DE OCTUBRE AL 1 DE NOVIEMBRE

   L28   M29   X30  │  J31   V1
   ─────────────────┼──────────────
       octubre      │   noviembre

   Declarado en la semana                        $4 280
   ──────────────────────────────────────────────────────
   OCTUBRE    cerró con                         $12 400
              comisión del mes                     $186,00
   NOVIEMBRE  lleva                              $1 950
```

**La semana no se parte: se cuenta entera.** Lo que se parte es el acumulado del mes, y se dice en
dos renglones con el nombre del mes en cada uno. Dos meses a medias sumados en la misma línea es
precisamente el número que nadie entiende tres semanas después.

### 5.7 · Resaltar lo positivo

Pedido textual: *«también hay que resaltar lo positivo»*. El reporte semanal abre con lo que va bien
y no con lo que falta: lo facturado del mes, la comisión ya ganada, y contra qué se compara.

> **Y esto no contradice una decisión ya tomada: la respeta.** El componente `MiMes` dice en su
> propio código que *«va en Ventas y no en la Agenda a propósito. Un número de comisión delante todo
> el día motiva cuando el mes va bien y desmoraliza cuando va mal»*. Sigue siendo cierto. **Una vez
> por semana, en un reporte que se abre, no es tenerlo delante todo el día** — es justo el momento en
> que el número ayuda.

**Lo que no se hace: una meta diaria de plata.** Los cierres son irregulares por naturaleza —un
martes de $4 000 y un miércoles de nada no dicen nada del miércoles—, así que la meta de dinero es
del **mes** y las metas del día son de actividad. Mezclarlas enseñaría a inflar lo declarado para que
el día se vea bien.

### 5.8 · El reporte mensual del histórico — **y es lo primero que se construye**

**No sale del plan diario: sale de lo que Books ya trajo**, así que no depende de nada de este
documento y se puede tener andando antes que todo lo demás. Lo pidió el usuario el 25 de octubre de
2026, al contestar la pregunta de la meta:

> *«Colocar metas es una conversación personal con cada uno, ya que son circunstancias diferentes.
> Lo que necesito ahora mismo es el reporte mensual del histórico de los vendedores con información
> por cada uno, lo que ha logrado por mes, y luego con esa información tener una conversación y
> establecer una meta acordada… Por el momento necesito un reporte histórico que me llegue al correo
> todos los meses el día uno de cada mes.»*

**El orden importa y es el correcto:** primero se mira lo que cada uno ha logrado, después se
conversa, y recién entonces se pone una meta. Una meta puesta antes de mirar el histórico es un
número inventado, y se descubre a la tercera semana.

```
┌───────────────────────────────────────────────────────────────┐
│  HISTÓRICO DE VENTAS POR VENDEDOR          al 1 de noviembre  │
│                                                               │
│  EDUARDO PÉREZ                                                │
│            facturado   docs   clientes   ticket   comisión    │
│   may        $9 840     41       22       $240     $147,60    │
│   jun       $11 200     47       25       $238     $168,00    │
│   jul        $8 900     38       19       $234     $133,50    │
│   ago       $18 260     62       31       $295     $273,90    │
│   sep       $12 400     51       27       $243     $186,00    │
│   oct       $14 050     55       29       $255     $210,75    │
│            ─────────────────────────────────────────────      │
│   12 meses $142 300    518      —         $275   $2 134,50    │
│   promedio  $11 858     43                                    │
│   mejor        ago                                            │
│                                                               │
│  [ una página por vendedor, el mismo cuadro ]                 │
│                                                               │
│  ── EL EQUIPO ──                                              │
│   Eduardo   $142 300   ▇▇▇▇▇▇▇▇▇▇                             │
│   Marcos     $98 450   ▇▇▇▇▇▇▇                                │
│   Líder     $210 900   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                        │
└───────────────────────────────────────────────────────────────┘
```

**Las cinco columnas son las que sostienen una conversación de meta**, y cada una contesta algo
distinto:

| | Qué dice que las otras no |
|---|---|
| **Facturado** | El resultado. Es el único que se compara contra una meta |
| **Documentos** | Cuántas veces vendió. Separa al que hace una venta grande del que hace cuarenta |
| **Clientes distintos** | Si vive de dos cuentas o de treinta. **Es el número de riesgo** |
| **Ticket promedio** | Dónde está la palanca: subir el ticket o subir la frecuencia son conversaciones opuestas |
| **Comisión** | Lo que ya cobró. Es lo que hace la conversación concreta |

**Sale de lo que ya existe:** `ventas_del_mes` da facturado, documentos y neto; `transacciones_zoho`
da los clientes distintos; `comision_del_mes()` da la comisión con la regla vigente. **No hay tabla
nueva.**

**Doce meses y no tres.** Un trimestre no distingue un mes flojo de una temporada: esta casa vende
distinto en agosto que en enero, y una meta puesta sobre tres meses castiga a quien le tocaron los
malos.

> **El día 1 cae donde caiga.** Si es domingo, el correo sale igual: el mes ya cerró y el dato no
> cambia por esperar al lunes.

---

## 6 · Quién ve qué

| | El vendedor | El líder | Gerencia |
|---|---|---|---|
| **Su propio plan y su día** | Completo | Completo | Completo |
| **El plan de los demás** | **Sólo la línea de resumen** | Línea + detalle de los suyos | Línea + detalle de todos |
| **El reporte semanal** | El suyo | Los suyos | Todos |
| **Escribir la observación** | No | Sí *(hoy la escribe gerencia)* | Sí |

**Los tres se ven la línea entre ellos, y no el detalle.** Es la decisión que faltaba
cerrar. El razonamiento:

- **Lo que sostiene la disciplina no es el castigo: es que lo que prometí ayer lo vea
  alguien hoy.** En equipos chicos funciona mejor que cualquier sanción.
- **El detalle entre pares no suma y puede restar.** Ver las metas del otro invita a
  copiarlas o a compararse por el número, no por el resultado. El detalle es de quien
  supervisa.
- Con tres personas la línea compartida es sana; **con treinta sería tóxica**, y conviene
  dejarlo escrito por si el equipo crece.

> **Mientras el líder esté de vacaciones, gerencia responde.** Decisión del usuario, temporal
> y declarada: *«el líder le voy a relegar eso… a su regreso yo voy a retomar el tema»*. La
> tabla ya guarda **quién** respondió, así que el cambio no pierde historia.

---

## 7 · Qué cuenta como falta

**Se sanciona la disciplina, no el resultado.** Un día malo es información; un día sin plan
es una falta.

| | |
|---|---|
| **Abrir el día después de la hora** | Queda marcado. Se ve en la línea y cuenta en la semana |
| **No abrir el día** | Falta |
| **No cerrar el día** | Falta — y además el día siguiente arranca sin arrastre |
| **No cumplir una meta** | **No es falta.** Es lo que el reporte explica |

**Decidido el 25 de octubre de 2026: el sistema cuenta las faltas, el usuario decide el monto.**
Textual: *«cuenta las faltas, tú decides el monto»*. No hay fórmula de descuento, y es lo correcto —
una fórmula automática hay que defenderla caso por caso el día que alguien tuvo una razón.

**Lo que eso obliga a construir:** el reporte mensual trae **las faltas contadas por persona**, para
que el número llegue a quien paga sin que nadie tenga que pedirlo. Una falta que hay que ir a buscar
es una falta que no se descuenta.

---

## 8 · Lo que esto habilita dentro de dos meses

**Hay que capturar los hechos en bruto desde el primer día**, aunque no se usen todavía. Es
la decisión de diseño más importante de este documento, y la única que no se puede tomar
después.

Con seis a ocho semanas de datos diarios se conoce la cadena real de conversión:

```
100 llamadas → 22 conversaciones → 6 visitas → 2 cotizaciones → 1 cierre
```

Y entonces el sistema deja de preguntar la meta y **la propone**:

> *Tu meta del mes son 8 cierres. Llevas 3. Quedan 11 días hábiles.*
> *Al ritmo que traes hacen falta **44 llamadas por día**, no 20.*

Eso cambia la conversación de *«no estás trabajando»* a *«el número no te da»* — que se
discute con datos y no con carácter, y **no se puede contestar con el tráfico y el calor**.

---

## 9 · Lo que falta decidir

### Contestadas el 25 de octubre de 2026

| | |
|---|---|
| **Hora de corte** | **9:00.** Como parámetro, para moverla sin desplegar |
| **La falta** | **El sistema la cuenta, el usuario decide el monto.** Sin fórmula de descuento. Obliga a que el reporte mensual traiga las faltas por persona |
| **El reporte semanal** | **Correo con el PDF adjunto**, además de quedar guardado en la herramienta — ahí es donde vive la observación como histórico |
| **El código del SGV en la factura** | **Sólo en lo que pasa por la oficina.** La venta directa del vendedor se empareja por cuenta, monto y ventana de días |
| **Cuánto espera un cierre declarado** | **5 días hábiles**, para que la excepción caiga en el reporte de la semana siguiente, cuando todavía se puede llamar al cliente |
| **La meta del mes** | **No se pone todavía.** Primero el reporte mensual del histórico (§5.8), después la conversación con cada uno, y la meta acordada entra a mano |

### Lo que sigue abierto

| | |
|---|---|
| **Cómo manda correos el sistema** | **Hoy no sabe.** `correo.ts` sólo arma enlaces `mailto:` que abre el teléfono del vendedor; no hay envío desde el servidor, ni rutas de API, ni más cron que el de Zoho. Hace falta una cuenta de envío — lo más directo es una **contraseña de aplicación** del Gmail de la empresa, que el usuario genera y se guarda como secreto del repositorio |
| **A qué dirección llegan** | El mensual y el semanal van a gerencia. Falta decidir si el vendedor recibe también el suyo |

---

## 10 · Lo que esto deja atrás

- **El contrato semanal como mecánica de planificación.** La tabla `cierres` se conserva: su
  histórico es real y la observación de gerencia sigue viviendo ahí.
- **Las tres preguntas** —qué te sorprendió, qué te frenó, qué necesitas—. Se reemplazan por
  la comparación entre lo prometido y lo hecho, y por una lista corta de motivos.
- **`/contrato` y `/cierre`** quedan para consultar lo viejo, no para capturar.

> **No se borra nada del histórico.** Lo que se cerró entre agosto y octubre con el esquema
> semanal siguió siendo cierto el día que se escribió, y un histórico que se reescribe no
> sirve para comparar nada.
