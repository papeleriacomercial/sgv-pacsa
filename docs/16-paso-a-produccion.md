# Paso a producción

Qué hay que hacer, en qué orden y qué se puede romper. Es una lista para seguir con el proyecto
abierto delante, no una explicación.

**El piloto corre en producción, no en desarrollo.** `sgv-pacsa-dev` es donde se prueban las
migraciones antes de aplicarlas, y una migración que se prueba es una migración que a veces
falla. Un vendedor en la calle no puede estar del otro lado de esa prueba.

---

## Lo que ya está resuelto

- **Todo el esquema entra por migración.** Las 48 migraciones del repositorio crean tablas, RLS,
  funciones, vistas y **también** los dos buckets de Storage (`visitas` y `cotizaciones`) con sus
  políticas. No hay nada que tocar a mano en el panel.
- **Los datos de arranque también son migración**: los datos de Papelería Comercial para el
  encabezado de las cotizaciones, el catálogo inicial de tipos de comercio, y los cinco parámetros
  —comisión 1,5 %, comisión sobre neto, tope de cotización $500, ITBMS 7 %, piso de gemelos 5—.
- **Los cuatro usuarios ya existen en `sgv-pacsa-prod`.** Se crearon ahí primero por confusión
  entre los dos proyectos y se dejaron. Hay que **revisarles el rol y el líder**, que se
  configuraron después en desarrollo.

## Lo que no se copia, y es a propósito

Las cuentas de prueba de desarrollo —Restaurante Waikiki, Minisuper la Esquina, la lista «Banco
General»— **no van a producción**. Producción arranca con lo que traen Zoho y Badger, que es lo
real.

---

## El orden

Los pasos 3 a 6 tienen que ir en ese orden: cada uno cuelga del anterior.

### 1 · Fusionar `dev` en `main`

```bash
git checkout main && git merge dev && git push
```

Vercel despliega solo al recibir `main`.

### 2 · Aplicar las migraciones a producción

Apuntar la CLI al proyecto de producción y empujar. **Antes de empujar, comprobar que el proyecto
enlazado es el correcto** — es el error que más caro sale de esta lista.

### 3 · Los perfiles

Los cuatro usuarios existen. Falta dejarlos como en desarrollo:

| Persona | Rol | Líder |
|---|---|---|
| Gerencia | `gerente` | — |
| Christopher Guerra | `lider` | — |
| Albert Batista | `vendedor` | Christopher |
| Javier Rodríguez | `vendedor` | Christopher |

**Sin `lider_id`, Christopher no ve a su equipo** y el filtro de vendedor de la pantalla de Ventas
le muestra solo a él.

### 4 · El catálogo de productos

```bash
node scripts/zoho-productos.mjs --aplicar
```

Son 1 834 productos y nueve o diez consultas. Va primero porque es la más barata y confirma que
las credenciales de Zoho funcionan antes de las pasadas largas.

### 5 · Clientes y facturación

```bash
node scripts/zoho-sincronizar.mjs --aplicar
```

Crea las cuentas de los clientes de calle, el espejo `clientes_zoho` y decide de quién es cada
cliente. En desarrollo dio 232 clientes y 3 vendedores reconocidos.

### 6 · El detalle de cada compra

```bash
node scripts/zoho-historial.mjs --aplicar
```

**Esta tarda unos trece minutos** la primera vez: abre documento por documento, unos 1 534.
Después es incremental y son dos consultas.

Si se corta —por cuota de Zoho— la marca de agua **no avanza** y la siguiente pasada recupera lo
que faltó. Se puede volver a lanzar sin miedo.

### 7 · Badger

```bash
node scripts/badger-analizar.mjs
node scripts/badger-cargar.mjs --aplicar
```

Pone coordenadas a las cuentas que engancharon **seguro** y crea los prospectos que el SGV no
conocía. Lo dudoso —78 parejas— queda esperando a que alguien lo revise.

### 8 · Las variables de Vercel

Las mismas de `.env.local` pero apuntando a producción:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Panel de `sgv-pacsa-prod` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ídem |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | La misma de hoy |

**La clave de servicio no va en Vercel.** La aplicación nunca la usa: solo las pasadas de
sincronización, que corren en otro lado.

### 9 · Los secretos de la tarea programada

En GitHub → Settings → Secrets and variables → Actions:

`ZOHO_ORG_ID` · `ZOHO_CLIENT_ID` · `ZOHO_CLIENT_SECRET` · `ZOHO_REFRESH_TOKEN` ·
`NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY`

Y como **variable** —no secreto— `SUPABASE_REF_ESPERADO` con el identificador del proyecto de
producción. Es el seguro contra pegar mal un secreto: la pasada se detiene en vez de escribir en
la base equivocada, que no da error y se descubre semanas después.

Después, lanzarla a mano una vez desde la pestaña Actions para ver que corre.

---

## La transición del vendedor

Hoy el vendedor usa Badger. En el piloto va a usar el SGV. **Los dos a la vez no funciona**: lo
que registre en uno no aparece en el otro, y al mes nadie sabe cuál creer.

La transición no es técnica sino de acuerdo:

1. **Se carga Badger una vez** —paso 7— y esa carga es la foto final. Lo que el vendedor levante
   en Badger después de esa fecha se pierde.
2. **Desde el día del corte, el SGV es el único sitio donde se registra.** Badger queda de
   consulta, en solo lectura de hecho aunque no lo esté.
3. **Conviene cortar un lunes**, con la semana planificada en el SGV desde el principio. Cortar a
   media semana deja media semana en cada sistema.

Falta decidir **si arrancan los tres a la vez o uno solo**. Con uno solo se aprende barato pero el
líder trabaja con dos sistemas; con los tres se corta de una y el riesgo es que un problema pare a
todos.

---

## Después del corte

- **Cuotas y alerta de gasto en Google Cloud.** Sigue pendiente desde el principio, y en
  producción la búsqueda de prospectos se usa de verdad. Sin tope diario, un error en bucle se
  paga en la tarjeta.
- **La cuenta de la empresa como dueña del proyecto de Google.** Hoy cuelga de una cuenta
  personal.
- **Revisar Badger**: 78 parejas dudosas y 120 clientes sin enganchar.
- **Depurar los tipos de comercio**: `/categorias` propone cinco uniones y las cinco son
  correctas. Hasta que se hagan, el modelo de gemelos cuenta la misma categoría dos veces.

---

## Lo que hay que mirar el primer día

| Qué | Dónde | Qué tiene que verse |
|---|---|---|
| La tarea de la noche corrió | GitHub → Actions | En verde, y el registro con los conteos |
| La comisión cuadra | Ventas → Facturado | Lo mismo que la planilla, salvo notas de crédito |
| Cada vendedor ve lo suyo | Entrar como cada uno | Su cartera, no la de los otros |
| Las fotos suben | Registrar un seguimiento con foto | Sin error de permisos en el bucket |
