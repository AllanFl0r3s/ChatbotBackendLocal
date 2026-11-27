# Cartera rutas de Cortés y promoción navideña

## Actualización de pulperías del 27 de noviembre de 2026

La migración 013 amplía esta muestra a cincuenta pulperías, cinco por vendedor, con códigos CLI-001 a CLI-050 y saldo pendiente L 3200 por ruta. Ver `docs/pulperias-cartera.md` para los códigos y recorridos actuales. Los apartados siguientes describen la preparación anterior de 011 y sus códigos CORT y DEMO, que cambian después de 013.

Las opciones 7 y 8 del chatbot están implementadas con datos ficticios. Usan la ruta asignada a la cuenta desde Administración; el servidor vuelve a comprobar ese permiso en cada mensaje, incluidas paginación, cartera por cliente y consultas de visita. No hay acceso automático a otras rutas para el administrador.

## Rutas de demostración

Esta distribución es una propuesta para la prueba, no una asignación comercial real. Todas las rutas pertenecen a Cortés, zona NORTE. Los códigos de ruta no crean cuentas de acceso ni cambian automáticamente los vendedores de las ventas existentes.

| Ruta | Municipio o sector de referencia | Clientes nuevos |
|---|---|---|
| S01 | San Pedro Sula | CORT-S01-01 y CORT-S01-02 |
| S02 | Choloma | CORT-S02-01 y CORT-S02-02 |
| S03 | Villanueva | CORT-S03-01 y CORT-S03-02 |
| S04 | Puerto Cortés | CORT-S04-01 y CORT-S04-02 |
| S05 | La Lima | CORT-S05-01 y CORT-S05-02 |
| S06 | San Manuel | CORT-S06-01 y CORT-S06-02 |
| S07 | Pimienta | CORT-S07-01 y CORT-S07-02 |
| S08 | Potrerillos | CORT-S08-01 y CORT-S08-02 |
| S09 | Omoa | CORT-S09-01 y CORT-S09-02 |
| S10 | San Antonio de Cortés | CORT-S10-01 y CORT-S10-02 |

Se conservan los clientes DEMO001 a DEMO014, las asignaciones anteriores y los registros del 5 de noviembre. Los nuevos clientes se asignan desde el 27 de noviembre de 2026 y no tienen compras históricas inventadas. Las consultas de historial o productos habituales pueden responder sin registros para ellos. DEMO001 de S08 conserva el historial anterior para probar esas funciones.

## Opción 7 Cartera y vencimientos

Permite consultar resumen, documentos vencidos, documentos por código de cliente y vencimientos de hoy a siete días. Solo aparecen documentos con saldo positivo de clientes activos autorizados en la ruta. El saldo es monto menos pagado; el documento se considera vencido cuando su vencimiento es anterior a la fecha de Honduras. La consulta no registra cobros ni descuenta notas de crédito automáticamente.

Cada ruta tiene dos documentos nuevos ficticios. El primero tiene monto L 1000, pago L 200 y saldo L 800, con vencimiento el 15/11/2026. El segundo tiene monto L 600, pago L 100 y saldo L 500, con vencimiento el 01/12/2026. El saldo conjunto es L 1300 por ruta. La clasificación vencido o próximo cambia con la fecha real.

## Opción 8 Ruta y visitas

Muestra el sector y permite listar los clientes, buscar clientes con registros de visita o sin registros en una fecha. La fecha admite AAAA-MM-DD y `hoy`; rechaza días inexistentes y fechas futuras. Lista cinco clientes por página y admite `más`, `atrás` y volver al menú.

Se agregan dos registros ficticios para el primer cliente de cada ruta el 27/11/2026. Son dos registros para un cliente distinto, no dos clientes. El segundo cliente no tiene registros de ese día. Un registro de visita no acredita una visita completada ni una venta. No se calcula un itinerario ni se afirma que un cliente sin registro tenga una visita programada pendiente.

## Promoción navideña en las opciones 6 y 9

- Producto: Quartz agua purificada botella 600 ml, código ficticio PT990000001.
- Condición estructurada: comprar 6 botellas y recibir 1 botella gratis del mismo producto y presentación.
- Vigencia inclusiva: 27/11/2026 al 31/12/2026, fecha de Honduras.
- Promoción ficticia, sin validez comercial y sujeta a disponibilidad. No se reserva ni descuenta inventario.
- La opción 6 muestra la condición en la descripción; la opción 9, subopción 4, muestra las cantidades de bonificación registradas. Las promociones sin cantidades conocidas no se incluyen como bonificaciones confirmadas.

Se actualiza exclusivamente la promoción de agua de 600 ml; las otras promociones conservan sus condiciones y fechas. La bonificación no se deduce de texto ni se muestra fuera de su vigencia. La opción de preparar mensaje sigue preparando un borrador: no envía mensajes a terceros.

## Prueba con una cuenta asignada a S01

Cada flecha representa un mensaje. Enviar `menu` antes de cada recorrido independiente.

| Función | Secuencia | Referencia |
|---|---|---|
| Resumen de cartera | `7` → `1` | Saldo L 1300; al 27/11, vencido L 800 y próximo L 500 |
| Documentos vencidos | `7` → `2` | FAC-DEMO-CORT-S01-01 |
| Cartera por cliente | `7` → `3` → `CORT-S01-01` | Saldo L 800 |
| Ruta y sector | `8` → `4` | S01, San Pedro Sula, Cortés, NORTE |
| Clientes | `8` → `1` | CORT-S01-01 y CORT-S01-02 |
| Registros de visita | `8` → `2` → `2026-11-27` | Un cliente con dos registros |
| Sin registros ese día | `8` → `3` → `2026-11-27` | CORT-S01-02 |
| Promoción general | `6` | Promoción navideña DEMO 6+1 durante su vigencia |
| Bonificación por cliente | `9` → `CORT-S01-01` → `4` | Compra 6 botellas y recibe 1 botella |

## Publicación

1. En Azure seleccionar **DW_ISTMA** y ejecutar completo `database/academic/011_cortes_cartera_navidad.sql`. Requiere 006 y 009. Esta migración se ejecuta antes de publicar el backend actualizado.
2. Ejecutar `database/academic/012_verificar_operaciones.sql` para comprobar la muestra.
3. El propietario hace commit y push del backend y espera a Render. No hace falta modificar el frontend para habilitar estos menús.
4. Entrar en Administración y asignar S01–S10 a la cuenta con la que se probará. Después abrir el chat y escribir `menu`.

La migración conserva inventario, ventas, cuentas y visitas anteriores. Inserta veinte clientes, veinte documentos y veinte registros nuevos de visita, todos ficticios. Repetirla no duplica ni restaura datos. No se ejecutó en Azure ni se publicó código durante este cambio.

## Verificación local

Compilación Nest y 195 pruebas Jest aprobadas. Se ejecutaron 22 comprobaciones HTTP y SQL del nuevo recorrido, incluidas rutas ajenas, reasignación y revocación durante la conversación, cliente ajeno, paginación, fechas inválidas y vigencia inclusiva de la promoción. El archivo 011 se ejecutó repetidamente sin duplicar datos y se aprobaron las verificaciones SQL 005 y 012. Las cuentas desechables de las pruebas se retiraron al finalizar.
