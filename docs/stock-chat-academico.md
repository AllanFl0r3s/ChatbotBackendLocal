> Actualización del 10/11/2026: esta guía conserva la primera prueba con productos genéricos. El catálogo vigente ya usa productos del PDF de Istmania. Ver [catálogo académico actualizado](catalogo-istmania-demo.md) y las versiones 09/10 en database/azure. Las preguntas sobre arroz o detergente genérico de la prueba inicial se sustituyeron por las marcas del catálogo.

# Primeras preguntas de stock con datos académicos

## Estado al 10 de noviembre de 2026

**Aplicado y comprobado en DW_ISTMA de Azure mediante el editor de consultas del portal.** Se crearon las dos vistas, se registró la migración 002 y se concedió SELECT únicamente sobre ellas al usuario limitado chatbot_web. Los seis productos y sus cantidades originales se conservaron.

Se volvieron a comprobar en Azure los seis productos y las doce existencias, sus totales y el acceso de lectura del backend mediante EXECUTE AS USER y REVERT. SSMS falló por error de transporte TCP 121; el editor web sí permitió completar las consultas y los cambios. No se cambió el firewall durante este trabajo.

## Qué falta para que el chat lea el inventario

El servicio heredado consulta dos vistas dbo con nombres concretos, no las tablas academico directamente. El archivo 06 crea esas vistas sobre los productos y existencias ficticios actuales. No copia una base empresarial ni modifica los SKU DEMO.

| Producto ficticio | SKU académico conservado | Alias de compatibilidad inventado | Total esperado de la semilla |
|---|---|---|---:|
| Agua purificada 600 ml | DEMO-AGUA | PT990000001 | 135 |
| Bebida cítrica 1 litro | DEMO-BEBIDA | PT990000002 | 10 |
| Arroz bolsa 1 kg | DEMO-ARROZ | PT990000003 | 85 |
| Frijol bolsa 900 g | DEMO-FRIJOL | PT990000004 | 2 |
| Detergente en polvo 500 g | DEMO-DETERGENTE | PT990000005 | 53 |
| Jabón en barra 125 g | DEMO-JABON | PT990000006 | 212 |

Los alias PT son ficticios para pasar el filtro PT/SE/ME del código existente. Solo se incluyen estos seis productos; futuros productos necesitarán una nueva migración o un adaptador de inventario académico. Las dos vistas muestran productos y bodegas activos, y conservan las existencias con valor cero.

## Orden de ejecución, cuando funcione la conexión

1. Seleccionar DW_ISTMA de sql-chatbot-allanflores-2026.database.windows.net. Comprobar SELECT 1 antes de ejecutar cambios.
2. Ejecutar 05b_inspeccionar_stock_azure.sql para revisar los productos actuales y las versiones aplicadas.
3. Ejecutar 06_DW_ISTMA_stock_chat.sql. Rechaza destinos distintos del Azure académico, objetos existentes sin registrar y una versión 002 reservada para otro cambio. La creación es transaccional y repetir la misma versión no reemplaza vistas ni duplica productos.
4. Revisar/autorizar 08_DW_ISTMA_permiso_lectura_stock.sql: concede SELECT únicamente sobre las dos vistas al usuario chatbot_web. No cambia su contraseña ni da permisos para escribir o administrar tablas.
5. Ejecutar 07_DW_ISTMA_verificar_stock_chat.sql. Comprueba los seis totales, las doce existencias y la lectura mediante el usuario limitado.
6. En el frontend público, iniciar sesión y entrar al chat. Empezar con «menu» para limpiar el contexto anterior, escribir «stock de agua» y elegir la opción 1 para ver el detalle. Repetir «menu» antes de una consulta independiente.

## Preguntas iniciales

- stock de agua → lista el agua con 135 unidades; 1 muestra 120 en bodega central y 15 en bodega de ruta.
- stock PT990000003 → muestra el arroz con 85 unidades, repartidas en 80 y 5.
- stock de detergente → 53 unidades.
- stock de producto inexistente → respuesta sin resultados; no debe inventar productos.

Estas frases usan detectores por reglas ya presentes en OpenAiService y respuestas calculadas desde SQL. No necesitan una petición a OpenAI. Las frases fuera de esas reglas o flujos distintos pueden llamar al servicio externo, cuya clave de demostración no habilita IA. Este avance no implementa ventas, promociones, pedidos, proyecciones ni notas de crédito.

## Validación realizada y pendiente

Se verificó la sintaxis SQL Server 2016 de la migración Azure y de sus tandas dinámicas, incluidas ambas definiciones de vista. La verificación 07 pasó en el motor Azure. Además, se ejecutó el código real de ChatService, InventoryService y los detectores de OpenAiService con repositorios simulados: agua, selección por número, arroz por código, detergente y producto inexistente respondieron correctamente. En esa prueba se forzó un error si el código intentaba llamar a OpenAI o a moderación externa; ninguna llamada fue necesaria.

La prueba HTTP real contra https://chatbotbackendlocal-1.onrender.com terminó correctamente:

- Health 200; registro de una única cuenta ficticia 201; login como USUARIO 201. Contraseña y JWT generados solo en memoria, sin imprimirlos ni guardarlos.
- «stock de agua»: código PT990000001, total 135.
- «1» después del listado: agua con 120 en bodega central y 15 en bodega de ruta.
- «menu», luego «stock PT990000003»: arroz con 85, repartidas en 80 y 5.
- «menu», luego «stock de detergente»: total 53.
- «menu», luego «stock de producto inexistente»: respuesta sin resultados, sin inventar un producto.
- Logout 204 al terminar. La cuenta ficticia de comprobación permanece como usuario normal; no se le asignaron rutas ni permisos administrativos.

La prueba se completó tras usar resolución DNS IPv4 primero en la terminal. Los intentos anteriores de health desde esa terminal agotaron su tiempo de espera; el navegador también confirmó health correcto. Esto no certifica conectividad desde todas las redes ni tiempos de respuesta estables.

Los archivos se guardaron también en database/azure del backend. No se cambió la configuración de Render ni de Vercel y no se enviaron archivos a GitHub.
