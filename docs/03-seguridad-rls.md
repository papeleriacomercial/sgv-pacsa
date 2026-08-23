# Seguridad y RLS

Roles y políticas por tabla. Se escribe junto con `02-modelo-datos.md`: en este proyecto una
tabla y sus políticas son la misma decisión, no dos.

**Refleja las políticas reales de `sgv-pacsa-dev` al 2026-08-21.**

---

## La regla que ordena todo

**RLS activado en la misma migración que crea la tabla.** Ninguna tabla nace sin sus
políticas, aunque esté vacía.

*Deny by default*: con RLS activo y sin política explícita, nadie ve nada. Una tabla a la
que se le olvidó la política falla cerrada, no abierta. Es lo contrario de lo que pasó en el
SGP, donde el RLS llegó después y hubo que depurar todo.

---

## El modelo de permisos

Las políticas se escriben contra **rol + vendedor asignado**, no contra listas de usuarios.

| Rol | Alcance |
|---|---|
| `vendedor` | Solo sus registros |
| `lider` | Todo su equipo, más su propia cartera |
| `gerente` | Todo |
| `administracion` | Bandejas de cotización, alta de clientes y pedidos |

El equipo de un líder son los perfiles cuyo `lider_id` apunta a él.

**El líder es juez y parte:** supervisa y además vende cuentas clave. Por eso las
reasignaciones de cartera requieren aprobación del gerente y quedan en `auditoria` (§3).

---

## Funciones auxiliares

Toda función que consulte `perfiles` desde una política va **`security definer` con
`set search_path = public`**.

**Por qué.** Sin `security definer`, la consulta a `perfiles` que hace la función vuelve a
disparar las políticas de `perfiles`, que a su vez llaman a la función: recursión infinita.
El `search_path` fijo evita que un `search_path` del cliente resuelva `perfiles` a otro
esquema.

| Función | Devuelve |
|---|---|
| `rol_actual()` | Rol del usuario autenticado |
| `lider_actual()` | Su líder asignado |
| `es_gerente()` | Atajo del caso más frecuente |
| `es_administracion()` | Para las bandejas de oficina |
| `es_mi_equipo(vendedor)` | True si ese vendedor reporta al usuario, o es él mismo |

`es_mi_equipo()` es la que hace legibles las políticas del líder: en vez de repetir la
subconsulta en cada tabla, se escribe `using (es_mi_equipo(vendedor_id))`.

---

## Política por tabla

El patrón se repite en `cuentas`, `seguimientos`, `compromisos` y `oportunidades`, porque
las cuatro cuelgan de un `vendedor_id`. Escribirlo igual en las cuatro es intencional: una
política que se lee de un vistazo es una política que se audita.

### `perfiles`

| Política | Comando | Regla |
|---|---|---|
| `perfiles_select_propio` | SELECT | `id = auth.uid()` |
| `perfiles_select_equipo_lider` | SELECT | `lider_id = auth.uid()` |
| `perfiles_todo_gerencia` | ALL | `es_gerente()` |
| `perfiles_update_propio` | UPDATE | El `with check` impide cambiarse el `rol` o el `lider_id` |

Ese `with check` es lo que evita que un vendedor se promueva a gerente editando su propio
perfil.

### `cuentas`

| Política | Comando | Regla |
|---|---|---|
| `cuentas_vendedor` | ALL | `vendedor_id = auth.uid()` |
| `cuentas_equipo_lider` | SELECT | `es_mi_equipo(vendedor_id)` |
| `cuentas_gerencia` | ALL | `es_gerente()` |
| `cuentas_admin_clientes` | SELECT | `es_administracion() and tipo = 'cliente'` |

El líder **ve** todo su equipo pero no edita sus cuentas: reasignar cartera exige aprobación
del gerente y pasa por `auditoria`.

Administración ve solo los clientes, que es su bandeja de alta formal (§7.2). Antes filtraba
por `etapa = 'ganado'`; se cambió a `tipo` cuando la etapa se mudó a la oportunidad.

**El vendedor no puede cambiar `vendedor_id`**: lo bloquea el `with check`.

### `seguimientos`

| Política | Comando | Regla |
|---|---|---|
| `seguimientos_vendedor_insert` | INSERT | `vendedor_id = auth.uid()` |
| `seguimientos_vendedor_select` | SELECT | `vendedor_id = auth.uid()` |
| `seguimientos_equipo_lider` | SELECT | `es_mi_equipo(vendedor_id)` |
| `seguimientos_gerencia` | ALL | `es_gerente()` |

**No hay política de UPDATE ni de DELETE para el vendedor, a propósito.** Los seguimientos
son bitácora: registran lo que pasó. Si se pudieran editar, el check-in GPS y el resultado
dejarían de ser evidencia y el principio rector del sistema —el avance es consecuencia de
hechos registrados— se cae.

Una corrección se hace agregando una interacción nueva, no reescribiendo la anterior.

### `compromisos` y `oportunidades`

| Política | Comando | Regla |
|---|---|---|
| `*_vendedor` | ALL | `vendedor_id = auth.uid()` |
| `*_equipo_lider` | SELECT | `es_mi_equipo(vendedor_id)` |
| `*_gerencia` | ALL | `es_gerente()` |

Aquí sí hay UPDATE del vendedor: reprogramar un compromiso y mover una oportunidad de etapa
son trabajo normal. Lo que no puede es reasignarlos a otro vendedor.

### `categorias_comercio`

| Política | Comando | Regla |
|---|---|---|
| `categorias_lectura` | SELECT | `true` |
| `categorias_insertar` | INSERT | `true` |
| `categorias_gerencia` | ALL | `es_gerente()` |

Todo el equipo lee y agrega: de nada sirve un catálogo que cada quien ve distinto, y es lo
que lo mantiene vivo sin depender de que alguien lo administre. Depurar duplicados y
desactivar los que sobren es de gerencia.

### `descartes`

| Política | Comando | Regla |
|---|---|---|
| `descartes_lectura_equipo` | SELECT | `true` |
| `descartes_escribe_su_dueno` | INSERT | `vendedor_id = auth.uid()` |
| `descartes_edita_su_dueno` | UPDATE | `vendedor_id = auth.uid()` |
| `descartes_gerencia` | ALL | `es_gerente()` |

**Excepción deliberada al modelo de "cada quien ve lo suyo".** Si un vendedor marca que un
local cerró, no tiene sentido que el siguiente lo vuelva a recorrer. Lo que se comparte es
un hecho del mundo, no información comercial.

### `auditoria`

| Política | Comando | Regla |
|---|---|---|
| `auditoria_gerencia` | SELECT | `es_gerente()` |
| `auditoria_propia` | SELECT | `actor_id = auth.uid()` |

**Ninguna política de INSERT, UPDATE ni DELETE.** Las filas las escriben triggers
`security definer`. Nadie edita la auditoría, ni siquiera gerencia.

---

## `cierres`: el RLS decide filas, no columnas

El líder tiene UPDATE sobre los cierres de su equipo porque tiene que poder responder. Pero
**no puede reescribir el plan**, y eso el RLS no lo puede expresar: una política decide qué
filas se tocan, no qué columnas.

Lo resuelve un trigger, `cierres_protege_el_plan`: si quien actualiza no es el dueño ni
gerencia, cualquier cambio a los números, las respuestas de las tres preguntas, el plan o la
apuesta se rechaza con `check_violation`. Solo pasa la respuesta.

Está en la base y no en la pantalla a propósito. Es la regla que sostiene todo el esquema de
abajo hacia arriba, y una regla que solo vive en la interfaz se salta desde cualquier otro
lado.

---

## `listas` y su contenido

`listas_cuentas` no puede consultar `listas` directamente desde su política: `listas` tiene
RLS, y evaluar una política dentro de otra hace que Postgres recurse. Por eso
`puedo_ver_lista()` y `puedo_editar_lista()` son `security definer` con
`set search_path = public`, igual que `rol_actual()`.

El líder ve las listas de su equipo pero no las modifica: son el plan del vendedor.

---

## `solicitudes`

Administración ve y cierra su bandeja —pedidos, cotizaciones y muestras que salieron a la
oficina— y **no ve los precios**: esos son decisión de gerencia. El vendedor cierra las que
resuelve él mismo con su talonario.

---

## `jornadas` y `competidores`

`jornadas` sigue el modelo de `seguimientos`: cada quien registra y ve lo suyo, el líder ve
a su equipo, gerencia todo. **Con una excepción deliberada en UPDATE:** el vendedor puede
corregir el bloque de hoy y solo el de hoy.

Es un equilibrio, no un descuido. Sin UPDATE, un "media jornada" mal puesto queda mal toda la
semana y el vendedor deja de registrar; con UPDATE abierto, la semana se puede reescribir el
jueves antes de cerrarla. El corte por fecha del día en Panamá resuelve las dos cosas.

`competidores` es un catálogo compartido, igual que `categorias_comercio`: todos leen,
cualquiera agrega escribiendo, y solo gerencia puede desactivar o fusionar duplicados. Una
lista que cada quien viera distinta no serviría para comparar nada.

---

## La vista `cuentas_resumen`

Una vista **no tiene políticas propias**: hereda las de sus tablas, pero solo si se declara
con `security_invoker = true`. Sin esa marca correría con los permisos de quien la creó y
saltaría el RLS por completo.

Es el error más silencioso de todo este esquema: la vista funcionaría, devolvería datos, y
cada vendedor estaría viendo la cartera entera sin que nada avisara. Verificado en dev: otro
usuario ve cero filas.

**Cada vez que se rehace, hay que volver a ponerle la marca.** Postgres no deja cambiar el
tipo de una columna de la que cuelga una vista, así que toda migración que toque
`cuentas.tipo` la tira y la vuelve a crear —pasó en `20260822134935_ciclo_de_vida_cuenta`—.
Un `create view` sin `with (security_invoker = true)` compila igual y abre la cartera entera.
Es la línea que hay que revisar en el diff, no el `select`.

---

## Divulgación controlada

Dos funciones rompen el aislamiento a propósito, porque hay preguntas que no se pueden
responder sin mirar registros ajenos:

| Función | Pregunta que responde | Qué devuelve |
|---|---|---|
| `buscar_duplicados()` | "Este punto ya está registrado y asignado a X" (§6) | Nombre, vendedor y distancia |
| `estado_de_puntos()` | El semáforo de la búsqueda (§7.4) | Estado, vendedor, última interacción |

Las dos son `security definer` y **devuelven deliberadamente poco**: nada de contacto,
notas, etapas ni montos. Alcanza para decidir y no abre el expediente ajeno.

Es el patrón a seguir cada vez que aparezca esta tensión: no relajar la política, sino
exponer una función que responda la pregunta exacta con el mínimo dato.

---

## Storage

El bucket de fotos se llama `visitas` —conserva el nombre viejo porque renombrarlo obliga a
mover los archivos— y lleva políticas propias. La ruta es `{vendedor_id}/{archivo}`, y la
política compara ese primer segmento contra `auth.uid()`.

Sin esa convención el RLS de `seguimientos` sería decorativo: bastaría adivinar la URL para
ver la evidencia de otro vendedor.

No hay política de update ni de delete: la foto es evidencia, igual que el seguimiento.

---

## Las llaves

La llave `anon` viaja al navegador. **Es el RLS lo que la hace segura**, no el secreto.

`service_role` y `sb_secret_` saltan el RLS por completo. No van en Vercel ni en el
repositorio mientras no exista código de servidor que las necesite, y cuando exista irán en
variables sin prefijo `NEXT_PUBLIC_`.

---

## Cómo se verifica

Una política no está lista porque se escribió, sino porque se comprobó:

1. Consultar `pg_policies` y confirmar el `using` y el `with check` esperados.
2. Confirmar `relrowsecurity` en `pg_class`.
3. Confirmar que las auxiliares son `prosecdef` con `search_path=public`.
4. **La prueba que importa:** simular otro usuario e intentar leer o escribir lo ajeno. Debe
   devolver cero filas o `42501`, nunca datos.

El punto 4 se hace con `set local request.jwt.claims` dentro de una transacción revertida.
Todas las tablas de este esquema pasaron esa prueba; los resultados están en `07-estado.md`.

---

## Puntos abiertos

- Alta de perfiles: trigger sobre `auth.users` o creación manual por la oficina.
- Si `perfiles` lleva `created_by`, que §16 exige en todas las tablas.
- Qué ve exactamente `administracion` en `seguimientos` cuando llegue la bandeja de
  cotizaciones.
