# Historial y promociones sugeridas — adaptación académica

Avance del 23 de noviembre de 2026. Se reutiliza el comportamiento del chatbot del trabajo, adaptando las consultas a datos ficticios de la universidad. No se copiaron clientes, ventas, claves ni asignaciones empresariales.

## Estado comprobado

- Opción 10: última compra, productos por período, frecuencia e inactividad. Respuestas breves y continuación con «más» o «siguientes».
- Opción 9: promociones de SQL académico, historial, stock, vencimiento y mensaje para copiar. No envía mensajes a terceros.
- Bonificaciones: el esquema académico no registra cantidades mínimas ni unidades de regalo; el bot lo explica sin inventarlas.
- Opción 7: pendiente de adaptación; no existía cartera en esta copia académica.
- Opción 8: integración al chat pendiente. La pantalla y el endpoint de Visitas existentes se conservan.
- Opciones 1 a 6, registro, recuperación, roles y revocación de sesiones: conservan sus implementaciones académicas.

Backend compilado; **137 pruebas Jest** aprobadas. Se completaron **22 comprobaciones HTTP contra SQL local real**, incluyendo login, rutas, las opciones nuevas, paginación y logout. La migración 006 se aplicó localmente y se repitió sin duplicar cambios. **La migración 006 también se aplicó en Azure el 23/11/2026 desde su editor de consultas. Render todavía no se actualizó ni validó con este código.**


Verificación de Azure: base DW_ISTMA marcada como DEMOSTRACION AZURE - DATOS FICTICIOS; versión 006 registrada una sola vez; 6 productos, 13 relaciones de cliente/ruta, 8 registros y 6 productos comprados por DEMO001 en S08, y 3 promociones vigentes al 23/11/2026. Se ejecutó la lectura como chatbot_web y se comprobaron los tres permisos SELECT. No se insertaron ventas ni existencias. Esto verifica la base y sus permisos; la prueba HTTP del backend público sigue pendiente.

## Datos y permisos

Se reutilizan las seis referencias y las ventas de demostración existentes: no se carga inventario adicional. DEMO001 tiene ocho registros y seis productos, con última compra el 05/11/2026. DEMO002 permite comprobar ausencia de compras. Un resultado vacío es distinto de una falla de conexión.

El chat reutiliza `VISITS_ROUTE_ACCESS`: la primera ruta autorizada de la cuenta es su ruta principal. Por ejemplo, con `["S08","S09"]`, se usa S08; para otra autorizada se escribe «en ruta S09». No se conceden permisos por ser administrador. El JWT académico sigue comprobando usuario, rol y sesión vigentes.

La copia académica no tiene un código de ruta en cada venta. Se consulta el historial de los clientes asignados actualmente a la ruta, incluyendo sus operaciones anteriores. No se infiere que DEMO01 sea S08 ni que DEMO02 sea S09. Las relaciones duplicadas o superpuestas de ClienteRuta no multiplican ventas porque la vista usa EXISTS.

Cada fila de academico.Ventas cuenta como **registro**, no como factura comercial ni transacción única. Las cantidades son unidades de la demostración; no se inventan números de factura. La última compra identifica el registro como DEMO-VENTA-ID.

Las promociones ficticias del esquema son por producto, sin restricciones de cliente. Se filtran Activa, Desde, Hasta y producto activo. El stock debe ser positivo para sugerirlo en la opción 3; no es una reserva. La tabla no registra una fecha de actualización del catálogo y el bot no presenta la fecha de consulta como si lo fuera.

## Azure: actualización aplicada

La ejecución del 23/11/2026 ya está completada. Estos pasos quedan como referencia para otros entornos académicos preparados:

1. En SSMS o el portal de Azure, conectar al servidor académico y seleccionar **DW_ISTMA**.
2. Ejecutar completo `database/academic/006_historial_promociones.sql` con una cuenta administradora de esa base.
3. Ejecutar `database/academic/007_verificar_historial.sql`, que es de solo lectura.
4. Publicar después el código del backend en Render, conservando sus variables de Azure y `VISITS_ROUTE_ACCESS`. No copiar el .env local a Render.
5. Repetir los ejemplos con una cuenta de demostración autorizada.

006 requiere la migración 004 existente. Agrega tres vistas y SELECT para chatbot_web, sin recrear bases, modificar vistas anteriores ni insertar datos. Rechaza servidores ajenos y bases sin marca académica. Una versión ya registrada pero incompleta se detiene para revisión.

Las copias para la entrega del curso están en `database/migrations/006_historial_promociones.sql` y `database/tests/007_historial.sql` del frontend. Son iguales a las del backend. No ejecutar las migraciones antiguas ni sus semillas de nuevo.

## Prueba sencilla

Desde el chat académico, comenzar con «menú principal» antes de cada consulta independiente:

- «¿Cuándo fue la última compra del cliente DEMO001?».
- «¿Qué productos compró el cliente DEMO001 este mes?».
- «¿Qué productos compró el cliente DEMO001 el mes pasado?».
- «¿Qué productos compra con mayor frecuencia el cliente DEMO001?»; después «más».
- «¿Qué clientes de mi ruta llevan 30 días sin comprar?».
- Opción 9 → DEMO001 → 1, 2, 3, 5 o 6. En 6, seleccionar una promoción para preparar el texto.
- Opción 9 → DEMO001 → 4: debe informar que faltan cantidades de bonificación.

Las ofertas iniciales vencen el 30/11/2026. Después de su vencimiento deben dejar de sugerirse; no se alteran fechas para llenar resultados. Los datos históricos permanecen consultables por un período explícito aunque dejen de aparecer en los últimos 180 días.

Desde la raíz del backend:

```powershell
npm.cmd run build
npm.cmd test -- --runInBand
node test/suggestions-academic.integration.cjs
```

La última comprobación inicia una API temporal en un puerto libre y se limita a SQL académico local. Usa la cuenta de demostración admin.local; escribe únicamente su sesión y mensajes, no los datos comerciales. Los casos de ofertas y «este mes» corresponden a noviembre de 2026. No usa Azure ni sustituye las pruebas del despliegue público.

## Leer el código

`src/suggestions` reúne ambos flujos: core contiene reglas de texto y fechas; los repositorios contienen SQL con parámetros; ClientLookupService comparte la selección de clientes; AcademicRouteService reutiliza permisos; los servicios coordinan las preguntas. ChatService solo dirige los mensajes y guarda el contexto. No se añadieron dependencias ni llamadas nuevas a OpenAI.
