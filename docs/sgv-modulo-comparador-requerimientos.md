# Módulo Comparador de Rendimiento — SGV

Documento de requerimientos. Versión 1.

---

## 1. Objetivo

Permitir que el vendedor demuestre, frente al cliente, que nuestro rollo térmico cuesta
menos por metro aunque la caja sea más cara — sin necesidad de que el cliente revele el
precio que paga hoy.

El módulo calcula en pantalla y genera un archivo Excel con fórmulas vivas que el cliente
recibe por WhatsApp o correo y llena por su cuenta, cuando el vendedor ya no está presente.

## 2. Usuario

- **Vendedor de calle**: lo usa desde el celular durante la visita. Es el usuario principal.
- **Líder del grupo**: ve los cálculos de todo el equipo.
- **Administración o producción**: mantiene el catálogo de metrajes de competencia.

## 3. Flujo paso a paso

1. El vendedor abre el módulo desde la ficha de un cliente o prospecto.
2. Anota la marca del rollo que usa el cliente. Si ya está en el catálogo de competencia,
   la selecciona; si no, la escribe y se da de alta automáticamente.
3. Captura los datos del cliente que este haya querido dar. Ninguno es obligatorio.
4. Escribe a mano precio por caja, rollos por caja y metros por rollo de nuestro producto.
5. Si hay datos suficientes, la pantalla muestra el resultado en vivo.
6. Genera el archivo Excel: nuestros datos llenos, los del cliente vacíos o parciales.
7. Lo comparte con el botón nativo del celular (WhatsApp, correo).
8. El SGV guarda el cálculo en la ficha del cliente y crea el próximo paso a 3 días,
   con fecha editable por el vendedor.

## 4. Inputs

**De nuestro producto** — escritos a mano por el vendedor:
- Precio por caja
- Rollos por caja
- Metros por rollo

**Del cliente** — todos opcionales:
- Precio que paga por caja
- Rollos por caja
- Metros por rollo
- Cajas que compra por pedido
- Cada cuántas semanas repite el pedido

**Competencia:**
- Marca, seleccionada del catálogo o escrita libre
- Metraje asociado, con estado `medido` o `sin medir`

## 5. Outputs

**En pantalla:** costo por metro de ambos, cuántas cajas nuestras equivalen a su pedido
actual, lo que paga hoy por ese pedido contra lo que pagaría con nosotros, ahorro por
pedido, y gasto anual de cada uno con su diferencia.

**Archivo `.xlsx`** con celdas de entrada resaltadas, fórmulas vivas y una nota al pie
explicando el cálculo en lenguaje simple.

**En la ficha del cliente:** fecha, vendedor, marca de competencia, datos usados, resultado
y copia del archivo enviado.

**Próximo paso** creado automáticamente a 3 días.

**Catálogo de competencia:** alta o actualización de la marca registrada.

## 6. Reglas principales

- El archivo siempre sale con nuestros campos llenos. Nunca se envía en blanco completo.
- Nunca se exige el precio de la competencia para poder generar el archivo. Esa es la razón
  de ser de la herramienta.
- Si el metraje de la competencia está `sin medir`, el archivo debe declararlo de forma
  visible. No se presenta como dato verificado lo que no lo es.
- El archivo se entrega en `.xlsx` con fórmulas activas, nunca en PDF ni con resultados fijos.
- **Un solo escenario: equiparar metros.** Se cotiza la cantidad de cajas nuestras que
  cubre exactamente los mismos metros que el cliente consume hoy, en el mismo tiempo y con
  la misma frecuencia de pedido. Ninguna cifra de la hoja puede salir más alta que la del
  cliente: un solo número mayor le da el argumento para cerrar la conversación.
- No se presentan escenarios alternativos en la hoja. Si un cliente pide comparar mantenien-
  do la misma cantidad de cajas, el vendedor lo calcula aparte, fuera de este documento.
- Toda división está protegida contra valores cero o vacíos.
- Lo que el cliente escriba en su copia del archivo nunca regresa al SGV. Es su información.

## 7. Excepciones y casos límite

- **El cliente no da ningún dato**: se envía la hoja con valores de ejemplo claramente
  marcados como tales.
- **Marca nueva**: se da de alta sin metraje, en estado `sin medir`.
- **Misma marca escrita distinto** por dos vendedores: hay que normalizar el nombre para
  evitar duplicados en el catálogo.
- **El cliente compra a más de un proveedor**: debe poder registrarse más de una marca.
- **Sin señal en la calle**: el módulo debe poder generar el archivo sin conexión y
  sincronizar el registro después.

## 8. Criterios de calidad

- El vendedor lo completa en menos de dos minutos, de pie, frente al comprador.
- El archivo abre correctamente en Excel de celular y en Google Sheets.
- El cliente entiende qué llenar sin que nadie se lo explique.
- Se puede consultar cuántas hojas se enviaron y cuántas terminaron en pedido.

## 9. Riesgos y decisiones pendientes

- **Precio escrito a mano.** El vendedor puede enviar un precio por debajo de lista en un
  documento que lleva el nombre de la empresa y queda por escrito en manos del cliente.
  Falta decidir si se valida contra lista de precios o si basta con que quede auditable.
- **El metraje sin medir es el punto débil de todo el argumento.** Si el cliente cuestiona
  la cifra y el vendedor no la puede sustentar, se pierde la conversación completa.
  La tabla de metrajes medidos es un prerrequisito, no un accesorio.
- **No hay forma de saber si el cliente abrió la hoja.** El seguimiento a 3 días es la única
  señal disponible.
- Falta definir si el módulo puede usarse sin un cliente o prospecto ya creado en el sistema.

## 10. Siguiente acción recomendada

Construir en tres etapas, en este orden:

1. Generador del archivo Excel, tomando como base la plantilla ya elaborada.
2. Pantalla de captura y cálculo en vivo.
3. Catálogo de competencia, registro en la ficha del cliente y creación del próximo paso.

---

## Anexo — Fórmulas

Con `c` = datos del cliente y `n` = datos nuestros:

Con `c` = datos del cliente y `n` = datos nuestros.

**El dato de fondo**

```
metros_caja_cliente   = c.rollos_caja * c.metros_rollo
metros_caja_nuestro   = n.rollos_caja * n.metros_rollo
metros_pedido         = c.cajas_pedido * metros_caja_cliente

costo_metro_cliente   = c.precio_caja / metros_caja_cliente
costo_metro_nuestro   = n.precio_caja / metros_caja_nuestro
```

**La propuesta** — se redondea hacia arriba porque no se venden cajas partidas.

```
cajas_equivalentes    = REDONDEAR_ARRIBA(metros_pedido / metros_caja_nuestro)

duracion_propuesta    = (cajas_equivalentes * metros_caja_nuestro)
                        / (metros_pedido / c.semanas_duracion)
duracion_actual       = c.semanas_duracion

costo_pedido_actual   = c.cajas_pedido * c.precio_caja
costo_pedido_nuestro  = cajas_equivalentes * n.precio_caja
ahorro_por_pedido     = costo_pedido_actual - costo_pedido_nuestro
```

**En el año** — calculado sobre la propuesta, con la misma frecuencia de pedido.

```
pedidos_ano           = 52 / c.semanas_duracion
metros_ano            = metros_pedido * pedidos_ano

gasto_ano_actual      = costo_pedido_actual * pedidos_ano
gasto_ano_nuestro     = costo_pedido_nuestro * pedidos_ano
diferencia_ano        = gasto_ano_actual - gasto_ano_nuestro
```

Toda división devuelve vacío si el denominador es cero o el dato falta.

`duracion_propuesta` debe dar prácticamente igual a `duracion_actual`. Es una comprobación,
no un argumento de venta: sirve para que el cliente vea que no se le está recortando papel.
Si las dos cifras se separan de forma notoria, hay un dato mal capturado.
