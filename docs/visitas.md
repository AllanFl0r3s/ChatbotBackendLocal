# Consulta de clientes con registros de visita

GET /visits/clients?route=S08&date=2026-11-02&page=1&pageSize=50

Requiere el JWT existente de la aplicación. Lee paco.APP_RV mediante
prodConnection, configurada con PROD_DB_* o las variables legacy DB_*2.
La conexión empresarial requiere red interna o VPN.

La ruta se autoriza mediante una asignación explícita del lado del servidor:

```dotenv
VISITS_ROUTE_ACCESS='{"12":["S08"]}'
```

12 es un ID_USUARIO ficticio de ejemplo, no una cuenta de SQL. Solo se deben
asignar rutas autorizadas. El valor por defecto {} deniega todas las rutas.
La identidad y permisos de PACO deberán definirse antes de integrar ese sistema.

La respuesta incluye clientes distintos, registros por cliente, totales,
paginación y queriedAt (instante de consulta, no sincronización de la fuente).
No interpreta CodigoRevision ni EnRuta y no acredita venta o visita completada.
Se excluyen códigos de cliente vacíos. Una falla SQL responde 503, no cero visitas.

Se usa TRY_CAST y ROW_NUMBER por compatibilidad 100 de DW_ISTMA. La consulta
recibe parámetros separados del SQL y no modifica tablas ni vistas.
La conversión de fechas de texto puede requerir recorrer muchos registros;
conviene medir el rendimiento con la carga empresarial antes de ampliar el uso.

Validación:

```powershell
npm run build
npm test -- --runInBand visits.spec.ts
node --experimental-strip-types --test test/visits.core.test.cjs
```

La última prueba requiere Node.js 22.18 o superior. Las pruebas automatizadas
simulan SQL. En la validación manual con datos empresariales, la ruta S08 del
2026-11-02 devolvió HTTP 200, 9 clientes y 13 registros, coincidiendo con SSMS.
Los resultados pueden cambiar cuando se actualiza la fuente.
