# Medición y gestión

**Fecha:** 2026-08-22 · **Estado:** propuesta, pendiente de decisiones del negocio

Alto en el camino antes de la Etapa 6. Las cinco etapas construidas resuelven **el registro**:
que un hecho de campo quede guardado con su fecha, su ubicación y su resultado. Este
documento es sobre lo otro: **qué se lee de esos hechos, quién lo lee y qué decisión toma con
eso**.

Es una propuesta. Las preguntas abiertas están en §12 y hay que contestarlas antes de
construir.

---

## 1. Qué pregunta se está haciendo de verdad

El planteamiento de gerencia, destilado:

> Tengo tres vendedores sin horario fijo, uno a hora y media de distancia, y cuando el reporte
> semanal de ventas sale flojo no sé si es porque el mercado está flojo, porque el vendedor
> estuvo tres días manejando, o porque salió de su casa a las diez.

Eso no es una pregunta de reportes. Son **tres preguntas distintas** que se confunden porque
hoy no hay forma de separarlas:

| Pregunta | Qué la contesta |
|---|---|
| ¿Está trabajando? | Ocupación del tiempo |
| ¿Está trabajando en lo correcto? | Reparto entre caza, cuidado y logística |
| ¿Lo que hace funciona? | Conversión y facturación |

Un sistema que devuelve un solo número no puede contestar las tres, porque cuando el número
baja no dice cuál de las tres se rompió. **El diseño tiene que separarlas desde el principio.**

Y una aclaración de alcance: el reporte ABC de facturación ya existe y sale de Books. El SGV
no viene a reemplazarlo. **Viene a explicarlo.** Cuando el ABC se vea flojo, el SGV tiene que
decir por qué.

---

## 2. Tres oficios distintos, no tres vendedores iguales

Es el error más caro que se puede cometer aquí: medir a los tres con la misma vara.

| | Interior (Santiago) | Ciudad | Líder |
|---|---|---|---|
| **Qué vende** | Ruta + entrega | Ruta local | Cuentas grandes, cadenas |
| **Ciclo de venta** | Días | Días | Meses |
| **Canal dominante** | Visita | Visita | Teléfono, correo, reunión |
| **Recurso escaso** | Horas de carretera | Frecuencia de cobertura | Reuniones conseguidas |
| **Logística que absorbe** | Alta — casi todas las entregas | Media — entrega lo que vende | Baja |

Si el tablero dice "40 interacciones por semana" para todos:

- El líder sale mal siempre. Doce llamadas bien preparadas a jefes de compras de una cadena
  valen más que cuarenta visitas de mostrador, y el número no lo ve.
- El del interior sale mal la semana que hizo dos viajes a Natá, aunque haya sido la semana
  correcta.
- El de ciudad sale bien inflando visitas cortas, que es lo más fácil de hacer de los tres.

**Propuesta: perfil por rol.** El mismo vocabulario de métricas para los tres, con expectativas
distintas por perfil. No son tres sistemas: es un sistema con un parámetro.

Y una advertencia estadística que conviene decir en voz alta: **con tres personas no se hacen
rankings.** Tres datos no son una distribución. El tablero sirve para tener tres
conversaciones individuales, no para ordenar un podio.

---

## 3. Lo que se puede medir sin que se pueda inflar

Todo sistema de medición de actividad se degrada. La pregunta no es *si* el vendedor va a
aprender a alimentarlo, es **qué tan caro le sale hacerlo**.

Hoy, en lo construido:

| Dato | ¿Se puede inflar? | Costo de inflarlo |
|---|---|---|
| Check-in GPS de una visita | Difícil | Hay que estar físicamente ahí |
| Precisión de la lectura | No | La reporta el dispositivo |
| Hora del registro | Difícil de adelantar | Registrar de noche lo del día se ve |
| Cambio de etapa de una oportunidad | Sí, pero se ve | Una etapa que sube y no factura queda expuesta |
| Factura de Zoho | No | Es una transacción real |
| **Conteo de llamadas y WhatsApp** | **Sí, y es gratis** | **Quince segundos** |

De ahí sale la regla de diseño más importante de todo este documento:

> **La métrica que se mira en el tablero tiene que apoyarse en lo caro de falsificar. El resto
> es contexto, no calificación.**

En concreto: **visitas verificadas por GPS** y **avances de etapa** son métricas de tablero.
**Cantidad de interacciones** es contexto. Si se pone el conteo bruto de interacciones como la
métrica visible, en un mes los tres estarán registrando llamadas de quince segundos.

### Los indicadores que resisten mejor son razones, no conteos

Una razón es más difícil de inflar que un conteo, porque inflar el denominador te castiga:

| Razón | Qué delata cuando se cae |
|---|---|
| Visitas verificadas ÷ interacciones registradas | Alguien está rellenando con llamadas |
| Cuentas que avanzaron ÷ cuentas tocadas | Se está tocando por tocar |
| Clientes dentro de cadencia ÷ total de clientes | Se está descuidando la cartera |
| Horas de venta ÷ horas registradas | La logística se está comiendo la semana |

---

## 4. El tiempo: lo que falta, y por qué va primero

**Este es el hueco real y es el que bloquea todo lo demás.**

Hoy el sistema no sabe que el vendedor del interior pasó el martes manejando de Santiago a
Natá y repartiendo. Sin ese dato:

- Su semana se ve floja y no lo estaba.
- Él lo sabe, y la primera vez que el tablero lo exponga injustamente pierde la confianza en
  la herramienta. **Una métrica injusta no se corrige después: se sabotea.**
- Y sobre todo: **no se puede contestar la pregunta de negocio** que gerencia realmente tiene,
  que es *"¿cuánto me cuesta que el vendedor reparta, y me conviene poner un chofer?"*

### El truco que hace esto barato

No hay que pedirle al vendedor que registre sus horas de venta. **Esas ya están**: cada
seguimiento lleva su marca de tiempo. El tiempo de venta se deduce del primer y el último
registro del día.

Lo único que hay que pedirle explícitamente es **lo invisible: la logística**. Y ahí ocurre
algo que no pasa con ninguna otra métrica de este sistema:

> **El vendedor quiere registrar esto.** Es su coartada. El del interior tiene un interés
> directo en que quede constancia de que el martes se fue a Natá.

Es la única métrica donde el incentivo del vendedor y el del gerente apuntan al mismo lado.
Por eso es la que hay que construir primero: se va a alimentar sola.

Y por eso hay que presentarla así, no como control: **el sistema defiende tu semana**.

### Cómo se registra, sin llegar al extremo

Nada de marcar entrada y salida. Bloques gruesos, registrados al final del día o a la mañana
siguiente:

| Campo | Ejemplo |
|---|---|
| Tipo | Viaje por mercancía · Entrega · Administrativo · Personal |
| Fecha | 2026-08-25 |
| Duración | Media jornada · Jornada completa · N horas |
| Desde → hasta | Santiago → Natá |
| A quién se entregó | Cuentas, opcional |

Grueso es suficiente. La pregunta es *"¿la logística se come el 30% o el 60% de su semana?"*,
no una planilla de nómina. Media jornada de resolución sobra.

**Beneficio secundario que no es menor:** si la entrega se liga a las cuentas atendidas, la
entrega también es un contacto con el cliente. Hoy el del interior ve a sus clientes cuando
les entrega y no recibe crédito por ese contacto. Con esto, sí — y además aparece una pregunta
nueva y buena: *¿a qué clientes solo los vemos cuando les entregamos?*

### La forma de la jornada, sin reloj marcador

Gerencia quiere saber si el del interior sale de su casa a las diez. No hace falta un reloj —y
poner uno a alguien que lleva años trabajando solo destruye más de lo que mide—. Lo que ya se
puede derivar, pasivamente:

- **Hora del primer registro del día** — proxy de arranque
- **Hora del último registro** — proxy de cierre
- **Amplitud de la jornada** — el tramo entre los dos
- **Días de lunes a viernes sin ningún registro** — la bandera roja de verdad

Con la salvedad honesta: la hora del primer registro se puede adelantar registrando una
llamada falsa a las 7:30. Por eso el indicador bueno es **la hora de la primera visita
verificada por GPS**, que exige estar en algún lado.

Y se lee como tendencia, nunca como día suelto. Un lunes que arrancó tarde no dice nada.
Cuatro semanas arrancando tarde son un patrón, y ahí sí hay conversación.

---

## 5. La doble medición: cazar y cuidar

Es el planteamiento más claro de gerencia y el sistema casi lo soporta ya.

### Caza — conseguir cuentas nuevas

El embudo ya existe en el modelo de datos. Falta leerlo:

    sin_clasificar → prospecto → cotizado → primera factura

| Indicador | ¿Se puede hoy? |
|---|---|
| Cuentas nuevas creadas en la semana, por origen | Sí |
| Sin clasificar que se resolvieron (prospecto o descartada) | Sí |
| Prospectos que llegaron a cotización | Sí |
| **Tiempo medio de cada salto** | Sí |
| Cotizados que llegaron a primera factura | **No — necesita Zoho** |

**El tiempo medio de cada salto es el indicador más valioso de la lista**, y es el que hace
justa la comparación entre los tres. Es lo que demuestra con números que el ciclo del líder es
de noventa días y el del de ciudad es de cinco, y por lo tanto que compararlos por "ventas
cerradas este mes" no significa nada.

Traducido a lo que gerencia pidió textualmente para el líder: *cuántos prospectos intentó y
cuántos logró en la semana* — no ventas, prospectos contactados y cotizados. Eso sale
completo del embudo de arriba, sin Zoho.

### Cuidado — no perder lo que ya se tiene

Aquí hay una buena noticia y una mala.

**La buena:** el indicador central ya está construido. `dias_cadencia` por cuenta y el cálculo
`fuera_de_cadencia` existen desde la Etapa 2. Agregarlo por vendedor es casi gratis:

> *% de la cartera de este vendedor que está dentro de su cadencia.*

Ese número es, literalmente, la efectividad de mantenimiento. Y tiene la propiedad que hace
falta: **no se puede subir sin visitar**. Un vendedor que quiera mejorarlo tiene que ir a ver
clientes, que es exactamente lo que se busca.

**La mala:** *"no estamos perdiendo clientes que dejaron de comprar"* **no se puede contestar
sin Zoho.** Sin historial de facturas el sistema puede decir "nadie ha visitado a este cliente
en 60 días", que es una cosa; no puede decir "este cliente compraba $800 al mes y lleva tres
meses en cero", que es otra y es la que duele.

**Consecuencia dura y hay que asumirla: la mitad de lo que gerencia pidió está bloqueada por
la higiene del maestro de clientes de Zoho.** Eso no es trabajo de programación, y hoy es el
cuello de botella real del proyecto. Mientras no se resuelva, el SGV mide esfuerzo y avance,
no resultado.

---

## 6. Por qué no un solo número de efectividad

Gerencia preguntó si esto es "un reporte que me diga un número de efectividad". La
recomendación es **no**, y la razón es concreta:

Supongamos que el vendedor del interior marca 62%. ¿Qué se hace con eso? No se sabe si hay que
hablarle de que arranca tarde, de que no convierte prospectos, de que la logística le comió la
semana, o de que su cartera está descuidada. **Hay que descomponerlo para poder actuar.** Y si
hay que descomponerlo siempre, el número compuesto no aportó nada: solo escondió la respuesta
un paso más atrás.

Peor: un número compuesto se puede subir moviendo la parte más fácil. Si el conteo de
interacciones pesa 30% del índice, la forma barata de subir el índice es registrar más
llamadas.

**Lo que se propone en su lugar: una hoja semanal por vendedor, cuatro bloques, cada uno con
su propio semáforo.** El semáforo es por bloque, no por persona, y se compara contra la
expectativa de su perfil, no contra un estándar único.

| Bloque | Qué muestra | Pregunta que contesta |
|---|---|---|
| **1. Dónde se fue la semana** | Horas de venta, horas de logística, días sin actividad, amplitud de jornada | ¿Estuvo trabajando? |
| **2. Caza** | Cuentas nuevas, sin clasificar resueltas, prospectos que avanzaron, cotizaciones | ¿Está construyendo futuro? |
| **3. Cuidado** | % de cartera en cadencia, y **la lista con nombre** de los que están fuera | ¿Está cuidando lo que hay? |
| **4. Cierre** | Oportunidades por etapa, cuáles vencidas, monto en juego | ¿Va a entrar plata? |

Detalle que importa en el bloque 3: **la lista con nombres, no solo el porcentaje**. Un
porcentaje se discute; una lista de ocho clientes que llevan cuarenta días sin ver a nadie se
trabaja el lunes por la mañana.

---

## 7. El vendedor ve su semana antes que el gerente

Gerencia lo propuso y es la mejor idea de todo el planteamiento. Merece ser un principio de
diseño, no una pantalla más:

> **El vendedor ve exactamente el mismo dato que el gerente, y lo ve primero.**

Lo que cambia:

- **Se acaban las sorpresas del lunes.** Nadie llega a una reunión a enterarse de un número que
  ya no puede corregir.
- **La corrección pasa al jueves.** Un vendedor que el jueves ve que le faltan seis clientes
  por visitar, los visita el viernes. Ese es todo el valor del sistema, y ocurre sin que el
  gerente intervenga.
- **Cambia lo que la herramienta significa.** Si el vendedor solo alimenta y nunca lee, el
  sistema es vigilancia y se alimenta mal. Si lee su propia semana, es su instrumento.

Forma concreta: una tarjeta **"Tu semana"** en la pantalla de inicio. Sin puntaje. Cuatro
hechos: interacciones registradas, cuentas tuyas fuera de cadencia, compromisos de los
próximos días, horas de logística registradas.

---

## 8. El plan del líder

Gerencia lo dijo con precisión: *"su enfoque no está basado en un plan que yo como gerente
tenga a la vista"*.

Eso es un hueco real y no se arregla con reportes. El sistema no tiene dónde el líder
**declare a quién está persiguiendo**. Hoy solo se entera de una cuenta cuando ya pasó algo con
ella; una cadena que el líder lleva dos meses intentando contactar es invisible hasta la
primera reunión.

**Propuesta mínima:** marcar cuentas como **objetivo del período** —una marca y un período,
nada más—. Con eso, el gerente abre una pantalla y ve:

> *Objetivos del trimestre: 15 · contactados 9 · con reunión 4 · cotizados 2 · cerrados 1*

Eso contesta las dos preguntas: **qué persigue** y **si se está moviendo**.

**Por qué no usar el pipeline para esto.** Es tentador —una oportunidad ya tiene nombre, fecha
y etapa— pero mezclar intención con pipeline calificado arruina el pipeline para pronosticar.
Un embudo lleno de aspiraciones deja de servir para decir cuánta plata va a entrar. Se
mantienen separados: **el objetivo es a quién quiero llegar; la oportunidad es lo que ya está
en juego.**

Se propone empezar con lo mínimo (una marca sobre la cuenta, sin historial entre períodos).
Si demuestra que se usa, crece. Si no, no se pagó por una entidad que nadie llenó.

---

## 9. Cobertura: qué no estamos mirando

*"Aquí no vemos bancos, no vemos ferreterías, estamos muy enfocados en restaurantes."*

Son dos preguntas y tienen dificultad muy distinta.

### Lo que tenemos — gratis, se puede hacer ya

Distribución de la cartera por `tipo_comercio` y por `poblado`, por vendedor. El dato ya está
capturado desde la Etapa 2. Muestra la concentración de inmediato, sin integrar nada.

### Lo que existe y no tenemos — necesita un denominador

Aquí hace falta contra qué comparar. Dos fuentes:

1. **Google Places, en vivo.** No se puede almacenar el resultado, pero **sí se puede mostrar
   el conteo en el momento**: *"en Aguadulce hay ~40 ferreterías; tienes 3"*. Es exactamente el
   patrón de `estado_de_puntos` que ya está construido para la búsqueda: comparación viva
   contra la base propia, sin guardar nada de Google. Es barato y da el 80% del valor.
2. **Panamá Emprende / registro público.** Denominador real por actividad y distrito. Es la
   fuente correcta y la más cara. Ya está prevista en `01-arquitectura.md`.

**Recomendación: hacer Places primero.**

### Una objeción que hay que zanjar antes de construir esto

**Cobertura contra un denominador infinito siempre se ve mal.** Si el universo son "todos los
comercios de Panamá", la cartera va a parecer minúscula para siempre y el indicador no va a
servir para decidir nada.

Hace falta que el negocio defina **el catálogo de categorías direccionables** para estas
cuatro líneas de producto — quién compra de verdad rollos fiscales, bolsas de papel, papel
antigrasa y tubos de cartón. Cobertura se mide contra *ese* universo. Es una decisión de
negocio, no de programación, y va a §12 de la visión.

---

## 10. Cómo se rompe esto

Los tres modos de falla, para tenerlos a la vista:

**1. La meta se convierte en el techo.** El día que se anuncie "40 interacciones por semana",
va a haber 40 interacciones por semana. Ni 41. Y de la clase más barata.

*Mitigación:* no fijar el número desde la oficina. Correr cuatro a seis semanas con los tres
trabajando normal, mirar la distribución real, y recién ahí poner la expectativa **por perfil**
y **como banda** ("20 a 30 visitas verificadas"), no como umbral.

**2. Se mide lo fácil.** El conteo de interacciones es el dato más fácil de graficar y el más
fácil de inflar. Va a haber presión para ponerlo al centro del tablero.

*Mitigación:* al centro van visitas verificadas por GPS y avances de etapa. El conteo bruto
vive en el detalle.

**3. El vendedor descubre que el sistema es la vara.** A partir de ahí alimenta para la vara,
no para el trabajo.

*Mitigación:* §7 — que vea su propia semana primero, y que la primera función visible del
registro de logística sea **defenderlo**, no exponerlo.

Y un límite que conviene decir claro: **el sistema puede decir que una visita ocurrió; no puede
decir si fue buena.** La única medida de calidad es lo que pase después — que avance de etapa,
que cotice, que facture. Por eso el tablero mira avance y no solo actividad.

---

## 11. Plan de etapas propuesto

La Etapa 6 actual —"ventas y reportes"— quedó demasiado vaga y demasiado tarde para lo que
gerencia necesita. Se propone abrirla:

| # | Etapa | Depende de |
|---|---|---|
| **6** | **El tiempo del vendedor** — registro de logística y jornada | Nada |
| **7** | **Tu semana** — la tarjeta de autoseguimiento del vendedor | 6 |
| **8** | **Tablero de gerencia** — la hoja semanal de cuatro bloques, con perfiles por rol | 6 |
| **9** | **Objetivos del período** — el plan del líder a la vista | Nada |
| **10** | **Cobertura** — concentración de cartera + denominador de Places | Categorías direccionables (§12) |
| **11** | **Zoho** — facturación, cliente dormido, conversión a venta real | Higiene del maestro |
| **12** | **Piloto y offline** | Todo lo anterior |

### Por qué el tiempo va primero, antes que cualquier reporte

**Todo indicador que se quiera ver en el tablero necesita historia.** Si se construyen los
reportes primero y la instrumentación después, el tablero sale vacío y hay que esperar un mes
para que signifique algo — con el costo adicional de que la primera versión que ve gerencia no
sirve, y eso quema la credibilidad de la herramienta.

Al revés funciona: se instrumenta ahora, los datos se acumulan mientras se construye el
tablero, y el día que el tablero abre ya tiene cuatro semanas adentro. **Además, esas primeras
cuatro semanas son las que van a fijar la banda de expectativa del §10.**

La Etapa 9 se puede adelantar o intercalar: no depende de nada y es barata.

---

## 12. Lo que hace falta decidir antes de construir

Ninguna de estas se puede inventar desde el código.

1. **Tipos de actividad operativa.** ¿El catálogo es *viaje por mercancía · entrega ·
   administrativo · personal*? ¿Falta alguno — cobranza, inventario, reuniones internas?

2. **Resolución del registro de tiempo.** ¿Media jornada alcanza, o hace falta por horas?
   Media jornada es más realista de llenar y probablemente suficiente para la decisión de
   negocio que hay detrás.

3. **¿Se registran las entregas ligadas a cuentas?** Cuesta unos toques más y a cambio la
   entrega cuenta como contacto con el cliente para la métrica de cadencia. Recomendación: sí.

4. **Perfiles por rol.** ¿Se confirma que son tres —interior, ciudad, líder— o el interior y el
   ciudad comparten perfil con distinta expectativa de logística?

5. **Expectativas.** Recomendación: **no fijarlas ahora**. Correr cuatro a seis semanas y
   derivarlas de lo observado. ¿Se acepta esperar?

6. **Categorías direccionables.** Qué tipos de comercio son universo real para estas cuatro
   líneas. Bloquea la Etapa 10.

7. **Qué ve cada quien.** ¿El líder ve la hoja semanal completa de los otros dos vendedores, o
   solo gerencia? Afecta el RLS y hay que decidirlo antes de escribir las políticas.

8. **Prioridad de Zoho.** La mitad de la pregunta de gerencia —retención, cliente que dejó de
   comprar— está bloqueada ahí, y la higiene del maestro no es trabajo de programación. ¿Se
   arranca ese frente en paralelo desde ya?
