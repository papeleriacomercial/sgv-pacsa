# Seguridad y RLS

Roles y políticas por tabla. Se escribe junto con `02-modelo-datos.md`: en este proyecto una
tabla y sus políticas son la misma decisión, no dos.

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

### Existentes

Creadas en `20260819224500_perfiles_y_roles`:

| Función | Devuelve | Uso |
|---|---|---|
| `rol_actual()` | `rol_usuario` | Rol del usuario autenticado |
| `lider_actual()` | uuid | Su líder asignado |
| `es_gerente()` | boolean | Atajo del caso más frecuente |

### Por crear en el Tramo 3

| Función | Devuelve | Uso |
|---|---|---|
| `es_administracion()` | boolean | Bandejas de oficina |
| `es_mi_equipo(vendedor uuid)` | boolean | True si ese vendedor reporta al usuario, o es él mismo |

`es_mi_equipo()` es la que hace legibles las políticas del líder: en vez de repetir la
subconsulta a `perfiles` en cada tabla, se escribe `using (es_mi_equipo(vendedor_id))`.

---

## Política por tabla

El patrón se repite en `prospectos`, `visitas` y `compromisos`, porque las tres cuelgan de
un `vendedor_id`. Escribirlo igual en las tres es intencional: una política que se lee de
un vistazo es una política que se audita.

### `perfiles` — implementada

| Política | Comando | Regla |
|---|---|---|
| `perfiles_select_propio` | SELECT | `id = auth.uid()` |
| `perfiles_select_equipo_lider` | SELECT | `lider_id = auth.uid()` |
| `perfiles_todo_gerencia` | ALL | `es_gerente()` |
| `perfiles_update_propio` | UPDATE | `id = auth.uid()`, y el `with check` impide cambiarse el `rol` o el `lider_id` |

Ese `with check` es lo que evita que un vendedor se promueva a gerente editando su propio
perfil. Verificado contra `sgv-pacsa-dev` el 2026-08-20.

**Falta definir:** no hay política de `insert` para usuarios normales, así que hoy solo
gerencia crea perfiles. Hay que decidir si el alta la hace un trigger sobre `auth.users` o
la oficina a mano.

### `prospectos`

| Política | Comando | Regla |
|---|---|---|
| `prospectos_vendedor` | ALL | `vendedor_id = auth.uid()` |
| `prospectos_equipo_lider` | SELECT | `es_mi_equipo(vendedor_id)` |
| `prospectos_gerencia` | ALL | `es_gerente()` |
| `prospectos_admin_ganados` | SELECT | `es_administracion() and etapa = 'ganado'` |

El líder **ve** todo su equipo pero no edita sus prospectos: reasignar cartera exige
aprobación del gerente y pasa por `auditoria`.

Administración ve solo los ganados, que es su bandeja de alta de clientes (§7.2). No tiene
por qué ver la prospección en curso.

**El vendedor no puede cambiar `vendedor_id`.** Se bloquea en el `with check`, igual que el
`rol` en `perfiles`: sin eso, cualquiera se pasa a sí mismo el prospecto de un compañero.

### `visitas`

| Política | Comando | Regla |
|---|---|---|
| `visitas_vendedor_insert` | INSERT | `vendedor_id = auth.uid()` |
| `visitas_vendedor_select` | SELECT | `vendedor_id = auth.uid()` |
| `visitas_equipo_lider` | SELECT | `es_mi_equipo(vendedor_id)` |
| `visitas_gerencia` | ALL | `es_gerente()` |

**No hay política de UPDATE ni de DELETE para el vendedor, a propósito.** Las visitas son
bitácora: registran lo que pasó. Si se pudieran editar, el check-in GPS y el resultado
dejarían de ser evidencia y el principio rector del sistema —el avance es consecuencia de
hechos registrados— se cae.

Una corrección se hace agregando una interacción nueva, no reescribiendo la anterior. Es la
misma lógica que §7.8 aplica a los comentarios.

### `compromisos`

| Política | Comando | Regla |
|---|---|---|
| `compromisos_vendedor` | ALL | `vendedor_id = auth.uid()` |
| `compromisos_equipo_lider` | SELECT | `es_mi_equipo(vendedor_id)` |
| `compromisos_gerencia` | ALL | `es_gerente()` |

Aquí sí hay UPDATE del vendedor: un compromiso se reprograma, y eso es parte normal del
trabajo. Lo que no puede es reasignarse a otro vendedor.

### `auditoria`

| Política | Comando | Regla |
|---|---|---|
| `auditoria_gerencia` | SELECT | `es_gerente()` |
| `auditoria_propia` | SELECT | `actor_id = auth.uid()` |

**Ninguna política de INSERT, UPDATE ni DELETE.** Las filas las escriben triggers
`security definer`, no los usuarios. Nadie edita la auditoría, ni siquiera gerencia: una
bitácora editable no sirve como bitácora.

---

## Storage

El bucket de fotos lleva políticas propias, alineadas al mismo modelo de roles. La ruta del
archivo incluye el `vendedor_id`, y la política compara ese segmento contra `auth.uid()`.

Sin esto, el RLS de la tabla `visitas` sería decorativo: bastaría con adivinar la URL de la
foto para ver la evidencia de otro vendedor.

Se define junto con la tabla `visitas`, en el Tramo 3.

---

## Las llaves

La llave `anon` viaja al navegador. **Es el RLS lo que la hace segura**, no el secreto: sin
políticas, esa llave lo ve todo.

Las llaves `service_role` y `sb_secret_` saltan el RLS por completo. No van en Vercel ni en
el repositorio mientras no exista código de servidor que las necesite, y cuando exista irán
en variables sin prefijo `NEXT_PUBLIC_`.

---

## Cómo se verifica

Una política no está lista porque se escribió, sino porque se comprobó. Después de aplicar
la migración:

1. Consultar `pg_policies` y confirmar que cada política existe con el `using` y el
   `with check` esperados.
2. Confirmar `relrowsecurity` en `pg_class` para la tabla.
3. Confirmar que las funciones auxiliares son `prosecdef` con `search_path=public`.
4. **La prueba que importa:** entrar con un vendedor de prueba e intentar leer el registro
   de otro. Debe devolver cero filas, no un error.

El punto 4 es el único que prueba de verdad que el modelo funciona, y solo se puede hacer a
partir del Tramo 2, cuando exista login. Hasta entonces la verificación es estructural.

---

## Puntos abiertos

- Alta de perfiles: trigger sobre `auth.users` o creación manual por la oficina.
- Si `perfiles` lleva `created_by`, que §16 exige en todas las tablas.
- Qué ve exactamente `administracion` en `visitas` cuando llegue la bandeja de cotizaciones.
