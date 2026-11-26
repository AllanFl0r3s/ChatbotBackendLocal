# Productos consultables y ejemplos de stock

Al elegir `menu` → `1`, el chatbot obtiene una muestra de hasta seis productos con existencias desde `dbo.VWchatbot_STOCK_S4_PRODUCTO` de la conexión de inventario. Muestra el nombre y código de cada uno; el usuario puede elegir su número o buscar otro código/nombre. El detalle se vuelve a consultar al seleccionar, para no presentar cantidades antiguas como disponibilidad actual.

Los ejemplos anteriores escritos a mano (`Plata Lite 750ml vidrio`, `PT001022005`) se sustituyen por filas existentes. Solo se muestran códigos admitidos PT/SE/ME, nombres no vacíos y stock positivo. Una lista vacía o un error de consulta produce un mensaje explícito, sin inventar productos ni exponer errores SQL. La muestra no afirma representar el catálogo completo.

## Catálogo local actualizado

Se actualizó la base local DW_ISTMA el 26 de noviembre de 2026 con `database/academic/003_catalogo_istmania_local.sql`, adaptación de la migración 003 ya aplicada a Azure. Se ejecutó dos veces y se comprobó que repetirla no duplica ni sobrescribe datos. La muestra activa queda sin arroz ni frijoles. Se conservan IDs, códigos PT, cantidades y relaciones de pedidos, ventas, proyecciones y promociones. Azure se describe según el registro anterior de `catalogo-istmania-demo.md`; no se modificó ni verificó nuevamente en Azure durante esta actualización. Todos los códigos y cantidades son ficticios.

| Código | Nombre local confirmado y registrado para Azure | Unidades demo |
|---|---|---:|
| PT990000001 | Quartz agua purificada botella 600 ml | 135 |
| PT990000002 | Quartz agua purificada botella 1000 ml | 10 |
| PT990000003 | Plata Lite 750 ml | 85 |
| PT990000004 | Vitalit naranja mandarina 600 ml | 2 |
| PT990000005 | Dropp detergente líquido fragancia Fresh 1 galón | 53 |
| PT990000006 | 220 Energy Drink Original lata 355 ml | 212 |

Los scripts iniciales de semilla se conservan como historial. Para instalaciones nuevas locales, aplicar 003 después de preparar las vistas 002. Los vinos y tequilas aún no forman parte de esta muestra.

## Publicación y revisión

Esta mejora requiere publicar el backend. No requiere migración, cambio del frontend ni sustitución del catálogo. Allan conserva el control del commit y push. Confirmar después del despliegue que `menu` → `1` muestra los nombres de la base de Azure y que seleccionar una opción devuelve sus bodegas. Las modificaciones previas de demostración y retroalimentación siguen separadas de este cambio.

Pruebas locales: 14 suites y 175 pruebas de Jest aprobadas; compilación Nest aprobada. Se cubren selección numérica de un ejemplo, búsqueda por nombre posterior, ausencia de existencias y fallo del catálogo sin filtración de mensajes internos. También se probó por HTTP contra SQL Server Express: login local, `menu` → `1`, seis productos de la vista, selección del agua, detalle de 135 unidades (120 + 15) y logout. El servidor temporal se detuvo al finalizar. No se modificaron productos ni existencias.
