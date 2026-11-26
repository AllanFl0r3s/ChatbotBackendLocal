# Diez vendedores para la demostración

Se preparan los códigos S01, S02, S03, S04, S05, S06, S07, S08, S09 y S10, con nombres `Vendedor S01` hasta `Vendedor S10`. Son registros comerciales ficticios en DW_ISTMA; no son usuarios ni contraseñas para iniciar sesión y no asignan permisos de rutas.

## Aplicación

Ejecutar completo `database/academic/008_vendedores_S01_S10.sql` en la base DW_ISTMA académica, después de 004. Admite únicamente SQLEXPRESS del equipo marcado como demostración o el servidor Azure académico conocido. Renombra DEMO01 a S01 y DEMO02 a S02 conservando sus IDs y relaciones, y agrega S03 a S10. No inserta ventas ni proyecciones para los ocho vendedores nuevos. Si encuentra otro catálogo inicial, se detiene para evitar sobrescribir cambios.

Se aplicó localmente el 26 de noviembre de 2026. La segunda ejecución confirmó que no duplica ni restaura datos. Azure todavía requiere aplicar este archivo; un commit y push del backend por sí solos no ejecutan migraciones SQL.

Se aprobaron 44 recorridos HTTP del menú contra SQL local, incluyendo las consultas de ventas y proyecciones para los diez códigos. `005_verificar_menu.sql` admite tanto la semilla original de dos vendedores como el catálogo actualizado con 008 y sigue comprobando los importes y relaciones de referencia.

## Consultas

Antes de cada recorrido, escribir `menu`. Cada flecha representa un mensaje separado.

| Consulta | Secuencia | Resultado de referencia |
|---|---|---|
| Ventas de S01 | `3` → `2` → `S01` → `3` → `noviembre 2026` | L 1,772.00 |
| Ventas de S02 | `3` → `2` → `S02` → `3` → `noviembre 2026` | L 666.60 |
| Proyección de S01 | `4` → `2` → `S01` → `PT990000001` → `noviembre 2026` | 10 cajas |
| Proyección de S02 | `4` → `2` → `S02` → `PT990000001` → `noviembre 2026` | 5 cajas |
| Vendedores S03 a S10 | Mismas secuencias cambiando el código | Vendedor reconocido, sin movimientos de demostración |

Todos los importes y cantidades son ficticios. Después de `009_solo_zona_norte.sql`, todas las proyecciones pertenecen a NORTE. Se conservan vendedores y cantidades: S01 tiene 10 cajas de PT990000001 y S02 tiene 5, ahora ambas en NORTE; la consulta por zona devuelve 15 cajas. La base impide nuevas proyecciones en otras zonas. Los códigos de ruta S01, S09, etc. de historial y visitas son un concepto separado; este cambio no vincula vendedores con rutas, clientes ni cuentas.
