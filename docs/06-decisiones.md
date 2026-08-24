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
negocio lo encontró trabajando: para corregir cuentas sin clasificar había que rearmar el
filtro después de cada una, y con diez cuentas eso vuelve el trabajo en tanda inviable.

Efecto secundario que sale gratis: **la vista queda enlazable**. Un líder puede mandarle a
un vendedor la dirección exacta de lo que está mirando.

Se usa `replace` y no `push`: cada toque de filtro no debe dejar una entrada en el historial,
o el botón de atrás tardaría veinte toques en salir de la pantalla.

---

## D-015 — La cuenta nace sin clasificar, y descartarla no la borra

**Fecha:** 2026-08-22

**Decisión.** `tipo_cuenta` pasa de dos valores a cuatro: `sin_clasificar`, `prospecto`,
`cliente`, `descartada`. El valor por omisión al crear una cuenta es `sin_clasificar`, y la
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

Efecto secundario buscado: **la cola de trabajo se vuelve visible**. "Sin clasificar" es un
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
la cuenta estaba sin clasificar) → notas → proveedor y precio → evidencia → próximo paso.

---

## D-019 — La cartera no muestra leads

**Fecha:** 2026-08-23

**Decisión.** `/cuentas` esconde por omisión las cuentas con `tipo = 'sin_clasificar'`, igual
que ya escondía las descartadas. Se traen con el interruptor **«Mostrar leads»** del panel de
filtros, o eligiendo ese tipo. El mapa de una lista las pide expresamente
(`incluirSinClasificar=1`), porque una lista **son** leads.

**Por qué.** Armando la primera lista real —Aguadulce— los leads levantados en tanda cayeron a
la cartera y la taparon. El gerente proyectó el problema antes de que ocurriera, con la
aritmética exacta: *«si quedan 10 sin atender al día siguiente estoy en Chitré y alimento 20
leads más a cuentas, en un mes tendré más de 100 leads no atendidos en cuentas»*.

La causa es que D-015 resolvió esto a medias: creó las listas como superficie aparte para los
leads pero **nunca los sacó de la cartera**, así que siguieron cayendo en los dos lados.

**El criterio, que vale más que la regla.** Un lead es abundante y desechable; una cuenta es
escasa y permanente. Mezclarlos no perjudica a los leads: perjudica a las cuentas. La cartera
es la pantalla de consulta —buscar un cliente, revisar un expediente— y ese uso muere si hay
que pasar por cien puntos que nadie ha visitado.

**Alternativas consideradas.**

- *No guardar los leads en `cuentas`, sino en una tabla de candidatos que «asciende» al
  tocarlos.* Descartada: obliga a duplicar ficha, ubicación, cadencia y RLS, y a migrar de
  tabla en el momento más frágil —el vendedor parado en la puerta, sin señal—. El identificador
  cambiaría justo cuando el modo offline exige que no cambie (§16).
- *Borrar los leads viejos.* Contra el borrado lógico de §16 y contra el sentido: saber que ese
  punto ya se levantó evita volver a levantarlo.
- *Mostrarlos al final de la lista.* No resuelve nada: siguen contando en los totales y
  apareciendo en el filtro por poblado.

**Lo que no se hizo, a propósito.** No se les pone caducidad. Un lead que nadie tocó en tres
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
