# 19 · El giro de la cuenta

**Estado: PROPUESTA — 2026-10-25.** Se construye cuando el usuario lo apruebe.

> **De qué se trata, en una frase.** El 65 % del dinero que facturamos va a cuentas de las que no
> sabemos a qué se dedican, y eso es lo único que falta para poder decir a qué sectores le estamos
> vendiendo.

---

## 1 · El problema, medido

Lo destapó el usuario al leer el reporte semanal: *«no veo qué sector estamos apuntando»*. La
respuesta corta es que el sistema no lo sabe. La larga son estos números, medidos el 25 de octubre
de 2026:

| | |
|---|---|
| Cuentas que facturaron en 2026 | **232** |
| De ésas, **sin giro** | **180** |
| Lo que representan | **$319 314 de $491 346 — el 65 %** |

Y por persona:

| | Cuentas sin giro | Lo que facturan |
|---|---|---|
| Javier Rodríguez | 117 | $174 559 |
| Christopher Guerra | 22 | $107 261 |
| Albert Batista | 41 | $37 495 |

> **La fusión de sectores del 25 de octubre arregló la consistencia, no la cobertura.** Donde había
> «Farmacia» y «Farmacias» como dos mercados ahora hay uno de 43 cuentas. Eso era necesario y no
> alcanza: sin el giro de las 180, el reporte por sector diría «sin dato» en el renglón del dinero.

---

## 2 · Por qué la idea obvia no funciona

La primera propuesta fue: **pedir el giro cuando el vendedor registra una visita** a una cuenta que
no lo tenga. Es barata, no agrega trabajo nuevo y la pieza ya existe —`CampoCategoria`, el buscador
con catálogo que se alimenta solo—.

**Y se cae con los datos en la mano.** En ocho semanas:

| | Registros | Cuentas distintas tocadas | De ésas, sin giro |
|---|---|---|---|
| Javier | 171 | 98 | 32 |
| Albert | 105 | 82 | 60 |
| Christopher | 80 | 28 | 12 |

Javier tiene **117 cuentas que le facturan sin giro** y en dos meses tocó **32**. El anzuelo pasivo
llenaría la cola chica y dejaría el 65 % del dinero esperando.

**La razón de fondo ya estaba en el reporte semanal:** *15 de las 23 ventas de Javier fueron a
clientes sin visita ni llamada registrada*. **Las cuentas que más facturan son precisamente las que
no se registran** — recompran por teléfono o por la oficina. Un anzuelo que depende de registrar una
visita nunca las va a alcanzar.

---

## 3 · Dos anzuelos, y el que importa es el segundo

### 3.1 · El pasivo: preguntarlo cuando ya está escribiendo

Al registrar un seguimiento sobre una cuenta sin giro, **un campo más, y sólo cuando falta.**

```
┌─────────────────────────────────────────┐
│  Seguimiento · Abarrotería Premium      │
│                                         │
│  Tipo        [visita] [llamada] …       │
│  Resultado   …                          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ ¿A qué se dedica?                 │  │
│  │ No lo tenemos registrado.         │  │
│  │ [ escribe o escoge ▾ ]            │  │
│  │   Mini Super · Abarrotería …      │  │
│  └───────────────────────────────────┘  │
│                                         │
│            [ Guardar ]                  │
└─────────────────────────────────────────┘
```

**Opcional, nunca obligatorio.** Un campo que traba el registro de una visita hace que la visita no
se registre — y entonces se pierden las dos cosas, el giro y la visita. Es la misma lección del plan
diario: *se traba el dato, no la conducta.*

**Cubre la cola larga sin costar nada**, y a los seis meses el sistema sabe el giro de todo lo que se
camina. Pero no es lo que resuelve el reporte.

### 3.2 · El activo: ir por la plata, ordenada

Un bloque corto que **persigue el dinero en vez de esperar la visita**: las cuentas que te facturan y
no tienen giro, **ordenadas por lo que facturan**.

```
┌──────────────────────────────────────────────────────────┐
│  SABEMOS QUÉ TE COMPRAN, NO A QUÉ SE DEDICAN             │
│  117 cuentas · $174 559 este año                         │
│  ──────────────────────────────────────────────────────  │
│  Supermercados Xtra, S.A.              $37 237           │
│     [ escribe o escoge ▾ ]                               │
│                                                          │
│  Multi Empresa Montreal                $13 347           │
│     [ escribe o escoge ▾ ]                               │
│                                                          │
│  Abarroteria Premiun                   $13 289           │
│     [ escribe o escoge ▾ ]                               │
│                                                          │
│  … 114 más, de menos a más plata                         │
│                                                          │
│  Con las diez primeras cubres la mitad de tu facturación │
└──────────────────────────────────────────────────────────┘
```

**Ordenarlo por dinero es todo el diseño.** Las diez cuentas más grandes de cada vendedor concentran
la mayor parte de lo que factura: **diez toques resuelven la mitad del problema**, y ciento diecisiete
toques resolverían el resto con un rendimiento decreciente que no vale la pena perseguir.

**Y se guarda uno por uno, al escogerlo.** No hay botón de «Guardar todo» al final: una lista de
ciento diecisiete que se guarda de golpe es una lista que nadie termina, y si se corta la señal a la
mitad se pierde todo lo escrito.

---

## 4 · Dónde vive el bloque, y para quién

| | |
|---|---|
| **El vendedor** | En **Cuentas**, no en la Agenda. La Agenda es lo de hoy; esto es trabajo de escritorio que se hace una vez. Ponerlo en la Agenda sería una tarea permanente compitiendo con la ruta |
| **Gerencia** | La misma lista, de todo el equipo. **Y es lo más rápido que hay:** mirando los nombres —«Supermercados Xtra», «Administradora de Parqueos», «Industrias Lácteas»— el giro es obvio sin preguntarle a nadie. Veinte minutos de una tarde cubren el 65 % del dinero |

> **Esto no entra como acción del plan diario**, y el usuario ya lo decidió al autorizar la fusión:
> *«por el momento no le pondría una tarea todavía a los vendedores de clasificar cuentas»*. El bloque
> está disponible, no asignado. Si algún día se quiere empujar, el plan diario ya sabe poner metas.

---

## 5 · Lo que esto habilita

En el momento en que los clientes con giro pasen de la mitad del dinero, el reporte semanal gana su
sección de sector —y es la que contesta la pregunta que abrió todo esto: **¿estamos pescando donde
hay peces?**

```
   LO QUE FACTURASTE, POR SECTOR            esta semana    el año

   Mini Super                                   $1 240    $38 400
   Farmacia                                     $2 985    $31 200
   Restaurante                                    $890    $22 100
   Almacén                                         —      $18 900
   ─────────────────────────────────────────────────────────────
   Sin clasificar                                 $743     $9 100
```

**Con su renglón de «sin clasificar» siempre a la vista**, porque un reporte de sectores que esconde
lo que no sabe es el peor de todos: se lee como si estuviera completo.

---

## 6 · Lo que no se hace, y por qué

**No se adivina el giro a partir del nombre.** Es tentador —«Supermercados Xtra» es un supermercado,
«Farmacias Europeas» una farmacia— y funcionaría para la mitad. Pero *«Multi Empresa Montreal»*,
*«El Imán Poderoso»* y *«Yogi Lovers»* no se adivinan, y un sector inventado es peor que un hueco:
nadie va a volver a revisarlo porque ya tiene un valor. **Lo que sí se hace es ordenar la lista para
que adivinar sea innecesario.**

**No se vuelve obligatorio en el alta de cuenta.** Hoy es opcional a propósito (D-012): obligar a
clasificar antes de saber nada produce una marca puesta al azar, que es exactamente lo que llenó el
catálogo de «Elisa» y «FAR».

**No se cambia `tipo_comercio` por una llave al catálogo.** Sería lo correcto en un diseño nuevo y es
una migración de las caras, con 860 cuentas y un catálogo que los vendedores alimentan. El texto con
catálogo asistido ya evita los duplicados nuevos desde el 24 de agosto; lo que faltaba era la
cobertura, no la forma.

---

## 7 · Lo que falta decidir

| | |
|---|---|
| **¿Quién llena las grandes?** | Gerencia en veinte minutos mirando los nombres, o cada vendedor las suyas. **Se recomienda gerencia**: son las que mueven el dinero, los nombres son obvios y no cuesta pedirle nada a nadie |
| **¿Entra el campo en el seguimiento?** | El anzuelo pasivo de §3.1. Es barato y no estorba, pero agrega un campo a la pantalla que más se usa |
| **¿Cuántas se listan de una?** | Se propone **diez**, con «ver más». Una lista de ciento diecisiete asusta y se cierra |
