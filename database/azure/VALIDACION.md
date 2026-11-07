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
