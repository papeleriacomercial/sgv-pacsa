# Conexión con Zoho Books

**Estado:** conectado en lectura, diagnóstico hecho · **Actualizado:** 2026-08-24

Qué se trae de Zoho, en qué orden y por qué. El alcance de fondo está en §7.6 de la visión
—el modelo de gemelos— y en `docs/09-medicion-y-gestion.md`, que explica por qué la mitad de
cuidado de clientes no existe sin facturación.

---

## Lo que decide todo: el cruce, no el resumen

**Zoho sabe quién compró. El SGV sabe a quién se visitó. Nadie tiene las dos cosas juntas.**

Por eso la primera traída **no** es «ventas del mes»: eso Zoho ya lo da, y mejor. Lo que ningún
sistema puede contestar hoy es esto:

| Cruce | Qué significa |
|---|---|
| Compraba, dejó de comprar, **nadie fue** | Falla de cuidado. Es plata que se va sola |
| Se visita mucho y **no compra** | Esfuerzo mal puesto |
| **Compra y nadie lo visita** | Riesgo puro: el día que aparezca competencia, se va |

Y cambia el aviso que ve el vendedor. Hoy la cadencia se mide contra *visitas* —o sea, contra su
propia actividad— y le dice algo que ya sabía. Con facturación se mide contra el hecho:
**«dejó de comprar»**.

## Lo mínimo que hay que traer

Tres datos por cliente. Nada más:

- Fecha de la última factura
- Monto de esa factura
- Total facturado en los últimos 12 meses

Solo lectura, una pasada de noche. Sin escribir en Zoho, sin líneas de factura, sin sincronizar
el maestro completo.

## El orden, y por qué

1. **Última compra** — desbloquea los tres cruces de arriba y el aviso del vendedor.
2. **Catálogo de productos** — para consultar precios y existencias parado frente al mostrador.
3. **Cotizar directo desde el SGV** — la primera escritura a Zoho.

El tercero merece su propia decisión y no es técnica. Hoy el vendedor le pide la cotización a
administración desde *Solicitudes*, con su reloj de cuánto tarda en contestarse. Cotizar directo
elimina ese paso —que puede ser lo que se quiere— pero también **elimina el control de precios
de administración**. Conviene decidirlo mirando cuántas cotizaciones y con cuánta demora salen
en el primer mes de uso real.

---

## Paso a paso de la conexión

### 1. Centro de datos

Confirmado el 2026-08-24: **`books.zoho.com`**, centro de datos de Estados Unidos.

| Para qué | Dirección |
|---|---|
| Token | `https://accounts.zoho.com` |
| API | `https://www.zohoapis.com/books/v3` |

Si algún día la organización se mudara de centro de datos, las dos cambian.

### 2. Organización

`630051923`. Va en `ZOHO_ORG_ID` y **en todas** las llamadas como parámetro
`organization_id` — sin él la API responde a otra organización o a ninguna.

### 3. Cliente de API

En `api-console.zoho.com`, tipo **Self Client**. No «Web Based»: no hay pantalla de login que
redirigir, esto es servidor a servidor.

### 4. Permisos, de solo lectura

```
ZohoBooks.contacts.READ,ZohoBooks.invoices.READ,ZohoBooks.settings.READ
```

**Solo lectura a propósito.** Un token que puede escribir es un token que puede romper la
contabilidad. Ampliar después es regenerar el código: cinco minutos. Cuando toque cotizar se
agregan `ZohoBooks.items.READ` y `ZohoBooks.estimates.CREATE`.

### 5. Token permanente

El código de la consola dura 10 minutos; el `refresh_token` que sale de canjearlo no caduca.

```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" -d "grant_type=authorization_code" -d "client_id=EL_CLIENT_ID" -d "client_secret=EL_CLIENT_SECRET" -d "code=EL_CODIGO"
```

### 6. Variables de entorno

En `.env.local` para desarrollo, y las mismas en Vercel cuando esto salga a producción.

```
ZOHO_DOMINIO=zoho.com
ZOHO_ORG_ID=630051923
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_REFRESH_TOKEN=...
```

`.gitignore` ya cubre `.env*`. **Nada de esto entra al repositorio.**

---

## El diagnóstico previo

```bash
node scripts/zoho-diagnostico.mjs
```

Contesta la única pregunta que decide el diseño de la integración: **dónde vive el RUC en los
contactos de Zoho y en cuántos está puesto.** Puede estar en el campo de identificación fiscal,
en el nombre de la empresa o en un campo personalizado, y en cada caso el enganche con las
cuentas del SGV es distinto.

**No imprime datos de clientes.** De cada valor muestra su *forma* —los dígitos se vuelven 9 y
las letras A— así que se ve el formato del RUC sin que salga ningún RUC. Los secretos se leen
del entorno y no se muestran nunca.

Devuelve cuatro cosas: cuántos clientes hay, qué campos vienen llenos y en qué proporción, qué
campos parecen contener un RUC con su formato, y cuántas facturas hay de los últimos 12 meses.

### Por qué el enganche va por RUC y no por nombre

El nombre no sirve: «Minisuper La Esquina», «Minisúper la esquina» y «MINISUPER LA ESQUINA S.A.»
son la misma empresa y tres textos distintos. El RUC es llave dura, y el SGV ya lo captura.

Y esto **le da vuelta a un bloqueo**. La higiene del maestro de clientes de Zoho está anotada
como bloqueante de §7.6 desde el principio, pero nadie sabe qué tan sucio está. El diagnóstico
convierte ese bloqueo en un número: cuántos clientes tienen RUC utilizable. Y mientras tanto, lo
que enganche ya sirve — no hace falta el cien por ciento para que un vendedor vea que tres de
sus clientes dejaron de comprar.

---

## Lo que hay que mirar antes de decidir el nivel del dato

**Si Zoho factura a la casa matriz y no a la sucursal**, la factura no dice *qué punto* compró.
En una cadena eso importa mucho: es exactamente el caso que el motivo de descarte «se negocia en
Panamá» señala desde el otro lado.

El esquema del SGV ya distingue madre de punto —`cuenta_madre_id`, `tipo_punto`— así que puede
representar las dos formas. Lo que falta es saber cómo están montados los clientes en Books, y
eso lo dice el diagnóstico.


---

## Lo que hay del otro lado — medido el 2026-08-24

Primera conexión real. Todo lo de abajo salió de `scripts/zoho-diagnostico.mjs`.

### El maestro de clientes

| | |
|---|---|
| Clientes en Books | **2 368** |
| Con RUC puesto | **1 520 · 64 %** |
| Facturas de los últimos 12 meses | **3 627** |
| Clientes que compraron algo en 12 meses | **496** |

### El RUC existe y tiene formato propio

Vive en un **campo personalizado llamado `RUC`** (`cf_331205000000044099`), y trae el
dígito verificante pegado:

    999999999-9-9999 DV 99      persona jurídica
    9-999-999 DV 99             persona natural

Hay que separar RUC de DV al normalizar, y comparar contra `cuentas.ruc` del SGV sin espacios
ni guiones. **Es llave dura**, que es justo lo que hacía falta: por nombre nunca habría
funcionado.

### Zoho ya clasifica el ciclo de vida, y con nuestras mismas palabras

Campo personalizado `cf_tipo_de_cliente`, puesto en el 99 % de los contactos:

| Tipo en Zoho | Total | Compró en 12m | Sin comprar | Con RUC |
|---|---|---|---|---|
| Cliente | 850 | 436 | **414** | 95 % |
| Cliente inactivo | 658 | 23 | 635 | 87 % |
| Potencial descartado | 530 | 4 | 526 | 12 % |
| Potencial | 321 | 33 | 288 | 23 % |
| Prospecto | 3 | 0 | 3 | 0 % |

**La escalera de Zoho es la del SGV.** Potencial → prospecto → cliente, más descartado e
inactivo. El vocabulario que se eligió el 2026-08-24 para reemplazar «lead» (D-025) resultó ser
el que la casa ya usaba: no hay que traducir nada.

**Y trae la misma suciedad que el catálogo de tipos de comercio:** «Cliente » con espacio (17),
«Cliente inactivo » (4), «Cliente Activo » (1). Al cruzar hay que pasar por
`normalizar_texto()` — el mismo problema que D-022 resolvió del lado del SGV.

### Los 414

De los 850 marcados **Cliente**, **414 no han comprado en un año**. No es un dato de la
integración: es el argumento de la integración. Hoy nadie puede decir cuáles de esos 414 se
visitaron y cuáles nadie tocó, porque esa mitad vive en el SGV y la otra en Books.

Ese número es el que hace que valga la pena, y ninguno de los dos sistemas puede calcularlo solo.

### Consecuencias para el diseño

- **Los 848 sin RUC no se pierden**, quedan fuera del cruce automático hasta que se les ponga.
  El diagnóstico se puede volver a correr para ver si el número baja.
- **La primera pasada solo necesita 496 clientes**, no 2 368: los que compraron. El resto se
  trae cuando compre.
- `is_linked_with_zohocrm` viene en **true** en el 100 %, y cada contacto trae
  `zcrm_account_id`, `zcrm_contact_id` y `crm_owner_id`. **Books es el espejo de un CRM**,
  y eso abre la pregunta de si el vendedor asignado debe leerse de ahí. Ver abajo.

---

## El catálogo de productos — 2026-08-25

Contesta las dos preguntas que hoy obligan a llamar a la oficina con el cliente delante:
**¿lo tienen?** y **¿a cómo?**

| | |
|---|---|
| Productos en Books | **1 834** |
| Activos y vendibles | 1 771 |
| Con precio de lista | 1 281 |
| **Sin precio** | **490** |
| Con existencia | 672 |

**Es la pasada más barata de todas:** los productos vienen en el listado, no hay que abrir uno
por uno. Nueve consultas para el catálogo entero.

### Dos cosas del catálogo real que cambian el diseño

**El precio cero no es cero.** En Books, 490 productos vienen en `rate = 0`, y eso significa que
el precio se acuerda con el cliente. Se guarda **nulo** y la pantalla dice «Precio a consultar».
Mostrar «$0» sería mentir en el peor momento posible — frente al mostrador.

**Los nombres traen prefijo de cliente**: «# AB», «# Nata». Son productos hechos para un
comercio concreto. Se guardan tal cual: el vendedor los reconoce, y limpiarlos borraría justo lo
que los distingue.

### Buscar como busca una persona

`buscar_productos()` acepta palabras sueltas, sin acentos y en cualquier orden: **«rollo termico
80» encuentra «Rollos Térmicos 80mm x 70mm»**. Un `ilike` con comodines no sirve porque exige el
orden exacto.

**Lo que hay en existencia sale primero**, porque es lo que se puede prometer hoy.

### Lo que ya no está en Books

Se marca como ido, no se borra. Puede estar nombrado en una transacción vieja, y perderlo
dejaría el historial de compra cojo.

### Lo que esto todavía no es

**Es de solo consulta.** Cotizar desde el SGV es la etapa siguiente y una decisión aparte:
implica **escribir en la contabilidad**, que hasta hoy nunca se ha tocado. El paso intermedio
natural es que el pedido a la oficina lleve productos del catálogo en vez de texto libre — así
Verónica deja de interpretar «2 cajas de rollos».
