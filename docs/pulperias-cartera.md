# Cincuenta pulperías con cartera de demostración

Se preparan cincuenta pulperías ficticias, cinco para cada vendedor S01 a S10, en sus rutas de Cortés, zona NORTE. Cada pulpería tiene un código público único CLI-001 a CLI-050 y conserva un ID interno de base de datos. La relación comercial entre cliente, vendedor y ruta queda registrada en `academico.VendedorClientes`; no se crean cuentas de acceso.

## Distribución

| Vendedor y ruta | Sector | Códigos de pulperías |
|---|---|---|
| S01 | San Pedro Sula | CLI-001 a CLI-005 |
| S02 | Choloma | CLI-006 a CLI-010 |
| S03 | Villanueva | CLI-011 a CLI-015 |
| S04 | Puerto Cortés | CLI-016 a CLI-020 |
| S05 | La Lima | CLI-021 a CLI-025 |
| S06 | San Manuel | CLI-026 a CLI-030 |
| S07 | Pimienta | CLI-031 a CLI-035 |
| S08 | Potrerillos | CLI-036 a CLI-040 |
| S09 | Omoa | CLI-041 a CLI-045 |
| S10 | San Antonio de Cortés | CLI-046 a CLI-050 |

Los nombres son La Bendición, El Ahorro, Doña Rosa, El Buen Vecino y La Esperanza, acompañados del municipio. Son ejemplos y no identifican establecimientos reales.

## Cartera ficticia de cada vendedor

Cada pulpería tiene un documento. Se conservan los veinte documentos anteriores y se agregan treinta. Los números de facturas anteriores conservan su código original para no alterar sus referencias; el código actual de la pulpería aparece por separado.

| Posición en la ruta | Nombre | Monto | Pagado | Saldo | Vencimiento |
|---|---|---:|---:|---:|---|
| 1 | La Bendición | L 1000 | L 200 | L 800 | 15/11/2026 |
| 2 | El Ahorro | L 600 | L 100 | L 500 | 01/12/2026 |
| 3 | Doña Rosa | L 1500 | L 500 | L 1000 | 20/11/2026 |
| 4 | El Buen Vecino | L 900 | L 0 | L 900 | 15/12/2026 |
| 5 | La Esperanza | L 700 | L 700 | L 0 | 10/11/2026 |

El saldo pendiente es L 3200 por vendedor y L 32000 en total. Al 27/11/2026 hay L 1800 vencidos y L 500 próximos a vencer por ruta. La clasificación cambia con la fecha real de Honduras. La pulpería con saldo cero no aparece como documento pendiente; su factura pagada permanece en la base.

## Preservación de los datos anteriores

Se reutilizan los veinte clientes CORT y trece clientes DEMO activos, conservando sus IDs internos y las relaciones de ventas, pedidos, notas y visitas. Se crean diecisiete clientes adicionales. DEMO011 permanece inactivo y sin cambios como caso histórico; no forma parte de las cincuenta pulperías.

Los clientes trasladados conservan su pertenencia histórica hasta el 26/11/2026 y tienen su asignación actual desde el 27/11/2026. Los que permanecen en su ruta conservan esa pertenencia. No se cambian ventas ni importes o pagos existentes. La asignación actual no reescribe el vendedor de operaciones históricas.

El cliente antes llamado DEMO001 ahora es CLI-038, Pulpería Doña Rosa de Potrerillos, en S08. Conserva el historial de compras y notas de crédito anteriores. DEMO002 ahora es CLI-039 y permite probar ausencia de compras. Después de la actualización, escribir `menu` para iniciar una consulta con los nuevos códigos; las conversaciones anteriores pueden conservar los nombres antiguos.

## Cómo probar

Con una cuenta asignada a S01 desde Administración, enviar `menu` antes de cada recorrido.

- `8` → `1`: cinco pulperías CLI-001 a CLI-005.
- `7` → `1`: cuatro documentos pendientes y saldo L 3200.
- `7` → `2`: documentos vencidos de La Bendición y Doña Rosa al 27/11/2026.
- `7` → `3`: muestra los nombres y códigos de la ruta; escribir `CLI-001` para consultar L 800.
- `7` → `3` → `CLI-005`: sin documentos con saldo pendiente.
- `9` → `CLI-001` → `4`: promoción de agua 6+1 mientras esté vigente.
- Para historial de compras, usar una cuenta de S08: `10` → `2` → `CLI-038` → `1/11/26 - 5/11/26`.

## Aplicar en Azure

Ejecutar en **DW_ISTMA**, después de 011, el archivo `database/academic/013_cincuenta_pulperias.sql`. La migración se detiene si encuentra una muestra personalizada o una versión ocupada; repetirla no restaura nombres, saldos ni asignaciones. Comprobar después con `database/academic/014_verificar_pulperias.sql`.

El archivo entregable `Pulperias_50_con_cartera.sql` reúne 011 y 013, por si todavía no se había aplicado 011. Requiere los vendedores y la zona NORTE de 008 y 009. Después, el propietario hace commit y push del backend para publicar la ayuda que muestra códigos reales en la consulta de cartera.

Los cambios se aplicaron únicamente en SQL local. No se ejecutó este cambio en Azure ni se hizo commit o push.

## Verificación

Migración ejecutada dos veces y archivo combinado comprobado sin duplicados. Verificaciones SQL 005, 012 y 014 aprobadas. Compilación Nest y 196 pruebas Jest aprobadas. Las pruebas HTTP comprueban los nuevos códigos, clientes de otra ruta, cartera pagada, preservación de historial y las cinco pulperías y cartera de cada uno de los diez vendedores. Las cuentas desechables se retiran al finalizar.
