# Requerimientos — CRM de Campo (Fuerza de Ventas)

**Empresa:** Papelería comercial (Panamá)
**Documento:** Levantamiento de requerimientos, Fase 1
**Destino:** Prompt base para desarrollo con Claude Code
**Fecha:** Agosto 2026

---

## 1. Objetivo

Construir una aplicación móvil interna para los vendedores de calle que permita capturar prospección, seguimiento y cierre de ventas en el punto de venta, y que **genere automáticamente los reportes de avance** sin que el vendedor tenga que redactar nada.

El problema actual: Badger Maps ubica clientes en el mapa y permite filtrar, pero no responde las preguntas de gerencia — qué plan está siguiendo cada vendedor, qué prospectos tiene vivos, en qué etapa está cada uno, y cuál es su tasa real de cierre. Hoy esa información no existe en ningún sistema.

**Principio rector:** el vendedor no reporta avance. El avance es consecuencia de hechos registrados (check-ins, cambios de etapa, cotizaciones, facturas).

---

## 2. Alcance y frontera con los sistemas existentes

La empresa ya tiene dos sistemas. Esta aplicación **no los reemplaza**, se conecta a ellos.

| Sistema | Qué hace hoy | Rol frente al CRM de campo |
|---|---|---|
| **Zoho CRM** | CRM de oficina usado por una persona interna para dar seguimiento de compra a los clientes de la casa. Cuentas, contactos y seguimiento. | Fuente de lo **cualitativo**: tipo de comercio, contactos, propietario de la cuenta. Los vendedores **no** tienen acceso. |
| **Zoho Books / Inventory** | Emisión de cotizaciones y facturación. Integrado con Zoho CRM. | Fuente de lo **cuantitativo**: clientes activos, volumen, líneas de producto, estado de cotizaciones. |
| **SGP** (app de producción, en desarrollo) | Gestión de producción e inventarios | Fuente de **estado y fecha estimada de entrega** de los pedidos. El CRM de campo lee de aquí. |
| **CRM de campo** (este proyecto) | — | Dueño de **prospectos, visitas, planes, bitácoras y pipeline**. |

**Modelo híbrido acordado:** los clientes activos y su historial de compras viven en Zoho; toda la prospección nace y vive en el CRM de campo.

**Fuera de alcance en Fase 1:** contabilidad, inventario, emisión de facturas, cálculo de comisiones.

---

## 3. Usuarios y permisos

| Rol | Alcance de visibilidad | Funciones propias |
|---|---|---|
| **Gerente** | Todo + configuración | Aprueba precios especiales, aprueba reasignaciones de cartera, tablero global |
| **Líder de ventas** (también vendedor de cuentas clave) | Todo el equipo + su cartera | Define guías generales de planificación con el equipo |
| **Vendedor ejecutivo (campo)** | Solo lo suyo | Prospección directa en local: supermercados, restaurantes, cadenas pequeñas |
| **Vendedor interior** | Solo lo suyo | Cubre desde La Chorrera hasta Chiriquí; trabaja por giras multi-día |
| **Administración / oficina** | Bandeja de solicitudes y pedidos | Emite cotizaciones en Zoho, da de alta clientes, atribuye facturas |

**Regla de control:** como el líder es juez y parte (supervisa y vende), las reasignaciones de cartera o de prospectos entre vendedores requieren aprobación del gerente y quedan en bitácora.

---

## 4. Entidades principales

- **Prospecto** — nombre, contacto, correo, WhatsApp, ubicación GPS, zona/territorio, tipo de comercio, **producto(s) de interés** (rollos fiscales, bolsas de papel, papel antigrasa, otros), vendedor asignado, etapa, origen, fecha de creación.
- **Cliente** — espejo de solo lectura desde Zoho: razón social, RUC, ubicación, historial de compras, fecha de última compra, vendedor atribuido, umbral de "dormido".
- **Visita / Interacción** — tipo (visita, llamada, WhatsApp, correo, entrega de muestra), fecha, check-in GPS, resultado, notas, fotos, **proveedor actual y precio de referencia**.
- **Compromiso** — próximo paso + fecha comprometida. Es el motor del seguimiento diario.
- **Oportunidad** — prospecto o cliente + producto + monto estimado + etapa + probabilidad.
- **Solicitud de cotización** — ítems, cantidades, precio solicitado, requiere o no aprobación de precio, estado, número de cotización de Zoho enlazado.
- **Plan de visitas** — planificación libre del vendedor, con snapshot diario.
- **Territorio** — zona geográfica, vendedor asignado, estado (cubierta / en desarrollo / sin cobertura).

---

## 5. Flujo completo (tal como ocurre en la realidad)

1. **Detección.** El vendedor llega a un local, conversa con el encargado y detecta interés en algún producto.
2. **Creación del prospecto** en la app, con ubicación GPS del local, datos de contacto y producto de interés. El sistema **valida duplicados** antes de crear.
3. **Bitácora inicial** con notas y foto (fachada, ubicación, producto actual del competidor).
4. **Compromiso** con fecha: enviar cotización, traer muestra, llamada de seguimiento.
5. **Ciclo de seguimiento.** El vendedor revisa sus compromisos por fecha y ejecuta: nueva visita, WhatsApp o correo. Cada interacción se registra.
6. **Solicitud de cotización** desde la app.
   - Si el precio es de lista → va directo a administración.
   - Si requiere precio especial por volumen o producto nuevo → **va primero al gerente para aprobación**, y solo aprobado pasa a administración.
7. **Emisión.** Administración crea la cotización en Zoho y **enlaza el número de cotización** en la app. El estado de esa cotización se lee desde Zoho.
8. **Envío al prospecto** y nuevo ciclo de seguimiento hasta la definición.
9. **Cierre.**
   - **Ganado** → el prospecto pasa a estado *pendiente de alta*; administración lo aprueba y lo crea en Zoho, guardando el ID de cliente para amarrar historia de prospección con historia de compras.
   - **Perdido** → motivo tipificado obligatorio (ver §6).
10. **Facturación.** La factura sale de Zoho. El CRM la lee y la atribuye al vendedor automáticamente. La oficina solo interviene cuando falta atribución o hay que vincularla a una oportunidad.
11. **Entrega.** El CRM lee del SGP la fecha estimada de entrega y el estado del pedido, y se lo muestra al vendedor para que informe al cliente.

---

## 6. Reglas de negocio acordadas

**Duplicados.** Al crear un prospecto, el sistema valida contra clientes de Zoho y prospectos existentes por nombre, RUC y cercanía geográfica. Si hay coincidencia, avisa: *"este punto ya está registrado y asignado a X"*. Evita que un vendedor prospecte a un cliente de la casa o a un prospecto de otro compañero.

**Captura mínima obligatoria por visita:** check-in GPS automático, resultado de la visita (opciones fijas), próximo paso con fecha compromiso, y foto/evidencia. El registro completo debe poder cerrarse en menos de 30 segundos.

**Planificación.** El vendedor planifica libremente; el sistema compara plan contra ejecutado. El plan es **editable siempre**, pero el sistema toma un snapshot automático al inicio de cada día y registra toda edición posterior con hora y motivo. El cumplimiento se mide contra el snapshot, no contra la última versión. El número de replanificaciones es en sí mismo un indicador.

**Cliente dormido.** Umbral por defecto según tipo de comercio (un restaurante recompra cada ~15 días; una oficina cada ~3 meses). El vendedor puede ajustarlo cliente por cliente **dentro de un rango permitido**, y todo ajuste queda registrado con autor y fecha, visible para gerencia.

**Motivos de pérdida tipificados**, con tratamiento distinto:
- *Precio / mejor oferta de la competencia* → estado **"reintentar"** con fecha de recontacto automática. Es la mejor lista de reactivación futura.
- *Sin interés real* → descartado.
- *No volver a contactar* → excluido de listas.

**Aprobación de precios.** La solicitud llega al gerente mostrando precio de lista, precio solicitado y margen resultante, para decidir con información y no a ciegas.

---

## 7. Módulos de Fase 1

### 7.1 App móvil del vendedor
- Mapa de clientes y prospectos con filtros (vendedor, tipo de cliente, etapa, producto de interés, última compra, dormidos). **Debe igualar lo que hoy dan en Badger Maps.**
- Alta de prospecto con GPS, foto y validación de duplicados.
- Agenda del día: compromisos vencidos primero.
- Bitácora de interacciones con fotos.
- Pipeline visual de sus oportunidades.
- Lista de precios vigente consultable, para armar solicitudes sin adivinar.
- Solicitud de cotización y seguimiento de su estado.
- Consulta de estado y fecha estimada de entrega de sus pedidos.
- **Modo offline con sincronización posterior** — indispensable en el interior, donde se pierde señal y las fotos pesan.

### 7.2 Módulo de oficina / administración
- Bandeja de solicitudes de cotización pendientes de emitir.
- Enlace de número de cotización de Zoho a la solicitud.
- Bandeja de prospectos ganados pendientes de alta como cliente.
- Atribución manual de facturas sin vendedor identificado.
- Alimentación del estado de pedidos y fechas de entrega (desde SGP).

### 7.3 Módulo de gerencia
- **Tablero en vivo**, que abre con una franja de *"Requiere tu atención"* antes de los números: compromisos vencidos, prospectos estancados, cotizaciones sin respuesta, vendedores sin actividad hoy, solicitudes de precio pendientes. Como no habrá alertas push ni resumen diario, esta franja cumple esa función.
- Bandeja de aprobación de precios especiales.
- Ventas en vivo por vendedor, contra meta.
- Tasa de cierre por vendedor, por zona y por producto.
- Tiempo promedio del ciclo: creación → cotización → cierre.
- Mapa de cobertura con zonas en desarrollo.

### 7.4 Módulo de planificación y búsqueda de prospectos

La empresa no hace ferias ni exhibiciones: **los vendedores tienen que encontrar sus propios prospectos**. Hoy lo hacen consultando directorios por fuera de la herramienta. Este módulo trae esa búsqueda adentro.

**Flujo:**

1. El vendedor define un **área** y unas **categorías**.
   - Interior: poblados completos cercanos a la Interamericana (ej. Aguadulce).
   - Ciudad: corredor o vía específica (ej. Calle 50) → restaurantes, farmacias, pulperías.
   - Ruta: barrio o sector (ej. Las Garzas) → supermercados, minisúper, farmacias, panaderías.
   - **Líder / cuentas clave:** búsqueda por marca sin restricción geográfica (ej. bancos), con sucursales agrupadas.
2. El sistema devuelve la lista con **semáforo de estado**: nuevo / ya es cliente (con fecha de última compra) / prospecto de otro vendedor / ya visitado (con fecha y resultado de la última visita).
3. El vendedor **selecciona** los que le interesan y **descarta con motivo** los que no.
4. Se genera una **lista de trabajo ordenada por cercanía** desde su punto de partida, que se convierte en su plan del día o de la gira.

> No se requiere optimización de rutas visual tipo Badger Maps. Ordenar por proximidad resuelve la mayor parte del valor a una fracción del costo.

**Fuente de datos:** Google Places API (New) — Text Search y Nearby Search por categoría.
- Límites: máximo 60 resultados por búsqueda (20 × 3 páginas) y radio máximo de 50 km. Para vías urbanas hay que trocear la búsqueda por categoría.
- Costo: ~$32 por 1.000 llamadas en el tramo Pro; ~$35 si se incluyen teléfono, horarios y web. Con 3 vendedores × 10 búsquedas diarias ≈ $20/mes. **Establecer cuota por usuario en Google Cloud desde el día uno.**
- Complemento gratuito opcional: OpenStreetMap / Overpass, útil para precargar zonas antes de una gira sin señal.

**Restricción legal que condiciona la arquitectura (importante):** los términos de Google Maps Platform solo permiten almacenar indefinidamente el `place_id`; las coordenadas hasta 30 días; y nombres, teléfonos, reseñas o fotos **no** pueden guardarse en base de datos propia.

> **Patrón correcto:** los resultados de búsqueda son una **lista temporal**. Solo cuando el vendedor selecciona un candidato y lo convierte en prospecto, los datos se capturan o confirman como propios (él los verifica en la visita de todos modos). El `place_id` se guarda como llave silenciosa — es lo que permite avisar "ya visitaste este punto el 14 de marzo" o "esto ya es cliente de la casa" sin incumplir los términos.

**Higiene de datos:** los directorios traen ruido y locales cerrados. El vendedor debe poder marcar *"no existe / cerrado"* y que esa corrección quede visible para todo el equipo.

---

### 7.5 Calificación de prospectos (capa de inteligencia)

**El problema que resuelve:** la empresa es fábrica y busca volumen. Una panadería de pueblo que no compra un bulto en dos años y un minisúper de cinco cajas se ven idénticos en un mapa. Hoy esa distinción vive solo en la cabeza del vendedor que conoce el área, lo que genera fricción con gerencia: *"¿por qué no visitaste este punto?"*.

**Fuente principal — modelo de gemelos (dato propio, el más valioso):** con el histórico de facturación de Zoho se calcula el **consumo promedio real por tipo de comercio**. Ese número se muestra sobre cada prospecto nuevo del mismo perfil: *"panadería de barrio: tus clientes de este perfil compran en promedio X al mes"*. No depende de nadie y mejora con el tiempo.

**Señales externas útiles:**
- **Número de reseñas** en Google → mejor proxy gratuito de tráfico del local (400 reseñas ≠ 12).
- **Conteo de locales con el mismo nombre** → detecta cadenas y número aproximado de sucursales.
- **Categoría cruzada con la línea de producto** → restaurante pesa en antigrasa y bolsas; minisúper y farmacia pesan en rollos fiscales.
- *No usar*: la calificación en estrellas. Un restaurante de 4.8 puede ser diminuto.

**Panamá Emprende (consulta pública de Avisos de Operación):**
- **Alcance real:** el Aviso de Operación es obligatorio para toda actividad comercial o industrial en el país — no es un registro de comercios pequeños. Exceptuadas: actividades agropecuarias, artesanías de hasta 5 trabajadores, actividades sin fines de lucro, profesiones liberales y sedes de multinacionales. Además, establecimientos con licencia vigente antes de 2007 quedaron exentos, por lo que negocios muy antiguos pueden no aparecer.
- **Lo que sí aporta:** confirmar formalidad, **capturar el RUC antes de la visita** (sin RUC no hay facturación) y **detectar aperturas nuevas** por provincia y actividad → leads frescos antes que la competencia.
- **Lo que NO aporta:** tamaño, volumen ni capacidad de compra. **No es fuente de calificación de volumen.** Esa proviene exclusivamente de la facturación propia en Zoho (modelo de gemelos).

**Captura rápida del vendedor en sitio** (30 segundos, alimenta el modelo):
- Número de cajas registradoras → proxy directo del consumo de rollos fiscales.
- Tráfico observado, tamaño del local, proveedor actual y frecuencia estimada de compra.

**Puntaje de potencial (1 a 5)** combinando modelo de gemelos + señales externas + captura en sitio, que ordena la lista de búsqueda en lugar de entregar 60 nombres planos.

**Umbral mínimo de volumen.** Definir explícitamente el piso de pedido que justifica atender un cliente. Lo que no lo alcanza se marca en gris, no desaparece.

**Descarte con motivo.** El vendedor puede descartar un punto **sin visitarlo**, justificando ("panadería muy pequeña, no alcanza pedido mínimo"). Esto convierte su conocimiento local en dato del sistema, elimina la pregunta de gerencia, y permite auditar después si el criterio fue correcto.

**Calificación por clúster (vendedor del interior).** En el interior se califica la **ruta, no el punto**: un poblado con doce comercios pequeños puede justificar la parada aunque ninguno califique por separado. El sistema suma el potencial estimado del clúster y lo compara contra el costo de llegar.

### 7.6 Inteligencia comercial (dashboard gerencial sobre datos de Zoho)

Módulo de **solo lectura** sobre la facturación de Zoho. No depende de la adopción de los vendedores —los datos ya existen—, por lo que es probablemente el de retorno más rápido. Amplía el alcance del proyecto: ya no es solo gestión de la fuerza de ventas, sino visión completa de la venta de la empresa, incluyendo los **clientes de casa** que atiende la oficina.

**Preguntas que debe responder:**
- ¿Cuánto vende la casa y cuánto genera cada vendedor? (venta por canal)
- ¿Cuánto se vende en el interior vs. ciudad de Panamá vs. Panamá Oeste? (venta por geografía)
- ¿Quién compra rollos fiscales, quién bolsas, quién tubos de cartón, quién hojas antigrasa? (venta por línea de producto)
- ¿Cuál es el mix de productos por cliente y por zona?
- ¿Qué concentración tengo? (top 10 clientes como % de la venta total)
- ¿Cuántos clientes nuevos vs. recurrentes por mes?

**Modelo dimensional:** cliente × producto × tiempo × canal × geografía.

**Prerrequisito crítico — reconciliación e higiene de datos en Zoho.** El 80% del esfuerzo de este módulo no es programación, es normalización. Son **dos fuentes distintas** (Zoho CRM y Zoho Books) que hay que casar antes de medir nada.

*Paso 1 — Reconciliación CRM ↔ Books.* Produce cuatro grupos, todos informativos:
- En ambos y bien enlazados → universo sano.
- En CRM sin contraparte en Books → nunca compraron, o el enlace se rompió.
- **En Books sin cuenta en CRM → clientes que facturan sin que nadie les dé seguimiento.** Hallazgo de alto valor.
- Duplicados → mismo negocio con dos fichas (variaciones de nombre, RUC mal escrito).

*Paso 2 — Clasificación de actividad (automática, no manual).* Se calcula desde la facturación, no se revisa a mano: activo (facturas en los últimos 6 meses), dormido, muerto (sin facturas en 24 meses), fantasma (nunca facturó).

*Paso 3 — Enriquecimiento manual, solo sobre los activos.* Los campos que no se pueden deducir:
- Maestro de clientes: **canal** (casa / vendedor específico), **provincia y distrito**, **tipo de comercio**.
- Maestro de productos: **línea de producto** asignada a cada SKU.

> **Dónde viven los campos de clasificación:** en Zoho CRM, porque es donde la persona de oficina trabaja a diario y por tanto es lo único que se mantendrá actualizado. Un campo que vive donde nadie entra se desactualiza en tres meses.

> Sin esta depuración previa, el tablero mostrará una categoría dominante llamada "sin clasificar".

**Insumos para la depuración (exportaciones):** (1) Accounts de Zoho CRM con todos sus campos; (2) maestro de clientes de Zoho Books con RUC y vendedor; (3) facturación de 24–36 meses **con detalle de línea** — cliente, fecha, producto, cantidad, monto. La depuración se ejecuta como proyecto aparte; su salida es el archivo limpio y el **diccionario de campos** que alimenta este módulo.

**Venta cruzada — el hallazgo de mayor valor.** El cruce cliente × línea de producto identifica automáticamente quién compra una línea y no las demás (ej. compra rollos fiscales pero no bolsas). Esa lista **no se queda en el tablero: baja como lista de trabajo a la app de campo del vendedor asignado.** Es el punto donde los dos módulos se cierran entre sí.

**Economía de esfuerzo:** el consumo promedio por tipo de comercio que produce este módulo es exactamente el insumo del modelo de gemelos de §7.5. Se construye una vez y sirve dos veces.

### 7.7 Reposición predictiva, muestras e inteligencia de competencia

Tres capacidades específicas de la venta de consumibles de papel, aprobadas para Fase 1.

**Reposición predictiva.** La empresa vende consumibles con ciclo de recompra predecible. A partir de la facturación de Books se calcula la **frecuencia y volumen típico de cada cliente** (ej. 10 bultos cada 45 días) y el sistema avisa al vendedor **antes** de que el cliente se quede sin producto — no después.

- Alerta al vendedor asignado unos días antes del ciclo estimado, con el producto y la cantidad habitual.
- Se recalcula solo con cada nueva factura; no requiere captura del vendedor.
- Es la palanca más barata para subir frecuencia: el dato ya existe. Si el cliente se queda sin producto, llama a la competencia.

**Trazabilidad de muestras.** En esta industria la muestra es la herramienta de cierre principal y tiene costo real.

- Registrar muestra entregada: producto, cantidad, cliente/prospecto, fecha.
- Vincularla al desenlace: ¿cerró o no cerró?
- Métrica de gerencia: **tasa de conversión de muestras por vendedor**. Identifica quién las usa para cerrar y quién las está regalando.

**Inteligencia de competencia.** Dos campos en el registro de visita, de captura casi instantánea:

- **Proveedor actual** del prospecto o cliente.
- **Precio de referencia** que está pagando hoy.

> En seis meses esto produce el mapa de quién domina cada zona y a qué precio — información que no se puede comprar y que solo se obtiene acumulando visitas. Capturarla desde el día uno; su valor es acumulativo.

### 7.8 Colaboración y consultas internas

**Problema que resuelve:** hoy las consultas de los vendedores ("el cliente me pide descuento, ¿qué hago?", "¿cómo levanto esta propuesta?") ocurren por WhatsApp, en un canal paralelo y suelto. El criterio, el contexto y las instrucciones de gerencia se pierden y no quedan en el expediente del cliente.

**No es un módulo de mensajería.** Se implementa como **hilos de comentarios anclados al registro**, no como una bandeja de chat separada — eso solo recrearía WhatsApp dentro del CRM. El "dashboard de comunicación" de gerencia es simplemente una **vista filtrada de los hilos que esperan respuesta**.

**Dónde se ancla:**
- **Prospecto / oportunidad** — el caso principal: es el expediente del cliente.
- **Plan o gira** — donde el líder deja guías generales de planificación al equipo.
- **Visita puntual** — contexto sobre algo ocurrido en sitio.

**Participantes:** vendedor ↔ líder ↔ gerente. El vendedor del interior consulta al líder; el líder o el gerente responden; todo queda en el expediente.

**Regla crítica — comentario vs. decisión:**

> Si la respuesta **cambia algo** (precio, asignación, condición comercial) **va por el flujo estructurado**, no por comentario. Un descuento aprobado dentro de un hilo de chat queda enterrado en una conversación: no se puede consultar, auditar ni sumar.
> Si es **contexto, criterio o instrucción** ("cómo abordar a este cliente", "contacta a esta otra persona"), va por comentario.
> Desde el hilo, el gerente debe poder **convertir su respuesta en una aprobación formal con un toque**, sin salir de la conversación.

**Estado de consulta abierta.** Un comentario puede marcarse como *requiere respuesta*. Mientras esté abierto aparece en la franja **"Requiere tu atención"** del tablero gerencial (§7.3) y se cierra al ser respondido. Sin este estado, el módulo degenera en un muro que nadie lee.

**Notificaciones push para menciones dirigidas** — excepción justificada a la decisión de no usar alertas. Si el vendedor pregunta desde un local y la respuesta llega solo cuando gerencia entra al sistema, la consulta vuelve a WhatsApp ese mismo día. WhatsApp gana por velocidad; la única forma de competirle es igualar el tiempo de respuesta.

**Trazabilidad:** los comentarios son bitácora, no chat. No se borran, y toda edición queda registrada. Permanecen en el expediente del cliente aunque cambie el vendedor asignado.

### 7.9 Inteligencia de cuentas de grupo (fuentes públicas panameñas)

**Problema que resuelve:** un almacén en un mall opera bajo una marca, pero pertenece a un grupo comercial con razón social distinta y oficinas en otro lugar. Quien decide la compra no está en la tienda. Sin esta capa, el vendedor negocia con un encargado de local que no tiene autoridad para comprar.

**Usuario:** el líder de ventas con sus cuentas clave, y gerencia. **No** es prospección de calle: el vendedor de ruta no usa este módulo.

**La cadena de investigación:**

1. **Marca observada en el punto** → consulta en **DIGERPI** (`consulta.digerpi.gob.pa`), búsqueda por titular → arroja la sociedad propietaria de la marca.
2. **Sociedad** → **Registro Público** (`rp.gob.pa` / Panamá Digital, cuenta gratuita) → directores, dignatarios, representante legal y domicilio legal, que suele ser la oficina central.
3. **Directores** → búsqueda inversa: en qué otras sociedades figuran → **se desdobla el grupo completo** y aparecen las demás marcas que también le pertenecen.
4. **Resultado:** una cuenta de grupo con sus locales asociados, en lugar de N prospectos sueltos.

**Fuentes públicas y gratuitas:**

| Fuente | Qué aporta |
|---|---|
| **DIGERPI** | Marca → titular. *Nota: el sitio advierte actualización hasta feb-2022; sirve para marcas establecidas, no recientes* |
| **Registro Público** | Sociedades, directores, dignatarios, domicilio legal. Consulta con cuenta gratuita; solo se paga el certificado formal |
| **Panamá Emprende** | Avisos de operación, RUC, aperturas nuevas |
| **PanamáCompra** | Si el grupo vende al Estado: representante legal y datos de contacto |
| **Gaceta Oficial** | Fusiones, cambios societarios, disoluciones |
| **Superintendencia del Mercado de Valores** | Grupos que emiten bonos: organigrama, subsidiarias y ejecutivos con nombre |

**Datos de aduanas (evaluar).** Las importaciones revelan si un grupo importa directamente bolsas o rollos, en qué volumen y por cuál puerto. Califica un prospecto mejor que cualquier estimación y muestra a la competencia. Disponible por informe puntual sin suscripción.

**Panadata (evaluar en su momento).** Agrega todas las fuentes anteriores con exportación a Excel y API, por suscripción mensual de costo significativo. *Decisión tomada: no integrar por API en Fase 1.* Si se adopta, tratarlo como **proyecto acotado** — suscribir uno o dos meses, exportar el mapa completo de grupos, marcas y directores, cargarlo al SGV y cancelar. Antes de suscribir, verificar en demo qué tan poblado está el cruce marca–sociedad–director en comercio minorista panameño.

**Modelo de datos que habilita:**
- Entidad **grupo comercial**: razón social, RUC, domicilio de oficina central, marcas asociadas, locales asociados.
- Un prospecto o cliente puede pertenecer a un grupo. Las cuentas de grupo se atienden desde la oficina central, no local por local.

**Alcance y trato de la información:**

> Esto es **investigación comercial con fuentes públicas**, la práctica normal de cualquier área de ventas B2B. Los nombres y cargos obtenidos se registran en el **expediente de la empresa**, no como fichas personales de individuos que no son clientes.

**Fase:** posterior al núcleo de campo. Arrancar como proceso manual del líder alimentando fichas de grupo; automatizar solo si el volumen lo justifica.

---

## 8. Prioridades de negocio (definen qué mide el tablero)

En orden de peso:

1. **Abrir clientes nuevos** ← motor principal
2. **Reactivar clientes dormidos** ← volumen rápido, dato ya disponible en Zoho
3. Subir frecuencia y monto de clientes activos
4. Abrir zonas sin cobertura: **Panamá Este / Pacora** y **norte de Colón**

Los KPI no pueden ser iguales para los tres vendedores:

- **Líder / cuentas clave** → monto cerrado, retención, crecimiento por cuenta.
- **Vendedor de campo** → puntos nuevos visitados, tasa de conversión, clientes abiertos.
- **Vendedor del interior** → el ciclo es por gira, no por día: cobertura de distritos por gira, clientes abiertos por gira, costo/rendimiento del recorrido.

---

## 9. Integraciones

**Zoho (lectura):** maestro de clientes, historial de facturación con vendedor atribuido, estado de cotizaciones. También alimenta el modelo de gemelos para calificar prospectos.
**Zoho (escritura):** ninguna en Fase 1 — administración crea manualmente y enlaza. Reduce el riesgo de ensuciar la contabilidad.
**SGP (lectura):** estado del pedido y fecha estimada de entrega.
**Google Places API (New):** búsqueda de prospectos por área y categoría. Sujeta a las restricciones de almacenamiento descritas en §7.4.
**Panamá Emprende:** verificación de formalidad, captura de RUC y monitoreo de negocios recién abiertos.

> **Decisión de arquitectura:** el SGP debe exponer una consulta de estado de pedidos. Conviene definirla ahora para no construir dos veces la misma lógica.

---

## 10. Requisitos no funcionales

- Móvil primero (uso en la calle, una mano, con prisa). Escritorio para oficina y gerencia.
- Offline con cola de sincronización y compresión de fotos.
- GPS obligatorio para check-in; registrar precisión de la lectura.
- Español, zona horaria de Panamá, moneda USD.
- Bitácora de auditoría en cambios sensibles: reasignaciones, umbrales, precios, ediciones de plan.

---

## 11. Fase 2 (fuera de este alcance, ya identificado)

- **Fecha de entrega predictiva** según carga real de producción del SGP, para que el vendedor responda en el momento "¿para cuándo tienes mi pedido?". Alto valor comercial, alta complejidad.
- **Traspaso de cartera a oficina**: hoy el vendedor que gana un cliente le da seguimiento transaccional él mismo. La intención es liberarlo para que se dedique solo a abrir clientes nuevos y mantener la relación, dejando el seguimiento de compra a la oficina. El modelo de datos debe contemplar desde ya el cambio de propietario de la cuenta.
- Creación automática de la cotización en Zoho, una vez que el flujo manual demuestre estabilidad.
- Cálculo de comisiones.

**Diferidos por decisión de gerencia** (evaluados y descartados para Fase 1, no omisiones — el diseño no debe impedirlos después):

- **Crédito y cobranza.** Límite de crédito, mora y medición del vendedor por cobrado y no solo por facturado. Ya existe control interno sobre esto. *Excepción de bajo costo: mostrar saldo vencido en la ficha del cliente, ya que el dato viaja en la misma lectura de Books.*
- **Ciclo de producto impreso a medida** (aprobación de arte, cliché, cantidad mínima, tiempo de entrega extendido). Los vendedores ya dominan cómo ofrecerlo.
- **Flete y pedido mínimo por zona / rentabilidad por zona.** Cubierto hoy por políticas internas para entregas lejanas.

---

## 12. Riesgos y decisiones pendientes

| Punto | Estado |
|---|---|
| Comisiones y cómo se les paga | No definido — puede afectar la atribución de ventas |
| ¿La cotización se envía al prospecto desde la app o sigue por correo del vendedor? | No confirmado |
| Rango permitido de ajuste del umbral de dormido | Por definir |
| Catálogo cerrado de "resultado de visita" y de "motivo de pérdida" | Por definir con los vendedores |
| Metas numéricas por vendedor | Por definir |
| Resistencia al registro en campo | Riesgo real: si la captura no baja de 30 segundos, no se usa |
| Umbral de pedido mínimo que justifica atender un cliente | Por definir — condiciona toda la calificación |
| Consumo promedio por tipo de comercio | Extraer de Zoho antes de programar el modelo de gemelos |
| Costo y cuota de Google Places | Configurar límite por usuario antes de liberar el módulo |
| Disponibilidad técnica de consulta a Panamá Emprende | Verificar si hay API o si requiere consulta asistida |
| Higiene del maestro de clientes y productos en Zoho | Bloqueante para el módulo 7.6 — auditar antes de programar |

---

## 13. Siguiente acción recomendada

Construir primero el **núcleo de campo**: alta de prospecto con GPS y foto, bitácora, compromisos con fecha, y mapa con filtros. Es lo que hoy no existe y lo que sostiene todo lo demás. Ponerlo en manos de un solo vendedor durante dos semanas antes de agregar cotizaciones e integraciones.

Luego el **módulo de búsqueda y calificación de prospectos** (§7.4 y §7.5), que es el de mayor valor percibido por el vendedor — pero solo tiene sentido después del núcleo, porque sin bitácora no tiene contra qué comparar ni con qué avisar "ya visitaste esto".

La integración con Zoho y el módulo de oficina vienen después, cuando ya haya datos reales entrando.

**Orden sugerido:** núcleo de campo → inteligencia comercial (§7.6, en paralelo: no depende de adopción) → búsqueda y calificación → cotizaciones y aprobaciones → lectura de Zoho y SGP → tablero de gerencia.

---

## 14. Identidad y nomenclatura

**Nombre del sistema:** SGV — Sistema de Gestión de Ventas. Hace pareja con el SGP y se explica solo dentro de la empresa.

**Slug único `sgv` en todas las plataformas:**

| Plataforma | Nombre |
|---|---|
| GitHub | `sgv` |
| Vercel | `sgv` (producción), previews automáticos por rama |
| Supabase | `sgv-dev` y `sgv-prod` (**dos proyectos separados desde el día uno**) |

Convención de ramas: `main` (producción), `dev` (integración), `feat/<módulo>` para trabajo.

---

## 15. Especificación maestra (master file)

Igual que en el SGP: documentación viva que da contexto completo a Claude Code y termina siendo la documentación final del sistema.

**Estructura en el repo:**

```
CLAUDE.md                    ← punto de entrada; reglas y índice
/docs
  00-vision.md               ← este documento
  01-arquitectura.md         ← stack, entornos, integraciones
  02-modelo-datos.md         ← esquema, convenciones, diccionario de campos
  03-seguridad-rls.md        ← roles y políticas por tabla
  04-design-system.md        ← tokens y componentes (§17)
  05-modulos/                ← un archivo por módulo (7.1 … 7.8)
  06-decisiones.md           ← bitácora de decisiones: qué se decidió, cuándo y por qué
  07-estado.md               ← qué está hecho, qué está en curso, qué falta
```

**Reglas de mantenimiento:**
- `CLAUDE.md` se lee al inicio de cada sesión y apunta al resto.
- Toda decisión de diseño o arquitectura se registra en `06-decisiones.md` **en el momento**, con su justificación. Evita rediscutir lo mismo tres meses después.
- `07-estado.md` se actualiza al cerrar cada tarea. Es lo que permite retomar el trabajo sin releer todo.
- Ningún módulo se programa antes de que exista su archivo en `/docs/05-modulos/`.

---

## 16. Base de datos y seguridad desde el día uno

> **Lección del SGP:** allá se levantaron prototipos con datos de muestra y la base de datos y el RLS llegaron después, obligando a una depuración completa. **Esto no debe repetirse.**

**Las tres reglas que lo evitan:**

1. **Dos entornos de Supabase desde el inicio** (`sgv-dev`, `sgv-prod`). Nunca uno solo que después "se limpia".
2. **RLS activado en la misma migración que crea la tabla.** Ninguna tabla nace sin sus políticas, aunque esté vacía. *Deny by default*: sin política explícita, nadie ve nada.
3. **Los prototipos de pantalla consumen la base real de dev**, nunca arreglos de datos quemados en el código. Si la pantalla nace leyendo datos falsos, el esquema se diseña después y al revés.

**Convenciones obligatorias:**
- Migraciones versionadas en el repo. **Prohibido alterar el esquema desde el dashboard de Supabase** — si se toca por ahí, el repo deja de ser la verdad.
- `snake_case` en tablas y columnas; plural en tablas.
- **IDs UUID generados en el cliente.** Decisión forzada por el modo offline: el celular debe poder crear registros sin conexión. *Si esto se decide después, se rehace media base de datos.*
- Todas las tablas con `created_at`, `updated_at`, `created_by`.
- Borrado lógico (`deleted_at`), no borrado físico.
- Tabla de auditoría para cambios sensibles: reasignaciones, precios, umbrales, ediciones de plan.
- Fechas almacenadas en UTC, presentadas en `America/Panama`. Moneda USD. Idioma `es-PA`.

**Modelo de permisos (RLS):** tabla `profiles` con rol (`gerente`, `lider`, `vendedor`, `administracion`). Las políticas se escriben contra **rol + vendedor asignado**:
- `vendedor` → solo sus registros.
- `lider` → todo el equipo + su cartera.
- `gerente` → todo.
- `administracion` → bandejas de cotización, alta de clientes y pedidos.

**Sincronización offline:** cola local en el dispositivo, IDs generados en cliente, resolución por última escritura **con registro del conflicto** (no descartar silenciosamente). Fotos comprimidas en el cliente antes de subir, con tamaño máximo definido.

**Storage:** bucket de fotos con políticas propias, alineadas al mismo modelo de roles.

---

## 17. Sistema de diseño

**La restricción que manda no es estética, es física:** el vendedor usa el celular **a pleno sol, con una mano y con prisa**. De ahí se derivan contraste alto, áreas táctiles grandes (mínimo 44px) y poco texto por pantalla.

**Principio rector: el color significa estado, no decora.** Los colores saturados se reservan para el semáforo de estados; queda un solo acento de marca para las acciones primarias. Esto evita que el tablero se vuelva ilegible y da coherencia automática entre pantallas.

**Base heredada del SGP.** Ambos sistemas son de la misma empresa y deben reconocerse entre sí. Los valores provienen de la medición del código del SGP (`docs/design-tokens.md` de ese proyecto), no de una propuesta nueva.

| Rol | Token Tailwind | Hex | Uso |
|---|---|---|---|
| Marca / acción | `slate-800` | `#1D293D` | Barra lateral, botón principal, títulos |
| Fondo de pantalla | `slate-50` | `#F8FAFC` | Base |
| Borde por omisión | `slate-200` | `#E2E8F0` | Tarjetas, tablas, campos |
| Texto atenuado | `slate-400` | `#90A1B9` | Etiquetas, dato ausente |
| Texto secundario | `slate-500/600` | `#62748E` / `#45556C` | Descripciones y párrafo |
| **Activo en navegación** | `amber-500` | `#FE9A00` | Barra izquierda del ítem activo, subrayado de pestaña |
| Estado: advertencia / dormido | `amber` | `#FE9A00` | |
| Estado: conforme / ganado | `green-600` | `#00A63E` | |
| Estado: error / vencido / perdido | `red-600` | `#E7000B` | |
| Estado: informativo / en curso | `blue-600` | `#155DFC` | |

**Patrones de estado heredados:**
- Insignias: fondo `-100` con texto `-700`/`-800`.
- Franjas de aviso: fondo `-50`, borde `-200`, texto `-700`.
- `rounded-lg` como radio constante. Íconos `lucide-react` de 14 a 18px.

> **Regla del ámbar:** en el cromo (navegación, pestaña activa) significa identidad; en los datos significa riesgo o dormido. **Nunca como botón de acción** — esa función la toma el `slate-800`, para que no compitan.

Los estados **nunca dependen solo del color** — siempre acompañados de ícono o etiqueta (legibilidad bajo sol y accesibilidad).

**Tipografía:** una sola familia sans declarada explícitamente para toda la interfaz, más una monoespaciada para **identificadores y medidas** (números de orden, códigos, cantidades, montos). Esta última es la convención tipográfica más firme del SGP y aplica igual al SGV, que es mayormente cifras.

### 17.1 Deuda del SGP que el SGV NO debe repetir

Identificada al medir el código del SGP. Cada punto es una instrucción para Claude Code:

1. **Declarar todos los tokens como variables desde el día uno.** El SGP no tiene ninguna: cambiar el gris de los bordes exige reemplazar 1.120 apariciones a mano. En el SGV, ningún color, tamaño ni radio se escribe suelto en el JSX.
2. **Una sola tipografía, declarada una vez.** El SGP carga dos fuentes en cada página y las aplica en 36 lugares; el resto queda en Arial por una regla de `body`. Decidir y declarar, sin fuentes cargadas que no se usan.
3. **Un solo verde.** En el SGP conviven `green` y `emerald` para el mismo concepto.
4. **Componentes compartidos** de tarjeta, insignia, campo y tabla. Su ausencia en el SGP produjo ocho variantes distintas de campo de formulario.
5. **44px de alto táctil obligatorio en todo control.** En el SGP solo 5 variantes lo cumplen, y se usa de pie con una tableta. En la calle y con una mano, es innegociable.
6. **Un solo sistema de tamaños de texto** (no mezclar `text-[12px]` con `text-xs`).
7. **No heredar los acentos de sección** (índigo, púrpura, cian, violeta). En el SGV el color significa estado, no sección.

**Elemento firma — la "ficha de punto".** Un solo componente que representa a un cliente o prospecto y se ve **idéntico** en el mapa, en la lista de búsqueda, en el plan del día y en el expediente: nombre, tipo de comercio, semáforo de estado, potencial estimado y última interacción. Es lo que hace que todo el sistema se sienta uno solo.

**Dos densidades, un solo sistema de tokens:**
- **Campo (móvil):** una acción principal por pantalla, tarjetas grandes, mínimo texto.
- **Oficina y gerencia (escritorio):** tablas densas, filtros persistentes, comparativas.

**Estados obligatorios en toda pantalla:** cargando, vacío, error y **sin conexión**. El estado sin conexión debe indicar siempre qué quedó pendiente de sincronizar — el vendedor necesita saber que su trabajo no se perdió.

**Lenguaje de interfaz:** verbos en voz activa y consistentes de principio a fin. Si el botón dice "Guardar visita", la confirmación dice "Visita guardada". Nombres por lo que la persona reconoce, no por cómo está construido el sistema.
