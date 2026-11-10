# Validación realizada el 7 de noviembre de 2026

Se ejecutaron los scripts mediante la conexión de SSMS ya autenticada por el propietario al servidor `sql-chatbot-allanflores-2026.database.windows.net`.

## CHATBOT

Inicialización ejecutada dos veces consecutivas. Ambas finalizaron correctamente y el resultado final fue:

| Tabla | Registros |
|---|---:|
| TBL_ROLES | 2 |
| TBL_USUARIOS | 0 |
| TBL_SESIONES | 0 |
| TBL_MENSAJES | 0 |
| TBL_PERFIL | 1 |

## DW_ISTMA

Migración 001 aplicada correctamente. Semilla ejecutada dos veces consecutivas sin duplicación; resultados finales:

| Tabla del esquema academico | Registros |
|---|---:|
| Clientes | 14 |
| Rutas | 2 |
| ClienteRuta | 14 |
| Visitas | 18 |
| Categorias | 3 |
| Productos | 6 |
| Bodegas | 2 |
| Existencias | 12 |

La consulta de S08 para el 5 de noviembre de 2026 (Honduras) devolvió **9 clientes distintos y 13 registros de visita**. El script incluye una aserción SQL que lanza un error si difieren esos resultados.

## Pendiente

- Crear cuentas de aplicación con contraseñas privadas y usuarios SQL de permisos limitados.
- Configurar y publicar el backend con cifrado y conexión a estas dos bases.
- Conectar el frontend público al backend y verificar registro, login, recuperación, permisos y visitas desde HTTPS.

Esta validación cubre esquema y datos mediante SQL, no certifica todavía el flujo de la aplicación contra Azure. No se modificaron las bases locales ni los archivos de entorno existentes. Los scripts se conservan en database/azure para versionarlos junto al backend académico.

## Stock del chat — validación del 10 de noviembre de 2026

Se aplicó la migración 002 mediante el editor SQL del portal Azure. Crea dbo.VWchatbot_STOCK_S4_PRODUCTO y dbo.VW_STOCK_S4_PRODUCTO_CENTRO sobre los seis productos ficticios existentes. No duplicó ni modificó productos o cantidades. Se concedió SELECT únicamente sobre estas vistas a chatbot_web.

El archivo 07_DW_ISTMA_verificar_stock_chat.sql pasó en Azure: seis productos, doce existencias, totales esperados y lectura mediante el usuario limitado. Orden de instalación: 06 (vistas), 08 (lectura), 07 (verificación).

Se verificó el endpoint público del chat con una única cuenta ficticia USUARIO: agua 135; selección 1 con detalle 120 y 15; arroz por código 85; detergente 53; producto inexistente sin resultados. Registro/login 201, health 200 y logout 204. No se guardaron contraseñas ni JWT de prueba. La cuenta normal queda registrada para trazabilidad, sin privilegios adicionales.

Los alias PT990000001 a PT990000006 son inventados para compatibilidad con el filtro heredado. Las ventas, pedidos, promociones, proyecciones y notas de crédito siguen fuera de esta comprobación. Las frases probadas usan reglas; no certifican una integración de IA.

El acceso desde SSMS falló por transporte TCP 121; el editor del portal permitió completar el trabajo. Detalles y preguntas reproducibles en docs/stock-chat-academico.md (la copia de la guía en el backend). No se cambiaron variables de Render ni de Vercel y no se subieron commits en este trabajo.

## Catálogo de Istmania — actualización del 10 de noviembre de 2026

Se reemplazaron los seis productos genéricos por una muestra del PDF CATÁLOGO ISTMANIA 2026: Quartz agua 600/1000 ml (p.47), Plata Lite 750 ml (p.3), Vitalit naranja mandarina 600 ml (p.48), Dropp detergente líquido Fresh 1 galón (p.58) y 220 Energy Drink Original lata 355 ml (p.44). Nombres y presentaciones comprobados visualmente; precios, SKU, alias PT y cantidades son inventados para desarrollo.

El archivo 09_DW_ISTMA_catalogo_istmania.sql registra la migración 003 y actualiza productos, categorías y la vista por centro en una transacción. Se ejecutó dos veces sin duplicar ni sobrescribir en la segunda. El archivo 10_DW_ISTMA_verificar_catalogo.sql pasó: seis productos, tres categorías, doce existencias, precios y totales esperados y SELECT del usuario del backend conservado. No se purgaron mensajes ni se recrearon bases.

Prueba pública por HTTPS con una cuenta ficticia USUARIO: Quartz 600 ml 135 (detalle 120+15), Plata Lite 85, Vitalit 2, Dropp 53, 220 212; arroz sin resultados. Health 200, registro/login 201 y logout 204. Ninguna contraseña ni JWT se imprimió o guardó. La cuenta de prueba permanece sin permisos adicionales.

La guía vigente es docs/catalogo-istmania-demo.md. La consulta de precios no forma parte de esta validación aunque PrecioBase ya contiene importes ficticios. La copia local no se cambió; Azure y el chat publicado tienen el catálogo actualizado. No se crearon commits ni se publicaron cambios de código durante esta actualización SQL.
