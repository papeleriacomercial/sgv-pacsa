# Módulo Cierre por Excepción — SGV

Documento de requerimientos. Versión 1. **Parte I: el proceso.** Sin acordar.

Reemplaza las tres preguntas fijas del cierre semanal (§7.1) por preguntas que nacen de lo que
los números ya dicen.

---

## 1. Por qué se cambia

El cierre semanal pregunta hoy tres cosas fijas: **¿qué te sorprendió?**, **¿qué te frenó?** y
**¿qué necesitas de nosotros?**

Las tres primeras semanas de uso real dicen que dos de las tres no funcionan:

| | Christopher 24-ago | Christopher 31-ago | Javier 31-ago |
|---|---|---|---|
| Sorprendió | «Potencial para 57mm» | «sin sorpresa por el momento» | «nada» |
| Frenó | «Nada» | «Nada por el momento» | «el viernes 4 hice la mensajería» |
| Necesitas | «De momento no se necesita» | «Reintegrar el rollo 80mm × 80m #55 a la lista de precios» | «herramientas» |

Lo vio el usuario el 4 de septiembre de 2026: *«ya esto van a decir, hice mensajería y no escriben
más nada; vamos a estar más en pelea en que expándeme esto, te estás quedando corto»*.

**El diagnóstico no es la redacción, es que se pregunta en blanco.** Cuatro cosas:

**Se pueden contestar con «nada», y por eso se contestan «nada».** La tercera no admite esa salida
—pedir algo tiene premio— y es la única que produjo respuestas reales. No es falta de colaboración:
la pregunta les dio permiso.

**«Sorprendió» pregunta por una emoción.** Antes de contestar hay que decidir qué califica como
sorpresa, y ante la duda lo seguro es que nada califique.

**Preguntan por la semana entera, sin ancla.** Cinco días y veinte interacciones no se recuerdan en
bloque.

**Y se preguntan en blanco cuando el sistema ya sabe qué pasó.** Christopher escribió *«nada me
frenó»* la semana en que su plan quedó en cero visitas. Javier contestó a *«¿qué te frenó?»* con
*«el viernes 4 hice la mensajería»* — no leyó una pregunta sobre obstáculos, leyó una casilla y puso
lo que se acordaba.

---

## 2. Qué se conserva y qué se va

| Pregunta | Qué pasa | Por qué |
|---|---|---|
| **¿Qué necesitas de nosotros?** | **Se queda, sin tocar** | No es una pregunta de reflexión: es **el canal hacia arriba**. Y sobre todo, **ningún dato la puede sustituir** — ninguna excepción va a descubrir sola que falta un producto en la lista de precios |
| ¿Qué te frenó? | Se va | **La excepción *es* el freno.** Preguntarle qué lo frenó cuando ya sabemos que planificó 25 y registró 8 es pedirle que descubra lo que nosotros ya vimos |
| ¿Qué te sorprendió? | Se va | Buscaba señal de mercado, y **eso ya se captura en el seguimiento, en el momento en que pasa**: proveedor actual, precio de referencia, por qué le compra al otro. Preguntarlo el viernes es pedirle que se acuerde de lo que escribió el martes |

---

## 3. El principio

**Se deja de preguntar y se empieza a reclamar.** El sistema mira los números de la semana,
encuentra lo que se salió de lo normal, y pregunta **por eso concreto**. El hecho va escrito dentro
de la pregunta, así que «nada» deja de ser una respuesta posible.

Y **no se pregunta lo que ya sabemos.** Si el vendedor registró dos días perdidos en Jornadas, con
su motivo, eso ya está guardado: la pregunta descuenta esos días y pregunta por el resto. Hacerlo
escribir dos veces lo mismo es lo que hace que la gente deje de llenar formularios.

### Una tiene que ser la buena

**Si todas las preguntas nacen de lo que salió mal, el cierre se vuelve un interrogatorio**, y a la
tercera semana el vendedor contesta para salir del paso — volvemos al punto de partida por otro
camino.

Por eso el mismo motor que ve *«planificaste 25 e hiciste 8»* tiene que ver *«verificaste 17 de 18,
tu mejor semana»*, y ahí la pregunta es **«¿qué hiciste distinto?»**. No es adorno: es de donde sale
lo que hay que copiarle a uno para enseñárselo a los demás, y es lo único que evita que la pantalla
se sienta una auditoría.

---

## 4. Usuario

- **Vendedor de calle**: contesta el viernes desde el celular. Usuario principal.
- **Líder**: lee las razones al responder el cierre de su equipo. No las escribe.
- **Gerencia**: lo mismo con el líder, y es quien decide qué causas se ofrecen.

---

## 5. Flujo paso a paso

El paso 2 de 4 del cierre semanal cambia. Los pasos 1, 3 y 4 quedan igual.

1. El vendedor termina el paso 1 (sus números, que sólo mira).
2. **El sistema calcula las excepciones de su semana** con las reglas de §6.
3. Se le muestran **de una a tres**, la más grande primero, y **al menos una positiva cuando la
   haya**.
4. Cada excepción trae **su hecho escrito**, **lo que ya sabemos que lo explica**, y **una lista
   corta de causas para tocar**.
5. Escoge una o varias causas. Puede agregar texto en **«Otra cosa»**, que siempre está.
6. Al final, **«¿Qué necesitas de nosotros?»**, igual que hoy.
7. Sigue al paso 3 (el plan de la semana entrante) sin cambios.

**Semana sin excepciones: una sola pregunta.** Una semana limpia se premia con menos trabajo, y que
no haya nada que preguntar también es información.

### Cómo se ve una

> **Planificaste 25 visitas y registraste 8.**
>
> Ya sabemos que perdiste 2 días: *entrega urgente imprevista* y *administrativo*. Eso explica
> unas 10.
>
> **¿Qué pasó con las otras 7?**
>
> `Salí tarde` · `Se me alargó una visita` · `Locales cerrados` · `El plan era muy ambicioso` ·
> `Anduve pero no lo registré` · `Otra cosa →`

---

## 6. Las excepciones

Todas salen de datos que **ya existen**. Ninguna necesita que el vendedor capture algo nuevo.

| # | Excepción | Se dispara cuando | De dónde sale | La pregunta |
|---|---|---|---|---|
| E-1 | **No cumplió su plan** | Lo planificado supera lo registrado por un margen | `cierres.plan` de la semana anterior contra `seguimientos` de esta | «Planificaste N y registraste M. ¿Qué pasó con las que faltaron?» |
| E-2 | **Visitas sin verificar** | El porcentaje de verificadas cae del umbral | `numeros.visitas` y `numeros.verificadas` | «De N visitas, M quedaron sin verificar. ¿Qué pasó?» |
| E-3 | **Compromisos vencidos** | Pasa del umbral | `numeros.compromisosVencidos` | «Tienes N compromisos vencidos. ¿Qué está pasando con esas cuentas?» |
| E-4 | **Cartera enfriándose** | Suben las cuentas fuera de cadencia | `numeros.fueraDeCadencia` | «N clientes tuyos llevan más de lo debido sin que los toques.» |
| E-5 | **Venta por debajo de lo suyo** | La facturación de la semana cae contra su propio promedio | `transacciones_zoho` por `perfil_id` y `fecha` | «Facturaste N, contra un promedio tuyo de M. ¿Qué pasó?» |
| E-6 | **La buena** | Su mejor número del período en cualquiera de las anteriores | las mismas fuentes | «Esta semana N. ¿Qué hiciste distinto?» |

**Los umbrales no se fijan en este documento.** Se acuerdan con el usuario antes de construir, y son
la diferencia entre una pantalla que señala lo que importa y una que grita todas las semanas —
*«una comprobación que grita cincuenta veces es peor que no tenerla: se apaga y se olvida»*.

**El tope son tres.** Una semana mala puede disparar las cinco, y cinco reclamos seguidos es
exactamente el interrogatorio que se quiere evitar.

---

## 7. Las causas

### Se escogen, no se escriben

Con texto libre volvemos a *«hice mensajería»*. Las causas se tocan: una mano, sin teclado, sin
pensar cómo redactarlo.

### Se puede escoger más de una

«Salí tarde» y «locales cerrados» pueden ser las dos. **Forzar una sola produce la más
presentable**, que no es la más cierta. *(A confirmar con el usuario.)*

### «Otra cosa» siempre está, y lo que se escriba ahí se guarda

**Es la materia prima de la revisión.** Sin guardar el texto libre no hay con qué afinar la lista
después, y la afinación es el mecanismo entero.

### De dónde sale la primera lista

**No de mi cabeza.** Con tres cierres no hay evidencia, y una lista inventada es peor que el texto
libre: el vendedor escoge la opción más cercana y nos deja creyendo que entendimos.

Sale de vocabulario que **ya es de ellos** y ya está en el sistema:

- Los motivos de jornada perdida: *viaje por mercancía, entrega a clientes, entrega urgente
  imprevista, no se pudo salir, administrativo, personal o incapacidad*.
- Los resultados de visita: *local cerrado o no existe, no estaba el encargado*.

Más las que faltan y hay que nombrar. **Entre ellas, obligatoria: «anduve pero no lo registré».** Es
la causa más probable del arranque y la que más nos importa saber — y si no está en la lista, nadie
la va a escribir a mano.

### Cómo se afinan — decisión del usuario, 4 de septiembre de 2026

**No se automatiza nada.** Ni el orden por frecuencia, ni ascender solo lo que se escribe a mano.
*«Yo me encargaré de regresar aquí contigo y reevaluar qué está pasando y afinar la presentación de
estas opciones. No automaticemos nada, revisaremos en la medida que vamos avanzando»*.

La razón de fondo es buena y conviene dejarla escrita: **la lista de opciones decide lo que te van a
reportar.** Lo que esté ahí es lo que van a contestar. Eso es una decisión de negocio, no un
promedio.

Entonces la afinación es una conversación: a las semanas que él decida, se mira qué escribieron en
«Otra cosa», qué opción no escogió nadie, y se ajusta la lista. **Ese repaso es parte del diseño, no
un pendiente.**

**Consecuencia asumida:** cambiar la lista pasa por una versión de la aplicación. Se descartó la
pantalla de administración de causas justamente para no automatizar; si con el uso resulta que se
cambia seguido, se vuelve a evaluar.

---

## 8. Reglas principales

- **R-1.** Una excepción **siempre trae su hecho en la pregunta**. Nunca «¿qué te frenó?» a secas.
- **R-2.** **No se pregunta lo que el sistema ya sabe.** Los días perdidos ya registrados se
  descuentan y se muestran, no se vuelven a pedir.
- **R-3.** **Máximo tres por semana**, la más grande primero.
- **R-4.** **Al menos una positiva cuando la haya.**
- **R-5.** **Ninguna es obligatoria.** No se traba el envío del cierre por una razón sin contestar.
  Se puede insistir una vez; trabar convierte la respuesta en un trámite. *(A confirmar.)*
- **R-6.** Las razones son **del vendedor**, como el plan. El líder las lee y no las edita — el mismo
  trigger que protege el plan las protege.
- **R-7.** Se **congelan con la semana**, igual que los números: lo que se contestó en agosto tiene
  que seguir diciendo lo mismo en diciembre.

---

## 9. Excepciones y casos límite

- **Vendedor nuevo, sin historia.** E-5 (venta contra su promedio) y E-6 (su mejor número) no tienen
  contra qué comparar. No se disparan hasta tener suficientes semanas — **cuántas, se acuerda**.
- **Semana con feriado o vacaciones.** Comparar contra un promedio de semanas completas es injusto.
  Las jornadas ya lo registran; hay que decidir si se ajusta el umbral o se calla la excepción.
- **No cerró la semana anterior.** Sin plan previo, E-1 no se puede calcular. Esa ausencia ya es una
  excepción del tablero de gerencia y no se duplica aquí.
- **Semana sin ninguna excepción.** Sólo «¿qué necesitas de nosotros?».
- **El plan de la semana pasada tenía días marcados sin cantidad.** Desde el 4 de septiembre de 2026
  no se puede enviar así, pero los cierres viejos lo tienen. E-1 se calcula sobre lo que haya.

---

## 10. Criterios de calidad

Cómo se sabrá si funcionó, con lo que ya tenemos de línea base:

| | Hoy | Qué se espera |
|---|---|---|
| Respuestas de una palabra | 4 de 9 son «nada» o equivalente | Que la causa escogida no admita esa forma |
| Texto libre útil | 2 de 9 | Que «Otra cosa» traiga cosas nuevas, no repita las opciones |
| Semanas con razón contestada | — | Que suba, sin haberlo trabado |
| Discusiones de «expándeme esto» | Es el problema reportado | Que desaparezcan |

---

## 11. Riesgos y decisiones pendientes

| | |
|---|---|
| **Los umbrales de cada excepción** | Sin definir. Es lo que separa señalar lo que importa de gritar todas las semanas |
| **¿Una causa o varias?** | Propuesta: varias. A confirmar |
| **¿Se insiste cuando no contesta?** | Propuesta: una vez, sin trabar. A confirmar |
| **Cuántas semanas de historia** antes de que E-5 y E-6 se activen | Sin definir |
| **La primera lista de causas por excepción** | Hay que escribirla y acordarla, excepción por excepción |
| **Qué pasa con las respuestas viejas** | `sorprendio` y `freno` tienen tres semanas de datos. No se borran: la columna queda y se deja de escribir |
| **Semana corta por feriado** | Sin decidir cómo se ajusta |
| **Riesgo de fondo** | Que las causas de la lista se vuelvan la explicación cómoda y dejen de reflejar lo que pasó. El repaso periódico es la única defensa, y depende de que se haga |

---

## 12. Siguiente acción

**Este documento no está acordado.** Se lee entero y se cuestiona entero — no el pedazo que se está
tocando. Cuando el usuario lo apruebe se escribe la Parte II (el diseño técnico) y recién entonces
se construye.

Lo primero a resolver, porque bloquea todo lo demás: **los umbrales de §6 y la primera lista de
causas de §7.**
