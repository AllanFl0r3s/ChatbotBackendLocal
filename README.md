# ChatbotBackendLocal

Backend del chatbot para demostración académica con SQL Server local y datos ficticios.
Basado en el backend original de Istmania; su historial se conserva y su documentación
se encuentra en [docs/backend-original.md](docs/backend-original.md).

## Estado de esta primera etapa

- Dos bases locales: CHATBOT para usuarios, roles, sesiones, mensajes y perfil;
  DW_ISTMA para clientes, programación y registros ficticios de visitas.
- Login JWT con el usuario de demostración.
- GET /visits/clients: consulta las tablas academico por ruta y fecha de Honduras; conserva clientes distintos, registros y paginación. VISITS_DATA_SOURCE=legacy permite usar la fuente anterior explícitamente.
- Los datos de ejemplo de S08 tienen 9 clientes y 13 registros en su fecha de creación.

Todavía no se han recreado las fuentes locales de stock, ventas, proyecciones,
notas de crédito, cartera ni cotizaciones. Aunque su código original está presente,
no se deben considerar funcionales contra esta base local. La interpretación de
preguntas del chat con IA no forma parte de esta primera prueba local.

## Requisitos

Node.js 22 LTS, npm, SQL Server Express 2016 y SSMS. Las comprobaciones de TypeScript
sin dependencias utilizan Node.js 22.18 o superior. El SQL y el backend usan TRY_CAST
para admitir compatibilidad 100 de DW_ISTMA.

## Preparar las bases

En SSMS, conectar a localhost\SQLEXPRESS con autenticación de Windows y ejecutar,
uno por uno y completos, los scripts de [database/local](database/local):

1. 01_crear_CHATBOT_local.sql
2. 02_crear_DW_ISTMA_local_visitas.sql
3. 03_crear_usuario_SQL_local.sql

Los scripts exigen una instancia local Express llamada SQLEXPRESS en la misma
computadora. Se detienen si las bases o la cuenta ya existen; no borran ni reemplazan
objetos existentes. Los scripts 01 y 02 marcan las bases como datos ficticios.
No volver a ejecutarlos si el entorno ya fue preparado correctamente.

Para usar la cuenta SQL: activar modo mixto, habilitar TCP/IP en SQLEXPRESS,
configurar IPAll con TCP Dynamic Ports vacío y TCP Port 14330 y reiniciar el servicio.
No se requieren cambios en los servidores de la empresa.

Cuentas exclusivas de demostración:

| Uso | Usuario | Contraseña |
|---|---|---|
| Conexión del backend a SQL local | chatbot_demo | DemoSqlLocal2026! |
| Login de la aplicación | admin.local | DemoLocal2026! |

Las credenciales anteriores son ejemplos locales reproducibles, no credenciales de
la empresa. El usuario SQL escribe en CHATBOT y solo consulta DW_ISTMA.

## Configurar y arrancar

Desde la raíz de este repositorio:

```powershell
npm ci
Copy-Item .env.example .env
```

Si .env ya existe, conservarlo y revisar su configuración; no sobrescribirlo.
Configurar en .env un JWT_SECRET aleatorio propio, generado por ejemplo con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Ambas conexiones deben apuntar exclusivamente a 127.0.0.1:14330. El backend local usa
PORT=3021 para permitir distinguirlo del backend del trabajo en 3020.
El archivo .env no se publica. El valor OPENAI_API_KEY del ejemplo es ficticio:
solo permite inicializar los servicios originales; si una función intenta llamar a
OpenAI, fallará. Para desarrollar IA se requiere una clave propia válida por separado.

```powershell
npm run build
npm run start:dev
```

Swagger: http://localhost:3021/api

## Probar la primera consulta

1. En Swagger, POST /auth/login con identifier = admin.local y la contraseña de
   aplicación de la tabla anterior.
2. Copiar solo el valor de accessToken a Authorize. No pegarlo en el cuerpo del login.
3. GET /visits/clients con route = S08, date = fecha de demostración indicada por
   el script 02, page = 1 y pageSize = 50.
4. Verificar totalClients = 9 y totalVisitRecords = 13 para el conjunto inicial.

VISITS_ROUTE_ACCESS asigna al usuario local 1 las rutas S08 y S09. Es una configuración
de prueba del servidor, no un mecanismo de identidad para PACO en producción.
No se interpreta CodigoRevision ni EnRuta: los resultados son registros de visita,
no evidencia de venta ni de visita completada. queriedAt indica la hora de consulta,
no la sincronización de datos.

El frontend de clase deberá usar http://localhost:3021 como apiUrl cuando se conecte
a este backend. Esta etapa solo comprueba el endpoint estructurado; todavía no
conecta esta consulta a preguntas naturales del chat.

## Validación

```powershell
npm run build
npm test -- --runInBand visits.spec.ts
node --experimental-strip-types --test test/visits.core.test.cjs
```

Las pruebas HTTP simulan la fuente SQL. Los scripts locales y la conexión SQL se
validan por separado. Detalles del módulo: [docs/visitas.md](docs/visitas.md).

## Publicación

Este repositorio corresponde a la copia académica. .env, node_modules, dist, hashes
privados y credenciales reales no forman parte de la publicación. Los hashes bcrypt
incluidos en los scripts corresponden únicamente a la cuenta ficticia documentada.

Validación local del 02/11/2026: compilación correcta y 15 pruebas automatizadas
aprobadas. Se inició temporalmente el backend en 3021 contra ambas bases locales:
login correcto, visitas S08 con HTTP 200 (9 clientes/13 registros con códigos DEMO),
ruta sin asignación con HTTP 403 y solicitud sin token con HTTP 401.

## Integración académica de visitas (5 de noviembre de 2026)

La fuente predeterminada ahora es academico.Visitas. Requiere la migración y semilla
versionadas en database del repositorio Frontend-Chatbot. Fecha de la semilla:
2026-11-05. La pantalla del frontend está en /visits. Configuración, resultados de
pruebas y limitaciones: [docs/visitas.md](docs/visitas.md). Las funciones heredadas
de inventario y otras consultas del chat todavía no se adaptaron a las tablas nuevas.

## Semana 4: primer control de roles

Los cinco endpoints /users requieren JWT y administrador en el servidor. Angular
no es el límite de seguridad. El 6 de noviembre de 2026 se compiló el backend y
pasaron 20 pruebas en users.permissions.spec.ts, visits.academic.spec.ts y
visits.spec.ts (persistencia simulada). Recuperación y logout
con invalidación en servidor siguen pendientes. La matriz y el estado del avance
están en docs/permisos.md y docs/bitacora/semana-4.md del repositorio Frontend-Chatbot.

## Semana 4: registro público local

POST /auth/register acepta nombre, usuario, email y password; el servidor asigna
USUARIO (ID 2 activo), sin rutas. No devuelve JWT ni hash y no reemplaza la API
administrativa /users. El login también exige rol activo. Se reutilizan las tablas
existentes: no hay que recrear las bases. El 6 de noviembre se aprobaron 42 pruebas
y 8 comprobaciones HTTP contra SQL local real. Las credenciales de demostración
se guardaron fuera de los repositorios. Recuperación, invalidación de sesiones
y despliegue público siguen pendientes. Guía: docs/registro.md del frontend.

## Recuperación académica · avance 18

Flujo implementado con API de correo pendiente de configurar. Ver [guía](docs/recuperacion-contrasena.md). No se modificó el .env privado. Los JWT anteriores a este avance requieren volver a iniciar sesión. Pruebas: 69 aprobadas; cambio de contraseña y revocación comprobados con SQL local y transporte de correo sustituido. No se envió correo real ni se cambió ninguna contraseña de las cuentas existentes.
