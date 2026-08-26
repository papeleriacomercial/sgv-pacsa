# Bitácora de decisiones

Toda decisión de diseño o arquitectura se registra aquí **en el momento**, con su
justificación (§15 de la visión). El objetivo es no rediscutir lo mismo tres meses después.

Formato: identificador, fecha, qué se decidió, qué se descartó y por qué.

---

## D-001 — El slug del sistema es `sgv-pacsa`, no `sgv`

**Fecha:** 2026-08-20

**Decisión.** El identificador del proyecto en todas las plataformas es `sgv-pacsa`:
repositorio de GitHub `papeleriacomercial/sgv-pacsa`, proyecto de Vercel `sgv-pacsa`
(dominio `sgv-pacsa.vercel.app`), y proyectos de Supabase `sgv-pacsa-dev` y
`sgv-pacsa-prod`.

**Alternativa descartada.** Renombrar las cuatro plataformas a `sgv`, como indica §14 de
`00-vision.md`.

**Por qué.** El nombre `sgv` nunca llegó a usarse en ninguna plataforma: al crear el
repositorio, los dos proyectos de Supabase y el de Vercel quedó `sgv-pacsa` de forma
consistente. Renombrar cuatro servicios para cumplir un nombre que solo existe en el
documento no aporta nada y rompe URLs ya configuradas. Se corrigió `CLAUDE.md`; §14 de la
visión se deja como está, porque es el levantamiento original y no se edita para reflejar
avances.

---

## D-002 — Nomenclatura de base de datos en español

**Fecha:** 2026-08-19

**Decisión.** Tablas, columnas, tipos y funciones se nombran en español: `perfiles`,
`rol_usuario`, `lider_id`, `es_gerente()`. Se mantienen `snake_case` y plural en tablas,
como exige §16.

**Alternativa descartada.** Nombres en inglés. §16 de la visión menciona la tabla como
`profiles`.

**Por qué.** La interfaz, la documentación y el vocabulario del negocio están en español.
Mezclar idiomas obliga a traducir mentalmente en cada consulta y produce híbridos del tipo
`profiles.lider_id`. La consistencia pesa más que la convención en inglés.

---

## D-003 — No se instala Docker Desktop

**Fecha:** 2026-08-20

**Decisión.** El desarrollo no usa entorno local de Supabase. Se trabaja contra
`sgv-pacsa-dev` en la nube, las migraciones se escriben a mano y se aplican con
`npx supabase db push`.

**Alternativa descartada.** Instalar Docker Desktop para levantar Supabase localmente.

**Por qué.** El entorno de pruebas ya existe: es `sgv-pacsa-dev`, tal como exige §16 al
pedir dos proyectos separados desde el día uno. Docker sería un tercer entorno resolviendo
un problema ya resuelto. Los comandos que quedan fuera no son críticos: `db push` y
`db reset --linked` funcionan sin Docker, y `db diff` —que genera migraciones
automáticamente— contradice la regla de §16 de escribir toda migración a mano y
versionarla. Se reevalúa si aparece un caso concreto, como programar sin conexión o varios
desarrolladores en paralelo.

---

## D-004 — Los catálogos son tipos enum, no tablas de catálogo

**Fecha:** 2026-08-20

**Decisión.** `etapa_prospecto`, `resultado_visita`, `motivo_perdida`, `tipo_interaccion`,
`origen_prospecto` y `linea_producto` se implementan como tipos enum de Postgres.

**Alternativa descartada.** Tablas de catálogo con filas editables desde una pantalla de
administración.

**Por qué.** La visión los llama catálogos **cerrados** (§6). Con enum, agregar una opción
exige una migración versionada, que es justamente la garantía de que nadie los cambia desde
el dashboard y de que el repositorio sigue siendo la verdad. El costo es que un cambio
requiere despliegue; se acepta a propósito. Si con el uso real resulta que alguno cambia
seguido, ese en particular se convierte en tabla.

---

## D-005 — `negociacion` es una etapa ancha y no se subdivide

**Fecha:** 2026-08-20

**Decisión.** El pipeline tiene seis etapas: `nuevo`, `contactado`, `cotizado`,
`negociacion`, `ganado`, `perdido`. Dentro de `negociacion` caben la espera de aprobación
de gerencia, la prueba de producto para validar calidad y la negociación de volumen y
precio, sin subetapas.

**Alternativa descartada.** Abrir subetapas para cada situación.

**Por qué.** Lo que ocurre entre la cotización y la decisión final es demasiado variado para
una lista fija, y cada subetapa nueva es un campo más que el vendedor tiene que mantener al
día en la calle. El detalle lo dan la bitácora de visitas y el compromiso vigente, que él ya
llena de todos modos.

La contrapartida es que la etapa por sí sola no distingue un prospecto que avanza de uno
atascado. Se resuelve con `etapa_desde` y el compromiso vencido, que son datos derivados y
no exigen captura adicional.

---

## D-006 — Un solo tema claro en Fase 1, sin modo oscuro

**Fecha:** 2026-08-20

**Decisión.** Se eliminó el bloque `prefers-color-scheme: dark` que traía el andamiaje de
`create-next-app`. La aplicación tiene un único tema claro.

**Alternativa descartada.** Mantener el modo oscuro automático según la preferencia del
sistema operativo.

**Por qué.** §17 no lo pide, y la restricción que manda es física: la app se lee a pleno sol.
Un tema oscuro que se activa solo, según la configuración del celular, cambia el contraste
justo cuando más se necesita y sin que el vendedor lo haya pedido. Si más adelante aparece
la necesidad, se agrega como preferencia explícita del usuario, nunca automática.

---

## D-007 — Nomenclatura del código en español

**Fecha:** 2026-08-20

**Decisión.** Rutas, componentes y funciones propias se nombran en español: `/entrar`,
`Boton`, `Insignia`, `clienteServidor()`. Se mantienen en inglés las APIs de terceros y las
convenciones del framework que no se pueden traducir.

**Alternativa descartada.** Código en inglés con interfaz en español.

**Por qué.** Es la misma razón de D-002: la interfaz, la documentación y el vocabulario del
negocio están en español, y mezclar idiomas obliga a traducir mentalmente todo el tiempo.
Que la ruta que el vendedor ve en su celular diga `/entrar` y no `/login` es parte del mismo
criterio.

---

## D-008 — El mapa usa OpenStreetMap, no Google Maps

> **Revertida por D-009 el 2026-08-21.** Se conserva el registro porque las mediciones de
> cobertura siguen siendo válidas y porque el error de razonamiento vale más documentado que
> borrado.

**Fecha:** 2026-08-21

**Decisión.** El mapa de §7.1 se dibuja con Leaflet sobre mosaicos de OpenStreetMap. Toda
la dependencia del proveedor vive en un solo componente, `src/components/mapa-puntos.tsx`.

**Alternativa descartada.** Google Maps, que cobra por cada carga de mapa.

**Por qué.** Lo que pide §7.1 es un mapa *de clientes y prospectos*: puntos propios sobre un
fondo de calles. Las coordenadas las capturó el vendedor con el GPS de su celular, así que
son dato propio y la restricción de almacenamiento de §7.4 no las alcanza. Para dibujar
puntos propios sobre calles correctas, pagarle a Google no aporta nada.

**Lo que se midió antes de decidir**, consultando Overpass:

| Zona | Comercios en OSM |
|---|---|
| Centro de Ciudad de Panamá | 1.281 |
| David, Chiriquí | 751 |
| La Chorrera | 122 |
| Aguadulce | 41 |

Los nombres son locales y del perfil correcto —Mini Super San Luis, Farmacia Heidi,
Panadería Pocri— pero la cobertura se adelgaza en el interior: 41 comercios en Aguadulce
está claramente incompleto.

**Eso no afecta esta decisión.** El descubrimiento de prospectos no sale del fondo del mapa:
sale de Google Places API, en el módulo §7.4, que ya estaba decidido y se paga aparte. Lo
único que cambia según el proveedor es qué comercios ajenos ve el vendedor mientras navega
sin buscar nada, y eso no es un requisito de §7.1.

**Cómo se revierte.** Google no permite usar sus mosaicos fuera de su propia librería, así
que cambiar no es sustituir una dirección: es reemplazar el componente del mapa. Por eso el
proveedor queda aislado detrás de una frontera clara —le entran puntos, le salen toques— y
ninguna pantalla sabe quién dibuja las calles. Se reevalúa en el piloto del Tramo 5: si el
vendedor dice que necesita ver comercios ajenos mientras maneja, se cambia; si no lo dice,
el gasto no se hizo.

---

## D-009 — El mapa pasa a Google Maps. Revierte D-008

**Fecha:** 2026-08-21

**Decisión.** El mapa usa Google Maps a través de `@vis.gl/react-google-maps`. Se eliminaron
Leaflet y react-leaflet.

**Por qué cambió**, en orden de peso:

**1. La función que el negocio pidió no se puede hacer con OSM.** Badger Maps deja tocar un
local de tercero en el mapa y agregarlo a la lista de prospectos, y eso es lo que se quiere
replicar. Los mosaicos de OSM son **imágenes**: el nombre del comercio está pintado dentro
del PNG, no es un objeto tocable. Habría que pedir los comercios por separado a Overpass
—un servicio voluntario, sin garantías, no apto para consulta continua desde la calle— y
montar un servidor propio. Y aun así, el vendedor en Aguadulce vería 41 comercios.

Google emite el evento con el `place_id` del local tocado. Es una función de la plataforma,
no algo que haya que construir.

**2. La justificación de costo de D-008 era falsa.** Se verificó la documentación de precios
de Google: el crédito mensual de 200 dólares fue reemplazado por **10.000 llamadas gratis
por servicio y por mes**. Con tres vendedores el uso estimado es de unas 1.300 cargas de
mapa mensuales, así que el costo real es **cero**. D-008 recomendaba OSM para ahorrar un
gasto que no existía.

**3. La cuenta de Google hace falta igual** para la búsqueda de §7.4, donde OSM no alcanza en
el interior. Con la llave, la facturación y las cuotas ya configuradas, usar Google también
para el mapa no agrega trabajo.

**Lo que sí se conserva de D-008:** el aislamiento del proveedor detrás de un solo
componente. Gracias a esa decisión, cambiar de proveedor tocó un archivo y ninguna pantalla
se enteró. La decisión de aislar resultó más valiosa que la de elegir.

**Lo que se guarda de Google:** solo el `place_id` y la ubicación. El nombre del local viaja
como sugerencia en el formulario de alta y se vuelve dato propio cuando el vendedor lo
confirma, que es lo que permiten los términos de Maps y lo que ya describía §7.4.

**Protecciones configuradas:** llave restringida a `sgv-pacsa.vercel.app`, la URL de preview
de `dev`, y `localhost`. Quedan pendientes las cuotas diarias y la alerta de presupuesto: la
consola de Google no las hizo evidentes y no bloquean el trabajo, pero hay que cerrarlas
antes de producción.

---

## D-010 — `tipo_cuenta` lo marca el vendedor; Zoho lo confirma después

**Fecha:** 2026-08-21

**Decisión.** La cuenta lleva `tipo`: prospecto o cliente. Lo marca el vendedor al cerrar la
primera venta. Cuando exista la integración, Zoho confirma o corrige esa marca, no la
reemplaza.

**Alternativa descartada.** Que "cliente" sea exclusivamente lo que diga Zoho, como plantean
§2 y §4 de la visión.

**Por qué.** El sistema pasó de gestionar prospección a gestionar el ciclo completo: el
vendedor sigue atendiendo a su cliente para mantenerlo y venderle de nuevo. Esperar a que
Zoho lo diga deja al vendedor sin poder marcar lo que él sabe el día que ocurre.

Que las dos fuentes puedan discrepar es una función, no un defecto: si el vendedor marcó
cliente y Zoho no tiene facturas, eso es un hallazgo que hay que mirar.

---

## D-011 — La etapa se muda de la cuenta a la oportunidad

**Fecha:** 2026-08-21

**Decisión.** `etapa` deja de existir en la cuenta y vive solo en la oportunidad. El motivo
de pérdida y la fecha de recontacto se mudan con ella. El enum `etapa_prospecto` pasa a
llamarse `etapa_oportunidad`.

**Alternativa descartada.** Mantener etapa en los dos niveles.

**Por qué.** Una cuenta con tres oportunidades en tres etapas distintas no está "en una
etapa": la pregunta no tiene respuesta. Lo que avanza, se gana o se pierde es la venta, no
el local. **Se pierde una venta, no un cliente** — y ese cliente puede volver a comprar otra
línea el mes siguiente.

Es el cambio más profundo del plan v2 y el que vuelve coherente todo lo demás.

---

## D-012 — El catálogo de categorías de comercio es abierto y global

**Fecha:** 2026-08-21

**Decisión.** `tipo_comercio` se alimenta de una tabla que crece con el uso: el vendedor
escribe una categoría nueva y queda disponible para todos en una lista desplegable.
Gerencia puede fusionar duplicados y desactivar las que sobren.

**Alternativas descartadas.** Enum cerrado, como el resto de los catálogos (D-004). Y
catálogo por vendedor, que es como lo hace Badger Maps.

**Por qué.** Es la excepción a D-004 porque nadie puede enumerar por adelantado los tipos de
comercio de un país entero, y la lista crece con cada zona nueva que se abre.

Global y no por vendedor porque §7.6 necesita que `tipo_comercio` sea comparable con la
clasificación de Zoho para el modelo de gemelos. Un catálogo por usuario se fragmenta en
tres versiones de "minisuper" la primera semana, y ahí el cruce se vuelve imposible.

---

## D-013 — En el mapa, el color codifica el filtro elegido

**Fecha:** 2026-08-21

**Decisión.** En el mapa, el color de los pines codifica la variable que el usuario eligió
—tipo de cuenta, vendedor, días sin contacto en gama de claro a oscuro— y **la leyenda es
obligatoria y siempre visible**. Fuera del mapa, el color sigue significando estado.

**Alternativa descartada.** Mantener la regla de §17 sin excepciones.

**Por qué.** §17 fija que el color significa estado, y esa regla sigue siendo correcta en
listas y formularios. Pero un mapa es una superficie de análisis: su valor está en ver
patrones geográficos de la variable que se está mirando, y eso exige que el color sea
configurable.

La excepción se acota con la leyenda obligatoria, que es lo que preserva el principio de
fondo: **los estados nunca dependen solo del color**.

---

## D-014 — Los filtros viven en la dirección, no en el estado de React

**Fecha:** 2026-08-21

**Decisión.** Los filtros de la cartera, la dimensión de colorización y la vista elegida se
serializan a la URL. El botón Volver usa el historial del navegador en vez de un destino
fijo.

**Alternativa descartada.** Mantenerlos en el estado del componente, que es lo natural en
React.

**Por qué.** Con el estado en memoria, entrar a una cuenta y volver lo perdía todo. El
negocio lo encontró trabajando: para corregir potenciales había que rearmar el
filtro después de cada una, y con diez cuentas eso vuelve el trabajo en tanda inviable.

Efecto secundario que sale gratis: **la vista queda enlazable**. Un líder puede mandarle a
un vendedor la dirección exacta de lo que está mirando.

Se usa `replace` y no `push`: cada toque de filtro no debe dejar una entrada en el historial,
o el botón de atrás tardaría veinte toques en salir de la pantalla.

---

## D-015 — La cuenta nace como potencial, y descartarla no la borra

**Fecha:** 2026-08-22

**Decisión.** `tipo_cuenta` pasa de dos valores a cuatro: `potencial`, `prospecto`,
`cliente`, `descartada`. El valor por omisión al crear una cuenta es `potencial`, y la
promoción a prospecto —o el descarte, con su motivo obligatorio— la resuelve el vendedor al
registrar el primer seguimiento.

**Alternativas descartadas.**

- Dejar que todo nazca como `prospecto`, que es lo que hacía antes.
- Una tabla aparte de "candidatos" que se convierte en cuenta al visitarse.
- Descartar con borrado lógico (`deleted_at`), tratándolo como basura.

**Por qué.** Una cuenta nace de dos formas y hasta ahora las dos quedaban iguales. En la
calle, parado frente al local, se captura el GPS y se registra la visita en el acto. En la
oficina, planificando sobre el mapa, no ha habido contacto todavía. Llamar "prospecto" a lo
segundo es afirmar algo que no ocurrió, y contamina toda métrica que cuente prospectos.

Una tabla aparte se descartó porque duplica el modelo: mismos campos, mismo RLS, misma
pantalla de edición, y una conversión que hay que mantener. El estado es un campo, no una
tabla.

**Descartar no borra** porque saber que alguien ya fue y no sirvió es información, no basura:
es lo que evita que otro vendedor repita el viaje. La cuenta descartada conserva su visita y
su motivo; simplemente sale de la cartera del día salvo que se pidan las descartadas.

Efecto secundario buscado: **la cola de trabajo se vuelve visible**. «Potencial» es un
filtro de tipo de cuenta, y lo que hay ahí es exactamente lo que falta ir a ver.

**Consecuencia en el catálogo.** `motivo_descarte` gana el valor `sin_interes`. El enum nació
para los puntos de Google que nunca llegaron a ser cuenta, y ahí los cinco valores
alcanzaban. Ahora califica también una cuenta que sí se visitó, y el caso más común de esa
visita —el encargado escuchó y no le interesó— no tenía dónde caer. Sin ese valor todo
terminaba en "otro", y el reporte de por qué se pierden los prospectos no diría nada.

---

## D-016 — Programar un seguimiento y registrarlo son dos pantallas

**Fecha:** 2026-08-22

**Decisión.** Se separan dos acciones que estaban pegadas:

- **Registrar seguimiento** (`/cuentas/[id]/seguimiento`) — contar qué pasó, cuando ya pasó.
  Lleva check-in, resultado y evidencia. De ahí puede salir el próximo paso encadenado.
- **Programar seguimiento** (`/cuentas/[id]/programar`) — agendar qué se va a hacer y cuándo.
  No afirma que haya pasado nada. Produce un compromiso con `visita_id` nulo.

Los dos alimentan la misma pantalla de Seguimientos, que es donde se ejecutan.

**Alternativa descartada.** Mantener una sola pantalla, como estaba: el próximo paso solo se
podía crear como consecuencia de registrar una visita.

**Por qué.** Lo planteó el negocio y es correcto: *"la acción de crear es en base a un plan,
una siguiente acción, y luego la acción del seguimiento es hacer el seguimiento"*.

Con una sola pantalla, para agendar una visita futura había que registrar una visita que no
ocurrió y elegirle un resultado. Eso es exactamente la clase de dato falso que este sistema
existe para no producir: el principio rector es que **el avance es consecuencia de hechos
registrados**, y un hecho inventado para poder usar el formulario rompe el principio en su
raíz.

El reparto de pantallas queda: en **Cuentas** se programan los seguimientos futuros; en
**Seguimientos** se ejecutan y se registra el resultado.

---

## D-017 — El próximo paso deja de ser obligatorio en los resultados terminales

**Fecha:** 2026-08-22

**Decisión.** §6 obliga a que todo seguimiento deje un próximo paso. Se mantiene, con tres
excepciones: `local_cerrado`, `no_usa_productos` y `sin_interes`. Con esos resultados —y con
la cuenta que se acaba de descartar— el próximo paso es opcional. Si se llena, sigue
necesitando fecha: o los dos campos o ninguno.

**Alternativa descartada.** Mantener la regla sin excepciones, que es lo que estaba.

**Por qué.** La regla es buena y es la que evita que una cuenta se apague sin que nadie lo
note. Pero pedirle una fecha futura a quien acaba de encontrar el local cerrado no produce un
compromiso: produce un compromiso inventado. Y una regla que obliga a inventar enseña a
escribir cualquier cosa con tal de guardar, que es peor que no tener la regla.

La excepción se acota a los tres resultados donde la conversación de verdad terminó. En todo
lo demás —incluido "no estaba el encargado", que es el caso donde más falta hace— sigue
siendo obligatorio.

---

## D-018 — Las coordenadas de la cuenta se editan en la cuenta, no en la visita

**Fecha:** 2026-08-22

**Decisión.** Las coordenadas pasan a ser un campo editable de la cuenta, dentro de *Editar
datos*, junto a dirección y poblado. Tres caminos: escribirlas, tomarlas del celular
("Estoy aquí"), o tocarlas en el mapa. El check-in del seguimiento se queda donde está, y
**solo se pide cuando la interacción es una visita**.

**Alternativa descartada.** Seguir capturando la ubicación únicamente al crear la cuenta, con
la pantalla `/ubicar` como único remedio.

**Por qué.** Estaban confundidas dos cosas distintas:

- **Dónde queda el local** — dato de la cuenta, se corrige cuantas veces haga falta.
- **Dónde estaba el vendedor al registrar la visita** — hecho de la bitácora, no se toca.

Una cuenta creada sin señal quedaba fuera del mapa y no había forma de arreglarlo desde la
pantalla donde se corrige todo lo demás.

De paso se corrige el orden del formulario de seguimiento: **la intención va primero**,
porque decide el resto de la pantalla. Una llamada no tiene check-in ni foto del local, y
pedírselos enseña al vendedor a saltarse campos, que es el hábito que después vacía la base.
El orden queda: intención → check-in (solo si es visita) → resultado → clasificación (solo si
la cuenta era un potencial) → notas → proveedor y precio → evidencia → próximo paso.

---

## D-019 — La cartera no muestra potenciales

**Fecha:** 2026-08-23

**Decisión.** `/cuentas` esconde por omisión las cuentas con `tipo = 'potencial'`, igual
que ya escondía las descartadas. Se traen con el interruptor **«Mostrar potenciales»** del panel de
filtros, o eligiendo ese tipo. El mapa de una lista las pide expresamente
(`incluirPotenciales=1`), porque una lista **son** potenciales.

**Por qué.** Armando la primera lista real —Aguadulce— los potenciales levantados en tanda cayeron a
la cartera y la taparon. El gerente proyectó el problema antes de que ocurriera, con la
aritmética exacta: *«si quedan 10 sin atender al día siguiente estoy en Chitré y alimento 20
potenciales más a cuentas, en un mes tendré más de 100 potenciales no atendidos en cuentas»*.

La causa es que D-015 resolvió esto a medias: creó las listas como superficie aparte para los
potenciales pero **nunca los sacó de la cartera**, así que siguieron cayendo en los dos lados.

**El criterio, que vale más que la regla.** Un potencial es abundante y desechable; una cuenta es
escasa y permanente. Mezclarlos no perjudica a los potenciales: perjudica a las cuentas. La cartera
es la pantalla de consulta —buscar un cliente, revisar un expediente— y ese uso muere si hay
que pasar por cien puntos que nadie ha visitado.

**Alternativas consideradas.**

- *No guardar los potenciales en `cuentas`, sino en una tabla de candidatos que «asciende» al
  tocarlos.* Descartada: obliga a duplicar ficha, ubicación, cadencia y RLS, y a migrar de
  tabla en el momento más frágil —el vendedor parado en la puerta, sin señal—. El identificador
  cambiaría justo cuando el modo offline exige que no cambie (§16).
- *Borrar los potenciales viejos.* Contra el borrado lógico de §16 y contra el sentido: saber que ese
  punto ya se levantó evita volver a levantarlo.
- *Mostrarlos al final de la lista.* No resuelve nada: siguen contando en los totales y
  apareciendo en el filtro por poblado.

**Lo que no se hizo, a propósito.** No se les pone caducidad. Un potencial que nadie tocó en tres
meses sigue siendo válido; lo que envejece es **la lista**, y eso ya se mide con
`sin_tocar_hace_mucho`. Abandonar una zona es decisión del vendedor, no de un cron.

---

## D-020 — Los parámetros que no son filtros sobreviven al panel

**Fecha:** 2026-08-23

**Decisión.** `aUrl()` recibe los parámetros actuales de la dirección y conserva `lista` y
`cuenta` al reescribirla.

**Por qué.** El panel de filtros reconstruía la dirección desde cero (D-014). En
`/mapa?lista=X`, tocar cualquier filtro borraba `lista=X` y aparecía la cartera entera. No se
había visto porque hasta el día anterior el mapa no recibía `lista`. Es el riesgo de tener el
estado en la dirección: quien la reescribe tiene que saber qué no es suyo.

---

## D-021 — Un solo reloj, y es el de Panamá

**Fecha:** 2026-08-24

**Decisión.** `public.hoy_panama()` es la única forma de preguntar qué día es. `current_date`
no vuelve a aparecer en el esquema.

**Por qué.** La base de Supabase corre en **UTC**. Las vistas mezclaban los dos relojes en la
misma resta:

```
current_date - (ult.fecha at time zone 'America/Panama')::date
^^^^^^^^^^^^ UTC        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Panamá
```

Desde las 7:00 p.m. de Panamá, para la base ya era el día siguiente. Una visita registrada esa
misma tarde aparecía como **«Hace 1 día»**, `fuera_de_cadencia` se encendía un día antes de
tiempo, y una oportunidad que cerraba hoy quedaba congelada por vencida.

Todas las noches, **y justo a la hora en que el vendedor cierra su día**, que es cuando más
mira la pantalla. Lo reportó gerencia a las 7:55 p.m.: *«acabo de crear en la tarde un
registro, pero ahora parece que dice ayer»*.

**Alternativa descartada.** Poner la base en `America/Panama`. Cambia el significado de todo
`timestamptz` guardado, contradice §16 —fechas en UTC, presentadas en Panamá— y rompería el día
que la empresa opere en otro huso.

**La lección, que no es de zonas horarias.** El error no fue usar `current_date`, fue **mezclar
dos fuentes de verdad en una sola expresión**. Se veía correcto: cada mitad citaba su zona.

---

## D-022 — El catálogo de categorías se defiende de sí mismo

**Fecha:** 2026-08-24

**Decisión.** Tres capas sobre el catálogo abierto de D-012:

1. El índice único compara **sin acentos y sin mayúsculas** (`normalizar_texto`), así que
   «Panadería» y «Panaderia» no pueden coexistir.
2. Guardar una cuenta ya no inserta a ciegas: `asegurar_categoria()` devuelve **cómo se
   escribe**, y la cuenta se queda con la grafía del catálogo.
3. Pantalla de depuración en `/categorias` — corregir, unir y ocultar—, **para el líder y para
   gerencia**.

**Por qué.** D-012 prometió la depuración en su propio texto y nunca se construyó. Un catálogo
abierto sin forma de limpiarlo solo puede crecer, y creció: dos panaderías y un «mimisuper» en
la primera semana de uso real.

La capa 2 es la que faltaba de verdad. Sin ella el catálogo quedaba limpio y **las cuentas
sucias**, porque `tipo_comercio` es texto libre y nunca se comparaba contra el catálogo al
guardar. Era el caso exacto: el catálogo decía «Panadería» y la cuenta decía «Panaderia».

**Cambio respecto a D-012:** depurar era solo de gerencia; ahora también del líder. Él revisa
el trabajo del equipo cada semana y ve el dedazo el viernes, no dentro de un mes.

**Ninguna operación toca solo el catálogo.** Renombrar y fusionar **arrastran las cuentas**.
Corregir «mimisuper» dejando las cuentas diciendo «mimisuper» sería peor que no corregir:
daría por resuelto lo que sigue roto.

---

## D-023 — Las sugerencias de categoría no son un `datalist`

**Fecha:** 2026-08-24

**Decisión.** El campo de tipo de comercio muestra sus propias sugerencias, filtradas sin
acentos ni mayúsculas, desde la primera letra.

**Por qué.** El `datalist` del navegador compara letra por letra: escribiendo «panaderia» no
ofrecía «Panadería». El vendedor concluía —razonablemente— que no existía, y escribía la suya.
**El duplicado no lo creó un descuido: lo creó el campo.** Además el navegador decide solo
cuándo mostrarlo y en el celular a veces no aparece.

Se agrega un aviso explícito cuando lo escrito no está en el catálogo: *«"mimisuper" es nueva.
Va a quedar en el catálogo para todo el equipo»*. Crear una categoría tiene que ser un acto
consciente, no el resultado de no haber encontrado la que ya existía.

---

## D-024 — La cadencia es un ritmo, no una fecha

**Fecha:** 2026-08-24

**Decisión.** Las cadencias sugeridas pasan a ser ocho —semanal, quincenal, mensual,
bimestral, trimestral, cada 4, 5 y 6 meses— más **«Otra»**, que abre un número libre de días
(1 a 365, lo que ya admitía la base). **No se agrega la opción de fijar una fecha.**

**Por qué las ocho.** El salto de mensual a trimestral dejaba fuera media papelería: un colegio
compra por trimestre escolar, una oficina de contabilidad se surte dos veces al año, y quien
tiene bodega pide cada cuatro o cinco meses. Con «Mensual» eran alarma permanente; con
«Trimestral», invisibles medio año. Una cadencia mal puesta es peor que ninguna: enseña a
ignorar el aviso.

**Por qué no la fecha.** Una cadencia es **un ritmo que se repite**; una fecha ocurre una vez y
al día siguiente ya no significa nada. «Volver el 15 de marzo» ya tiene su herramienta —el
**próximo paso**, que entra a la agenda y se cumple o no—. Guardarlo como cadencia lo sacaría
de la agenda y lo convertiría en un dato muerto dentro de la ficha.

El caso que motivó la pregunta —un cliente que tarda ocho meses— queda cubierto por «Otra»:
240 días. Lo que no cabe es más de un año, y a propósito: eso no es una cadencia, es una cuenta
que se dejó de atender.

**Vocabulario.** Se conservan las palabras del negocio hasta trimestral, y de ahí en adelante
se dice en llano: «Cada 4 meses» se entiende sin pensar, «cuatrimestral» hay que traducirlo.

---

## D-025 — «Lead» sale del vocabulario: se llama potencial

**Fecha:** 2026-08-24

**Decisión.** El término **lead** desaparece del proyecto —pantallas, esquema, código y
documentación— y en su lugar va **potencial**. Alcanza también al estado de la cuenta: el valor
`sin_clasificar` del enum `tipo_cuenta` pasa a llamarse `potencial`.

La escalera queda legible en el orden en que ocurre:

```
potencial → prospecto → cliente
                     ↘ descartada
```

**Por qué.** §14 manda nomenclatura en español, en el esquema y en la interfaz. «Lead» era el
único anglicismo que había entrado, y encima al lugar más visible: la apuesta que el vendedor
escribe cada viernes. La aplicación se le presenta a tres vendedores panameños; una palabra que
hay que explicar antes de usarla es una palabra que sobra.

**Por qué también el estado.** `sin_clasificar` describía el estado desde dentro del sistema
—«todavía no le pusimos etiqueta»— y la pantalla lo repetía tal cual. Visto desde la calle es
otra cosa: un comercio que puede comprarnos y al que nadie ha ido. Eso es un potencial, y decirlo
así convierte una etiqueta administrativa en una oportunidad.

**Se renombra la columna y el valor del enum, no solo la etiqueta.** Un esquema que dice
`apuesta_leads` mientras la pantalla dice «potenciales» obliga a traducir mentalmente cada vez
que se lee una consulta, y esa traducción se equivoca. `alter type ... rename value` fue seguro
porque se comprobó antes que ninguna vista ni política guardara el literal en su definición; el
valor por omisión de `cuentas.tipo` sobrevivió porque apunta al valor del enum, no a su texto.

**Consecuencia que hubo que resolver.** «Potencial» ya nombraba otra cosa: el puntaje 1–5 de
§7.5, que se calculará desde la facturación de Zoho. Ese puntaje pasa a llamarse **puntaje** a
secas. Dos cosas distintas con el mismo nombre en el mismo sistema garantizan que alguien las
confunda, y la confusión no habría aparecido hasta que el puntaje existiera —cuando ya sería
cara de deshacer—.

`docs/00-vision.md` **no se toca**: es el levantamiento original y ahí «lead» y «potencial»
quedan como se dijeron en su momento. Esta entrada es el puente entre ese texto y el
vocabulario actual.

---

## D-026 — Un objetivo se escribe, no se busca en el mapa

**Fecha:** 2026-08-24

**Decisión.** Una lista de tipo **objetivos** se llena con un formulario propio —nombre y,
opcionalmente, dirección de la oficina, contacto, teléfono y correo—. No ofrece la búsqueda de
Google ni el mapa. Las listas de **zona** siguen exactamente como estaban.

La cuenta nace con `origen = 'objetivo'` —valor nuevo del enum— y `tipo_punto = 'oficina'`, sin
coordenadas.

**Por qué.** El líder armó una lista de bancos, escribió «Banco General» y la aplicación le
devolvió las sucursales. Él no quiere una sucursal: quiere llegar a alguien en la oficina
central. La sucursal ni decide ni compra — es el mismo hallazgo que el motivo de descarte
«se negocia en Panamá» ya señalaba desde el otro lado.

Son dos oficios distintos y les hacía falta herramienta distinta:

| | Vendedor de ruta | Líder con un objetivo |
|---|---|---|
| Cómo lo encuentra | Está en la calle, se ve | Ya sabe el nombre; le falta con quién hablar |
| Qué le falta al empezar | Nada: va y toca | Contacto, teléfono, correo, dirección |
| Qué hace antes del primer contacto | Nada | **Investigar** |

**Lo único obligatorio es el nombre**, y eso es el punto: el objetivo entra en cuanto se decide
ir por él, aunque no se sepa nada más. Los otros cuatro campos casi siempre nacen vacíos y se
llenan a medida que los averigua.

**Los huecos son la tarea.** La tarjeta del objetivo, donde una cuenta de zona dice su poblado,
dice qué falta: *«Solo tienes el nombre»*, *«Falta teléfono, correo»*. Al completarse, la línea
desaparece sola — y esa desaparición es la señal de que ya se puede llamar. La lista de
objetivos es, literalmente, la libreta de investigación del líder.

**Alternativa descartada.** Un campo de búsqueda que consultara Google y dejara «crear a mano»
como salida. Se descartó porque el camino equivocado seguiría siendo el primero que se ofrece, y
porque para un objetivo el resultado de Google es ruido: devuelve sucursales cuando se pregunta
por una casa matriz.

**Lo que no cambia.** El objetivo sigue siendo un potencial y sale de serlo igual que cualquier
otro: con el primer seguimiento. Como es una llamada o un correo y no una visita, cae en
«Llamadas y correos» de la agenda, no en las paradas del día. Ahí se decide si pasa a prospecto
—y nace la oportunidad con su fecha— o se descarta con motivo.

---

## D-027 — Una compra no es una factura

**Fecha:** 2026-08-25

**Decisión.** Lo que un cliente compró son **las facturas más las órdenes de venta anuladas**.
Las órdenes abiertas no cuentan.

**Por qué.** Lo confirmó la oficina: para sacar mercancía se levanta una orden de venta, que en
Zoho **retiene el inventario** como pendiente. Al entregar y cobrar **se anula**, y esa
anulación es lo que libera la retención y marca el despacho. **Anular no es cancelar.**

Medir por facturas dejaba a Albert en $43 000 cuando vendió cerca de $85 000, y le escondía 16
clientes enteros. No habría sido medir mal: **habría sido peor que no medir**, porque produce un
número con apariencia de verdad y castiga justo al vendedor cuya venta menos se factura.

**Trampa evitada.** Una orden puede convertirse en factura después. Se filtra por estado de
facturación, no por fecha; se comprobó que ninguna de las 563 anuladas del año tenía factura.

**Consecuencia menos obvia.** La cadencia también salía mal: un cliente que compra cada quince
días por entrega anulada, contado solo por facturas, parece que no compra nunca — y el aviso de
«dejó de comprar» habría saltado sobre clientes que están comprando.

---

## D-028 — El RUC no es llave de cuenta, es dato del contribuyente

**Fecha:** 2026-08-25

**Decisión.** Se elimina `cuentas_ruc_unico`. Dos cuentas pueden compartir RUC, y **un contacto
de Zoho es una cuenta del SGV**, sin agrupar.

**Por qué.** El índice descansaba en una suposición falsa: que un RUC identifica un local. En el
maestro de Books hay **70 RUC repartidos entre 196 contactos** — cadenas que facturan sus
sucursales bajo el mismo. Cada sucursal es un local distinto, con su cadencia y su visita.

Cruzar por RUC habría colapsado los cuatro locales de una cadena en una cuenta: la facturación
sumada en uno y tres locales desaparecidos del mapa, **sin que nadie lo notara**.

**La jerarquía la arma el vendedor**, no el importador: él encuentra la oficina de negociación y
asocia las sucursales. Deducirla del RUC produce árboles falsos — dos negocios del mismo dueño
no son una cadena.

**La protección contra duplicados cambia de lugar y de tono.** `buscar_duplicados()` avisa y
deja decidir. **La base no puede distinguir un dedazo de una cadena; el vendedor sí.**

---

## D-029 — Poder ver no es que sea tuyo

**Fecha:** 2026-08-25

**Decisión.** La agenda y las listas filtran por `vendedor_id = auth.uid()`. La cartera y el
mapa **arrancan** con el filtro de vendedor puesto en uno mismo, pero solo si la dirección viene
limpia.

**Por qué.** El líder entró y encontró su agenda con las paradas de otros y su pantalla de
listas con rutas que armó otro vendedor. **No era un fallo del RLS: el RLS estaba bien.**

> El RLS decide **qué puedes ver**. La pantalla decide **qué es tuyo**.

Son dos preguntas distintas —qué me toca hoy, y cómo va el equipo— y la segunda no es esa
pantalla. Listas gana un interruptor «Las mías / Las del equipo» para cuando sí lo sea.

**El matiz del arranque.** El filtro por omisión solo se aplica con la dirección limpia: si trae
cualquier parámetro es que alguien ya tocó los filtros —o quitó ese a propósito— y volver a
ponerlo sería pelearse con el usuario. Por eso el mapa de una lista no se filtra.

---

## D-030 — El RUC se pide donde hace falta, con salida honesta

**Fecha:** 2026-08-25

**Decisión.** El RUC no se pide al crear la cuenta. Se pide cuando el vendedor registra que le
compró o pide cotización **y la factura la hace la oficina**, con la opción explícita de «no me
lo dieron». Se guarda en la cuenta, no en la solicitud.

**Por qué.** El vendedor conoce el comercio por el rótulo; la oficina lo factura por su razón
social. Cuando la factura vuelve de Zoho, el RUC es lo único que permite reconocerlas como la
misma — por nombre no se puede, y es justo lo que costó tanto en la migración.

En el alta el RUC estorba: el vendedor está frente al mostrador, con una mano, y el dato no le
sirve todavía. **En el momento de facturar sí lo tiene a la mano el cliente.**

**Por qué la salida honesta.** Obligarlo sin escape no consigue el RUC: consigue números
inventados. **Un RUC falso engancha con la cuenta equivocada, que es peor que no tener ninguno.**

**Y los dos nombres conviven.** La cuenta se llama como el vendedor la conoce; el expediente
añade «Se factura como …» cuando difieren. Obligarlo a aprenderse la razón social sería ponerle
la contabilidad encima al que está en la calle.

---

## D-031 — Badger aporta terreno, no identidad

**Fecha:** 2026-08-25

**Decisión.** Del archivo de Badger se cargan **los prospectos con sus coordenadas** y se
completan datos que falten en cuentas que enganchen con certeza. **No se emparejan clientes por
nombre para decidir identidad**, y lo dudoso se revisa a mano.

**Por qué.** Zoho tiene la llave dura —el RUC— y dice quién compró. Badger no tiene RUC, pero
tiene **lo único que no existe en ningún otro lado**: dónde queda cada local, y los prospectos
que todavía no compran y por eso no aparecen en ninguna factura.

**El riesgo es asimétrico y por eso el criterio también.** Un emparejamiento malo para poner
coordenadas deja un punto donde no va: se ve y se corrige. Uno malo para decidir identidad parte
un cliente en dos o funde dos en uno, y eso no se nota.

**Cuatro condiciones para dar una pareja por segura:** nombre igual o teléfono igual, más de una
palabra distintiva en común, **mismo vendedor**, y sin otro candidato pisándole los talones.

**No se automatizó más, a propósito.** Bajar el umbral al 66 % resolvía 43 dudosos y emparejaba
«MINI SUPER ECONÓMICA» con «Mini Super Amy», «Selina» y «Milenio». En Panamá, emparejar por
«Mini Super» es como emparejar por «Farmacia».

---

## D-032 — El poblado, solo donde significa algo

**Fecha:** 2026-08-25

**Decisión.** El poblado se deduce de la dirección **solo para el vendedor del interior**. Los de
ciudad lo dejan vacío y lo ponen ellos mirando el mapa. El campo pasa a llamarse
**«Poblado o zona»**.

**Por qué.** Las direcciones del interior traen el pueblo de verdad —Santiago, Aguadulce, Las
Tablas—. Las de ciudad dicen **«Panamá» 98 veces y «San Miguelito» 60**, que no es una zona de
trabajo: es la ciudad entera.

Ponérselo habría llenado el campo de una palabra inútil y, peor, **habría hecho creer que ya
estaba resuelto** — el filtro por zona seguiría sin servir y nadie sabría por qué.

---

## D-033 — La comisión se calcula sobre el neto, y no se guarda

**Fecha:** 2026-08-26

**Decisión.** El vendedor ve en la pantalla de Ventas cuánto lleva vendido en el mes y cuánta
comisión lleva ganada: **1,5 % de lo facturado, sin el ITBMS**, contando facturas y entregas —las
órdenes de venta anuladas, que en esta casa significan mercancía despachada y cobrada—. Los dos
valores viven en `parametros` (`comision_porcentaje`, `comision_sobre_neto`), no en el código.

**Por qué sobre el neto.** El ITBMS no es venta: se cobra para el Estado y se entrega. Comisionar
sobre él sería pagar por recaudar. La diferencia no es simbólica —en agosto, $274 contra $256 en
el mes de Christopher— así que queda explícita y cambiable sin desplegar.

**Y el neto sale de los renglones, no de restarle 7 % al total.** Hay documentos exentos y otros
con líneas exentas; restar a ojo daría un número que no cuadra con ninguna factura, y un número
que el vendedor no puede cuadrar con su papel es un número que deja de mirar.

**Por qué no se guarda.** Guardar la comisión obligaría a recalcularla cada vez que entra una
factura, y a decidir qué hacer con las ya guardadas cuando cambie el porcentaje. Calculada al
leer, siempre dice la verdad de hoy con la regla de hoy.

**Alternativas consideradas.** Ponerla en la Agenda, donde el vendedor entra todos los días. Se
descartó: un número de comisión delante todo el día motiva cuando el mes va bien y desmoraliza
cuando va mal. Va en Ventas, que se abre cuando se quiere abrir.

---

## D-034 — Lo que el vendedor proyecta no se guarda

**Fecha:** 2026-08-26

**Decisión.** Debajo del mes cerrado, la pantalla de Ventas lista las cotizaciones vivas y las
oportunidades con cierre estimado dentro del mes, cada una con lo que esa venta le dejaría de
comisión. El vendedor marca las que cree que entran y el total se mueve. **Lo marcado no se
guarda en ningún lado**: vive mientras la pantalla esté abierta.

**Por qué.** Es la cuenta que todo vendedor ya hace con papel y lápiz. Guardarla la convertiría
en un pronóstico —y un pronóstico guardado es un pronóstico que alguien le va a reclamar. En el
momento en que marcar tiene consecuencias, el vendedor deja de marcar con honestidad, y la
herramienta que servía para pensar pasa a servir para cubrirse.

**Alternativa considerada.** Sumarlo todo automáticamente. Se descartó: una cotización enviada y
una oportunidad en negociación no pesan igual, y solo el vendedor sabe cuál de las dos va a
entrar. Sumarlas solas daría un número que nadie cree.

---

## D-035 — Ventas vuelve a la barra del vendedor de ruta

**Fecha:** 2026-08-26

**Decisión.** La pantalla de Ventas entra a la barra de los cuatro roles. La barra del vendedor
pasa de cinco casillas a seis.

**Por qué cambió.** Se había sacado con un argumento que sigue siendo cierto —el vendedor de ruta
casi no negocia: vende en una o dos visitas, y eso es un pedido, no una oportunidad—. Lo que
cambió es la pantalla: **dejó de ser solo el embudo**. Hoy arriba muestra el mes y la comisión, y
eso lo mira todo vendedor, el de ruta más que nadie.

**El costo.** Seis casillas dejan 62 px por casilla en un teléfono de 375 px, y «Solicitudes» a
12 px no entra. La letra de la barra baja a 10 px solo cuando hay más de cinco. Se acepta porque
el ícono sigue siendo el que se toca y el alto táctil no cambia.

---

## D-036 — Ventas se parte en tres, en orden de dureza

**Fecha:** 2026-08-26

**Decisión.** La pantalla de Ventas queda con tres pestañas: **Facturado**, **Cotizaciones** y
**Oportunidades**. Facturado es la de arranque.

**Por qué en ese orden.** Es orden de **dureza del compromiso**: primero lo que ya ocurrió y
nadie discute, después la promesa escrita y firmada, y al final la intención. Quien abre Ventas
ve primero el número que es verdad, y los otros dos en el lugar que les corresponde.

Antes las tres cosas convivían en una sola vista: el embudo con un bloque de mes encima, y las
cotizaciones sin ninguna pantalla propia. **La cotización sin pantalla es la forma más cara de
perder una venta** — el trabajo ya se hizo, el precio ya se dio, y solo faltó volver a llamar.

**La proyección se queda en Facturado**, aunque sus renglones salgan de las otras dos pestañas.
No es duplicación: en Cotizaciones una cotización es trabajo pendiente, y en Facturado es un
sumando. La misma cosa, dos preguntas.

---

## D-037 — El filtro de vendedor es el primer control de Ventas

**Fecha:** 2026-08-26

**Decisión.** Ventas abre con una fila de opciones —*Mis ventas · Albert · Javier · Todo el
equipo*— arriba de las pestañas. El líder y gerencia ven el mes, la comisión, las cotizaciones y
el embudo de cualquiera de los suyos, o de todos juntos. Cada oportunidad y cada cotización dice
de quién es **cuando se mira a más de uno**, y solo entonces.

**Por qué.** Es la misma lección que ya se aplicó en Cuentas y en Mapa: *de quién es esto* es la
primera pregunta de quien ve más de una cartera. El líder que abría Ventas del equipo veía
cuarenta oportunidades sin dueño — eso no es mirar datos, es mirar una mezcla.

**Sustituye al interruptor «Ver el equipo».** Un interruptor solo tiene dos estados y la pregunta
tiene tantos estados como vendedores. Y a futuro entran más.

**Arranca en lo propio, menos para gerencia.** Poder ver lo del equipo no lo hace suyo. Gerencia
es la excepción y no por descuido: no vende, así que su cartera propia es cero, y arrancarla en
cero sería mostrarle la única cifra de la pantalla que no significa nada.

**El total del equipo se rotula en plural — «Comisiones del mes».** No es la comisión de nadie:
es la suma de tres comisiones que cobran tres personas distintas. En singular se leería como un
número propio del líder.

**Y cada vendedor aparece aunque haya vendido cero.** `comision_del_equipo` devuelve una fila por
cada perfil que se le pida. Si el que no vendió desapareciera de la lista, el líder leería «no lo
estamos midiendo» donde dice «no vendió» — y esas dos cosas piden reacciones opuestas.

---

## D-038 — El aviso de reposición mira hacia adelante

**Fecha:** 2026-08-26

**Decisión.** La vista `cuentas_resumen` gana `dias_para_reponer` = cadencia observada − días
desde la última compra. Positivo son los días de producto que le quedan al cliente; negativo, que
ya se le acabó. Con eso: una sección en la Agenda, un filtro en Cuentas y Mapa, y una dimensión
de color.

**Por qué.** `dejo_de_comprar` ya existía y es un **diagnóstico tardío**: cuando salta, el cliente
ya se quedó sin producto — y quien se queda sin producto ya le compró a otro. §7.7 pide lo
contrario, avisar unos días antes del ciclo estimado. Todo lo necesario estaba calculado; faltaba
una resta.

**La Agenda solo mira hacia adelante: de 0 a 7 días.** Los que ya se quedaron sin nada no son
trabajo de hoy sino recuperación, y meterlos ahí llenaría la agenda de gente que se fue hace medio
año. Se llega a ellos por un enlace, no por una alarma.

**Se calcula, no se guarda.** Cambia solo con el paso del tiempo: una columna guardada estaría mal
al minuto siguiente de escribirla.

**Sin ritmo medible, la cuenta queda fuera del filtro** — no se cuela como «le queda mucho».
Prometer que se sabe cuándo vuelve a comprar quien solo compró una vez es peor que callar.

---

## D-039 — La lista de reposición se ordena por lo recuperable, no por lo perdido

**Fecha:** 2026-08-26

**Decisión.** Con el filtro de reposición activo, la cartera se ordena así: primero los que ya se
quedaron sin producto, **y de esos el más reciente primero**; después los que todavía tienen, del
que se queda sin nada antes al que aguanta más.

**Por qué al revés de lo que parece.** El primer orden que escribí ponía de primero al más
atrasado —el que lleva 200 días sin comprar—. Es exactamente el peor candidato: ese ya tiene otro
proveedor. **El que se quedó sin producto ayer todavía no le compró a nadie.** Ordenar por quién
está más perdido es ordenar la ruta por dónde no ir.

Con los datos reales de Javier, el filtro «se le acaba en 7 días» devuelve 43 cuentas. Ordenadas
por nombre son una lista; así son una ruta, y arranca en Steven Jiménez —compra cada 7 días, lleva
1 sin producto—.

**Un pendiente conocido:** «ya se le acabó» es absoluto y debería ser relativo. Cinco días de
atraso en un cliente que compra cada 4 es grave; en uno que compra cada 90, no es nada. Hoy los
dos entran igual. Se arregla cuando haya con quién validar el umbral.

---

## D-040 — La sincronización corre en GitHub Actions, no en Vercel

**Fecha:** 2026-08-26

**Decisión.** Las dos pasadas de Zoho corren de madrugada como una tarea programada de GitHub
Actions —`.github/workflows/sincronizar-zoho.yml`—, a las 2:00 de Panamá.

**Por qué no en Vercel.** Era la opción obvia porque ahí vive la aplicación, pero:

- **Las funciones de Vercel se cortan.** La primera pasada del historial contra una base vacía
  tarda trece minutos abriendo dos mil documentos. Ese caso vuelve cada vez que se estrena un
  entorno — producción, por ejemplo. En Actions no hay prisa.
- **Los scripts no importan una sola dependencia.** Corren sobre Node pelado, así que la tarea es
  un `checkout` y dos `node`. Meterlos en una ruta de la aplicación obligaba a refactorizar
  novecientas líneas que hoy funcionan.
- **El registro queda guardado y a la vista.** Es lo que permite darse cuenta de que algo dejó de
  correr — que es exactamente cómo se descubren estas cosas: tarde.

**El costo:** los secretos viven en dos lugares, GitHub y Vercel. Se acepta.

**Y un seguro contra la base equivocada.** La variable `SUPABASE_REF_ESPERADO` hace que la pasada
se detenga si la dirección de Supabase no apunta al proyecto que se esperaba. Un secreto mal
pegado no da error: escribe, y escribe bien, en el proyecto que no era. Se descubre semanas
después, cuando los números no cuadran.

---

## D-041 — El modelo de gemelos dice un rango, no una cifra

**Fecha:** 2026-08-26

**Decisión.** El consumo típico por tipo de comercio se muestra como el rango del medio —del
cuartil 25 al 75— y no como un solo número: *«Panadería — la mitad compra entre $7 y $75 al mes,
cada 39 días»*. Con menos de cinco clientes del tipo no se muestra nada.

**Por qué no el promedio.** En «Distribuidora» el promedio anual da $4 480 y la mediana $179: la
diferencia es un cliente grande que arrastra a los otros ocho.

**Por qué tampoco la mediana sola.** Al medir el reparto completo, entre el cuartil bajo y el alto
hay de **3 a 27 veces** según el tipo. Se comprobó que no son datos sucios: el cuadre contra las
1 541 transacciones da 0,2 % de diferencia. Los comercios del mismo rubro de verdad compran
cantidades muy distintas.

Ante ese reparto, «una panadería compra $20 al mes» da por típico lo que no lo es. El vendedor que
entra a la de $75 y el que entra a la de $7 reciben el mismo número y no lo reconoce ninguno.

**Un rango dice el orden de magnitud, dice que varía, y no promete precisión que no hay.**

**El piso de cinco clientes hace dos trabajos.** Con dos, la cifra no es un patrón sino una
anécdota — y además **es** la de esos dos, así que cualquiera que sepa quiénes son acaba de
enterarse de cuánto compran. Por eso la función es `security definer` —tiene que contar toda la
empresa, no la cartera de quien pregunta— y el piso es lo que hace que eso no filtre nada.

---

## D-042 — Parecerse no basta: hay que parecerse en tamaño

**Fecha:** 2026-08-26

**Decisión.** En `parecidos()`, la regla de «uno contiene al otro» solo cuenta cuando los dos
nombres tienen **casi las mismas palabras** —una de diferencia como mucho—.

**Por qué.** La pantalla de depuración proponía meter «Cooperativa agro ferretería y supermercado»
dentro de «Supermercado». Y también dentro de «Ferretería», las dos a la vez. Aceptar cualquiera
de las dos habría borrado lo único que ese nombre dice: que el local es las tres cosas.

Sigue funcionando para lo que la regla existía —«super» y «supermercado», «agropecuaria» y «tienda
agropecuaria»—. Cuatro palabras de diferencia no es la misma categoría escrita de otra forma: es
otra categoría.

Con el arreglo, la pantalla propone 5 uniones en vez de 7, y las 5 son correctas.
