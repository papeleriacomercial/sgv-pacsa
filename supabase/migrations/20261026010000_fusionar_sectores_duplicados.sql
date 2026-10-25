-- ===========================================================================
-- FUSIONAR LOS CUATRO SECTORES ESCRITOS DE DOS FORMAS
--
-- Lo autorizó el usuario el 25 de octubre de 2026, después de verlos medidos:
-- *«puedes fusionar las categorías que mencionas en el punto 1»*.
--
--   «Almacén»    30  +  «Almacen»    28   =  58 cuentas
--   «Farmacia»    9  +  «Farmacias»  34   =  43 cuentas
--   «Panadería»  15  +  «Panaderia»  14   =  29 cuentas
--   «Cafeteria»   4  +  «Cafetería»   3   =   7 cuentas
--
-- ---------------------------------------------------------------------------
-- NO SON CUATRO FUSIONES IGUALES, Y ESO SE DESCUBRIÓ FALLANDO
-- ---------------------------------------------------------------------------
--
-- La primera versión trataba los cuatro pares igual: mover las cuentas al
-- nombre bueno y dar de baja la fila que sobra. **Su propia comprobación la
-- detuvo y no aplicó nada**, lo cual es exactamente para lo que estaba.
--
-- Lo que destapó: **el catálogo no tiene las formas con acento.** Tiene
-- «Almacen» y «Cafeteria» sin tilde, y 30 cuentas escritas «Almacén» y 3
-- escritas «Cafetería» apuntan a un nombre que el catálogo no conoce. Así que
-- ahí no hay dos filas que fusionar: hay **una fila mal escrita** y cuentas
-- repartidas entre las dos grafías.
--
-- Por eso cada caso va escrito aparte en vez de en un bucle. Un bucle que
-- parece cubrir cuatro casos iguales cuando son tres distintos es peor que
-- cuatro bloques explícitos.
--
--   · «Almacen» y «Cafeteria»  → se **renombra el catálogo** con su tilde, y
--                                 las cuentas de las dos grafías se juntan ahí.
--   · «Farmacias»              → hay dos filas de verdad: se **fusiona** y la
--                                 que sobra se da de baja.
--   · «Panaderia»              → la fila buena ya existe y la mala **nunca
--                                 estuvo en el catálogo**: sólo hay que mover
--                                 las 14 cuentas.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ UNA MIGRACIÓN Y NO LA PANTALLA
-- ---------------------------------------------------------------------------
--
-- La pantalla existe —Cuentas → Tipos de comercio— y hace exactamente esto. Lo
-- que no se puede es llamarla desde una tarea: `fusionar_categoria` empieza
-- comprobando `puede_depurar_catalogo()`, que mira el rol de quien pide, y una
-- tarea automática no es nadie. Esto replica lo que hacen `renombrar_categoria`
-- y `fusionar_categoria`; si algún día cambian, hay que saber que esto las
-- copió una vez.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ EXISTÍAN, Y POR QUÉ VA A VOLVER A PASAR CON LOS PLURALES
-- ---------------------------------------------------------------------------
--
-- El índice único compara con `normalizar_texto()`, que quita acentos. Por eso
-- «Almacén» y «Almacen» no podrían entrar los dos **al catálogo** — y de hecho
-- no entraron: sólo está uno. Lo que no estaba defendido era el texto de la
-- cuenta.
--
-- Pero «Farmacia» y «Farmacias» **sí pueden coexistir y van a volver**:
-- `normalizar_texto` no toca los plurales, así que para el índice son dos cosas
-- distintas. No se arregla acá a propósito —quitar la «s» final rompería
-- cualquier sector que de verdad termine en «s»— y queda dicho para que, cuando
-- reaparezca, nadie lo persiga como un defecto nuevo.
--
-- **El destino no se eligió por tamaño sino por cómo se escribe.** «Farmacias»
-- tiene 34 cuentas contra 9 y aun así gana «Farmacia»: los sectores del catálogo
-- están en singular —Banco, Bar, Panadería— y mezclar singulares con plurales se
-- lee como categorías distintas. Mover cuentas no cuesta nada; una lista
-- inconsistente se arrastra para siempre.
--
-- **Lo que NO entra:** «FAR» (1 cuenta, casi seguro una farmacia), «Elisa» (1,
-- un nombre de persona) y los otros doce sectores de una sola cuenta. El usuario
-- autorizó el punto 1 y nada más; adivinar los demás sería decidir por él.
-- ===========================================================================

do $$
declare
  movidas integer;
  renombradas integer;
begin
  -- -------------------------------------------------------------------------
  -- 1. «Almacen» → «Almacén». Renombrar el catálogo y juntar las dos grafías.
  --
  -- El renombre no choca con el índice único: las dos formas normalizan a
  -- `almacen`, así que la fila se renombra sobre sí misma.
  -- -------------------------------------------------------------------------
  update public.categorias_comercio
     set nombre = 'Almacén', updated_at = now()
   where nombre = 'Almacen' and deleted_at is null;
  get diagnostics renombradas = row_count;
  raise notice 'Catálogo: «Almacen» → «Almacén» (% fila).', renombradas;

  update public.cuentas
     set tipo_comercio = 'Almacén', updated_at = now()
   where deleted_at is null
     and public.normalizar_texto(tipo_comercio) = 'almacen'
     and tipo_comercio <> 'Almacén';
  get diagnostics movidas = row_count;
  raise notice 'Cuentas movidas a «Almacén»: %.', movidas;

  -- -------------------------------------------------------------------------
  -- 2. «Cafeteria» → «Cafetería». El mismo caso.
  -- -------------------------------------------------------------------------
  update public.categorias_comercio
     set nombre = 'Cafetería', updated_at = now()
   where nombre = 'Cafeteria' and deleted_at is null;
  get diagnostics renombradas = row_count;
  raise notice 'Catálogo: «Cafeteria» → «Cafetería» (% fila).', renombradas;

  update public.cuentas
     set tipo_comercio = 'Cafetería', updated_at = now()
   where deleted_at is null
     and public.normalizar_texto(tipo_comercio) = 'cafeteria'
     and tipo_comercio <> 'Cafetería';
  get diagnostics movidas = row_count;
  raise notice 'Cuentas movidas a «Cafetería»: %.', movidas;

  -- -------------------------------------------------------------------------
  -- 3. «Farmacias» → «Farmacia». Acá sí hay dos filas, y la que sobra se va.
  -- -------------------------------------------------------------------------
  update public.cuentas
     set tipo_comercio = 'Farmacia', updated_at = now()
   where deleted_at is null
     and public.normalizar_texto(tipo_comercio) = 'farmacias';
  get diagnostics movidas = row_count;
  raise notice 'Cuentas movidas a «Farmacia»: %.', movidas;

  update public.categorias_comercio
     set deleted_at = now(), updated_at = now()
   where nombre = 'Farmacias' and deleted_at is null;
  get diagnostics renombradas = row_count;
  raise notice 'Catálogo: «Farmacias» dada de baja (% fila).', renombradas;

  -- -------------------------------------------------------------------------
  -- 4. «Panaderia» → «Panadería». La fila buena ya existe y la mala nunca
  --    estuvo en el catálogo: sólo se mueven las cuentas.
  -- -------------------------------------------------------------------------
  update public.cuentas
     set tipo_comercio = 'Panadería', updated_at = now()
   where deleted_at is null
     and public.normalizar_texto(tipo_comercio) = 'panaderia'
     and tipo_comercio <> 'Panadería';
  get diagnostics movidas = row_count;
  raise notice 'Cuentas movidas a «Panadería»: %.', movidas;

  -- -------------------------------------------------------------------------
  -- LAS DOS COMPROBACIONES, DENTRO DE LA MISMA TRANSACCIÓN
  --
  -- Si algo no quedó como debía, esto revienta y **no se aplica nada** — en vez
  -- de dejar el catálogo a medio fusionar, que es el estado más difícil de
  -- diagnosticar después. Es lo que detuvo la primera versión.
  -- -------------------------------------------------------------------------
  if exists (
    select 1 from public.cuentas
     where deleted_at is null
       and public.normalizar_texto(tipo_comercio) in ('almacen', 'farmacias', 'panaderia', 'cafeteria')
       and tipo_comercio not in ('Almacén', 'Farmacia', 'Panadería', 'Cafetería')
  ) then
    raise exception 'Quedaron cuentas con una grafía vieja. No se aplicó nada.';
  end if;

  if (
    select count(*) from public.categorias_comercio
     where nombre in ('Almacén', 'Farmacia', 'Panadería', 'Cafetería')
       and deleted_at is null
  ) <> 4 then
    raise exception
      'Los cuatro sectores buenos tienen que quedar activos en el catálogo, y no quedaron. No se aplicó nada.';
  end if;
end $$;
