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
