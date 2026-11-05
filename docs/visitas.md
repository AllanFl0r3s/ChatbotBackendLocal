# Clientes con registros de visita: entorno académico

GET /visits/clients?route=S08&date=2026-11-05&page=1&pageSize=5

Esta copia académica usa por defecto academico.Visitas, academico.Clientes y
academico.Rutas en DW_ISTMA local, mediante prodConnection. El nombre heredado
prodConnection no implica que se esté conectando a la empresa: el destino lo
establece PROD_DB_HOST=127.0.0.1, puerto 14330, base DW_ISTMA.

## Requisitos de datos

Aplicar migración 001 y semilla 001 del directorio database del repositorio
Frontend-Chatbot. Ambas ya se ejecutaron y comprobaron localmente el 5 de noviembre.
No volver a crear las bases ni copiar datos empresariales para probar esta consulta.

La configuración del backend admite dos fuentes explícitas:

- VISITS_DATA_SOURCE=academic: tablas nuevas, fecha fija de la semilla 2026-11-05.
  Es el valor por defecto si la variable no está definida.
- VISITS_DATA_SOURCE=legacy: paco.APP_RV y sus datos/fechas originales. Este modo no
  copia ni convierte registros al esquema nuevo.
- Cualquier otro valor produce 503. No hay fallback silencioso entre fuentes.

La selección depende solo de la configuración del servidor, nunca de una URL.
No requiere OpenAI. .env.example documenta los valores; no sobrescribir un .env
existente ni publicar sus secretos.

## Autorización y contrato

Se requiere el JWT de la aplicación. La identidad viene del token validado y
VISITS_ROUTE_ACCESS define las rutas asignadas en el servidor. Para admin.local,
ID 1 en la base de demostración, el ejemplo local asigna S08 y S09. Tener rol de
administrador no omite este control. Sin asignación, responde 403.

La respuesta conserva route, date, totalClients, totalVisitRecords, clients,
pagination, queriedAt y description. Los clientes incluyen clientCode y
visitRecords. Una página fuera de rango conserva los totales y devuelve clients
vacío. Una fecha sin visitas devuelve cero; un fallo SQL devuelve 503.

FechaHora de academico.Visitas es UTC. date representa el día de Honduras UTC-6.
Por eso la consulta convierte la fecha antes de filtrar; no confunde visitas de
las 00:00 locales con registros de la tarde del día anterior. La conversión por
fila es apropiada para esta demostración pequeña; medir su costo antes de usarla
con un volumen mayor y considerar límites UTC sobre el índice para esa evolución.
No se une ClienteRuta al contar: múltiples asignaciones no multiplican visitas.

No se interpreta CodigoRevision ni EnRuta como venta o visita completada. Tampoco
se filtran clientes históricos por su estado actual: los registros se conservan.

## Prueba manual

1. Iniciar este backend en 3021 y el frontend local en 4200.
2. Iniciar sesión con la cuenta de demostración y abrir Visitas desde el chat o
   administración. También se puede probar GET /visits/clients en Swagger.
3. S08, 2026-11-05, pageSize=5: 9 clientes, 13 registros y dos páginas (5 y 4).
4. S09 el mismo día: 3 clientes y 3 registros.
5. S08, 2026-11-03: lista y totales vacíos.
6. Ruta sin asignación: 403. Sin JWT o con token vencido: 401.

## Validación realizada el 5 de noviembre de 2026

- npm run build: correcto.
- npm test -- --runInBand visits.academic.spec.ts: 7 pruebas correctas, sin puertos.
- node --test test/visits.core.test.cjs: 10 pruebas correctas.
- SQL exacto del adaptador ejecutado en SSMS contra DW_ISTMA: pasaron paginación
  de 5/4 clientes, aislamiento S09, fecha sin visitas y página fuera de rango.
- Prueba temporal con cuatro registros al borde de medianoche: incluye desde
  06:00 UTC hasta antes de 06:00 UTC del día siguiente; se revirtieron sus filas.

Las cinco pruebas HTTP de visits.spec.ts se intentaron pero fallaron por
connect EACCES de la terminal restringida. La conexión TypeORM desde esa terminal
también quedó bloqueada (ESOCKET). No se presenta como verificado el recorrido
navegador -> HTTP -> SQL. Ejecutar las pruebas HTTP desde la terminal habitual y
completar la prueba manual después de importar el cambio.

No se cambió el backend empresarial ni se hicieron escrituras de negocio desde
este endpoint. La URL pública de Vercel sigue siendo una vista previa de interfaz.