# Las seis opciones del menú — datos académicos

Actualización: 14 de noviembre de 2026. Implementado y probado localmente. La migración 004 también se aplicó en DW_ISTMA de Azure y se verificaron las vistas con el usuario limitado chatbot_web. **El código nuevo aún no está publicado en Render/Vercel:** la verificación SQL de Azure no sustituye la prueba HTTP posterior al despliegue.

## Cambios

- Se agregan siete tablas académicas de vendedores, pedidos/detalles, ventas, proyecciones, notas y promociones, con datos ficticios relacionados con los seis productos existentes y los clientes DEMO001/DEMO002.
- Nueve vistas (incluida la correspondencia del catálogo) permiten consultar esas tablas desde los servicios existentes. Los ocho objetos de compatibilidad públicos conceden únicamente SELECT al usuario existente chatbot_web; no se le dan permisos de escritura ni DDL.
- La migración no reemplaza objetos existentes, existencias, cuentas, contraseñas ni la base CHATBOT. Rechaza destinos ajenos al Azure académico conocido o SQLEXPRESS local marcado. Opera dentro de una transacción y repetirla no duplica ni restaura los datos.
- Se corrige la búsqueda de nombres con/sin tilde, el número de pedido dentro de su paso guiado, la elección de vendedor y período, y la resolución de categorías parciales antes de consultar sus ventas.
- Si falla una fuente SQL, el endpoint devuelve 503 con mensaje genérico en lugar de exponer detalles internos. No inventa una respuesta correcta ante un error de conexión.
- Las frases no reconocidas vuelven al menú. La clasificación externa requiere OPENAI_ENABLED=true y una clave propia válida; por defecto no se usa. El recorrido guiado de las seis funciones funciona sin OpenAI.
- El frontend muestra que los datos y promociones son ficticios y no tienen validez comercial.

## Preparar las bases

La migración está en database/academic/004_menu_completo.sql del backend y su copia exacta en database/migrations/004_menu_completo.sql del frontend. El verificador de solo lectura está en database/academic/005_verificar_menu.sql y en database/tests/005_menu_completo.sql, respectivamente.

Se requiere el esquema académico 001, la semilla inicial y las vistas de stock 002. En Azure se conserva además el catálogo 003 ya aplicado; no hay que volver a aplicar ni recrear esas versiones. La correspondencia de productos admite los SKU genéricos iniciales y los SKU del catálogo actualizado de Azure.

Seleccionar **DW_ISTMA** en la instancia académica y ejecutar 004 completo, sin seleccionar fragmentos. Después ejecutar 005 completo. No ejecutar sobre servidores de la empresa ni quitar las comprobaciones de destino/marca para forzarlo. Un nombre de objeto en conflicto se investiga, no se elimina para continuar.

**Aplicado el 14/11/2026:** 004 en SQL local; repetición local sin duplicados; verificador 005 correcto. En Azure se comprobó previamente versión 003, seis productos DEMO y cero conflictos; se ejecutó la misma migración y las comprobaciones de conteos, fórmulas y lectura como chatbot_web fueron correctas. No se cambió el firewall ni se copiaron datos empresariales.

## Datos de referencia

Las ventas y proyecciones principales corresponden a **noviembre de 2026**; también hay una venta de octubre para comprobar el filtro. Las cantidades no son datos reales de Istmania.

| Caso | Resultado esperado |
|---|---|
| Stock PT990000001 | 135 unidades: 120 central + 15 en ruta. |
| Pedido 0001001 | 24 unidades de PT990000001 y 2 de PT990000005: 26 UN. |
| Pedido 0001002 | 12 unidades de PT990000002. |
| Venta PT990000001, noviembre 2026 | L 502.50 netos. |
| Venta PT990000001, octubre 2026 | L 143.75 netos. |
| Ventas vendedor DEMO01, noviembre 2026 | L 1,772.00 netos. |
| Proyección PT990000001, noviembre 2026 | 15 cajas; equivalencia ficticia de 12 unidades por caja. |
| Proyección PT990000001, DEMO01 o zona NORTE | 10 cajas; DEMO02/SUR: 5 cajas. |
| Notas DEMO001 | NC-DEMO-001 de L 50 y NC-DEMO-002 de L 25: L 75 total. |
| Notas DEMO002 | Una nota de L 40. |
| Promociones en noviembre 2026 | Tres: alias de productos 001, 002 y 005. Se excluyen una expirada, una futura y una inactiva. |

Las promociones activas se filtran por la fecha actual de Honduras y terminan el 30/11/2026. En diciembre los resultados cambian conforme a la vigencia; no se deben mantener ofertas vencidas para que una prueba pase. El script 005 contrasta la semilla con la fecha de referencia fija 14/11/2026. Las pruebas HTTP de promociones están preparadas para noviembre de 2026.

En Azure los nombres son Quartz, Plata Lite, Vitalit, Dropp y 220. Localmente se conservan los ejemplos genéricos. Por eso los totales de categoría también difieren (Bebidas demo local: L 732.50; Bebidas sin alcohol demo de Azure: L 1,231.60). Los códigos, ventas por producto, pedidos y proyecciones mantienen los mismos valores.

## Probar en el chat

Enviar cada mensaje por separado. Empezar con `menu` antes de un recorrido independiente.

| Opción | Mensajes después de menu |
|---|---|
| 1. Stock | `1` → `agua` (local) o `Quartz 600ml` (Azure) → `1`. También `stock PT990000001` devuelve el detalle directamente. |
| 2. Pedido | `2` → `0001001`. Otro número de 6–15 dígitos consulta otro pedido; conserva ceros iniciales. |
| 3. Ventas de producto | `3` → `1` → `PT990000001` → `3` → `noviembre 2026`. |
| 3. Ventas de vendedor | `3` → `2` → `DEMO01` → `3` → `noviembre 2026`. |
| 3. Ventas de categoría | `3` → `3` → `1` → `Bebidas` → `3` → `noviembre 2026`. Si hay varias categorías, escribir el nombre completo solicitado. |
| 4. Proyección por producto | `4` → `1` → `PT990000001` → `noviembre 2026`. |
| 4. Proyección por vendedor | `4` → `2` → `DEMO01` → `PT990000001` → `noviembre 2026`. |
| 4. Proyección por zona | `4` → `3` → `NORTE` → `PT990000001` → `noviembre 2026`. |
| 5. Notas de crédito | `5` → `1` para listar; o `5` → `2` → `DEMO001` para ver sus notas. |
| 6. Promociones | `6` → `1` para consultar stock de la primera; `mensaje 1` desde el listado prepara texto de demostración, sin enviarlo a nadie. |

## Pruebas y publicación

En el backend:

```powershell
npm.cmd run build
npm.cmd test -- --runInBand
node test/menu-academic.integration.cjs
```

El verificador HTTP usa por defecto localhost:3021 y la cuenta local documentada de demostración; escribe únicamente mensajes/sesiones de esa cuenta, por lo que debe dedicarse a pruebas. No crea cuentas ni modifica datos comerciales. Para usar otra cuenta, configurar privadamente CHATBOT_TEST_IDENTIFIER y CHATBOT_TEST_PASSWORD. Para la app pública configurar también CHATBOT_TEST_BASE_URL=https://chatbotbackendlocal-1.onrender.com. No guardar contraseñas en Git ni pegar tokens en evidencias.

Antes de cerrar el avance público:

1. Hacer commit/push del backend con estos cambios y del frontend con el aviso/documentación; no incluir .env, node_modules ni dist.
2. La migración 004 de Azure ya está aplicada; no recrear bases ni ejecutar la semilla inicial. Si el entorno fuera nuevo, usar 004 y 005 en DW_ISTMA antes de probar.
3. En Render, publicar el commit nuevo de main. Mantener las conexiones Azure, el usuario limitado y las variables privadas actuales. OPENAI_ENABLED puede quedar ausente o false: no se necesita una clave de pago para estos recorridos.
4. Esperar Live y verificar health; publicar también el frontend en Vercel y confirmar el aviso de demostración.
5. Iniciar sesión con una cuenta pública de prueba y repetir los recorridos. La presencia de las tablas en Azure no demuestra por sí sola que el código actualizado esté ejecutándose en Render.

## Límites

Validación final del 14/11/2026: backend compilado y **122 pruebas Jest aprobadas en 10 suites**; **24 recorridos HTTP locales correctos**, más logout/revocación; frontend compilado en configuración cloud y **14 pruebas de configuración/sesión aprobadas**. La compilación conserva advertencias de tamaño de estilos. Se confirmó también en navegador el aviso de datos ficticios y el pedido 0001001 con 26 UN. La cuenta de la interfaz es de demostración; no se usó una cuenta empresarial.

El propietario eligió hacer los commits y el push personalmente. Los cambios permanecen en ambos repositorios sin confirmar ni publicar. Las pruebas HTTP contra el código nuevo de Render siguen pendientes hasta ese paso y el despliegue.

Las operaciones comerciales son consultas de demostración, no creación de pedidos, contabilización de notas, edición de ventas ni predicciones generadas por IA. Las proyecciones provienen de registros SQL ficticios. Los subflujos de ventas por producto/vendedor se validan por mes y año; el rango libre por producto no forma parte de este avance. No se certifica interpretación de cualquier frase arbitraria. Las pruebas con personas reales y la decisión sobre H3 siguen pendientes.
