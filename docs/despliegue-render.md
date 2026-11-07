# Backend académico en Render + Azure SQL

Estado: configuración preparada; servicio público, credenciales de aplicación y firewall pendientes de configurar y verificar. Las bases Azure ya tienen el esquema y la semilla ficticia. Este documento no certifica que la aplicación esté publicada.

## 1. Credenciales privadas de Azure

El propietario ejecuta `database/azure/05_usuario_aplicacion.template.sql` en CHATBOT y DW_ISTMA. Debe elegir una contraseña privada y conservarla fuera del repositorio. La plantilla nunca usa el administrador del servidor como usuario del proceso público. Para simplificar la configuración puede usar la misma contraseña nueva para chatbot_web en ambas bases; también se admiten dos distintas.

CHATBOT permite operaciones de la aplicación en cinco tablas concretas. DW_ISTMA concede lectura solo a Clientes, Rutas y Visitas del esquema academico. No se conceden permisos para crear tablas ni migraciones.

## 2. Crear el Web Service

Repositorio: AllanFl0r3s/ChatbotBackendLocal, rama main, directorio raíz vacío, runtime Node, plan Free.

- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm run start:prod`
- Health Check Path: `/health`
- NODE_VERSION: `22`

`render.yaml` contiene la configuración equivalente para crear un Blueprint. `sync: false` solicita los secretos en el panel; `generateValue: true` genera los secretos JWT y recuperación. Si se crea el Web Service manualmente, esos valores deben añadirse en Environment: el archivo YAML no se importa automáticamente por seleccionar el repositorio.

## 3. Variables de entorno

Copiar los valores no secretos de `render.yaml`. Completar DB_PASSWORD y PROD_DB_PASSWORD con las contraseñas de chatbot_web, nunca con las del administrador. Configurar JWT_SECRET y PASSWORD_RESET_SECRET con dos valores aleatorios independientes de al menos 32 caracteres. Añadir BREVO_API_KEY y RECOVERY_FROM_EMAIL de forma privada para recuperación por correo. No subir ningún .env.

DB_HOST y PROD_DB_HOST: `sql-chatbot-allanflores-2026.database.windows.net`; puerto 1433; DB_NAME=CHATBOT; PROD_DB_NAME=DW_ISTMA; ambos usuarios chatbot_web; cifrado true y trustServerCertificate false.

FRONTEND_URL y CORS_ORIGINS: `https://chatbot-clase-vista-previa.vercel.app`, sin `/login` ni barra final. NODE_ENV=production, VISITS_DATA_SOURCE=academic. VISITS_ROUTE_ACCESS empieza en `{}`: un usuario recién registrado no recibe acceso a rutas automáticamente. Asignar los IDs reales autorizados después de crear las cuentas.

OPENAI_API_KEY del Blueprint es un valor ficticio para inicializar el SDK; no permite respuestas de IA. El alcance a verificar es registro, login, sesiones, roles, recuperación y consulta de visitas. La IA requiere configuración y presupuesto separados.

## 4. Firewall de Azure

Obtener en Render, dentro del servicio, Connect → Outbound, los rangos de salida vigentes. El propietario agrega exclusivamente esos rangos al firewall del servidor SQL. No abrir 0.0.0.0–255.255.255.255 ni activar indiscriminadamente acceso desde todos los servicios Azure. Los rangos Render son compartidos por región, por eso siguen siendo necesarias credenciales SQL limitadas y TLS.

## 5. Verificar antes de conectar Vercel

1. Deploy finalizado sin errores; `https://URL-REAL.onrender.com/health` devuelve `{"status":"ok"}`. Es una prueba del proceso, no una prueba de permisos SQL.
2. Registrar una cuenta académica; login devuelve un token y una sesión persistida en CHATBOT.
3. Asignar su ID a S08 en VISITS_ROUTE_ACCESS; consultar 2026-11-05: 9 clientes y 13 registros.
4. Confirmar usuario normal sin administración, logout con token revocado y recuperación con Brevo.
5. Configurar PUBLIC_API_URL en Vercel con el origen HTTPS real y usar el build cloud del frontend.

El plan Free puede dormir por inactividad y tiene cuotas. No usar peticiones periódicas para impedir la pausa. El esquema de SQL está versionado; TypeORM mantiene synchronize=false. Las conexiones inactivas del pool se liberan después de 30 segundos.

Fuentes: https://render.com/docs/free · https://render.com/docs/outbound-ip-addresses · https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-nodejs?view=azuresql

## Validación del código preparado

7 de noviembre de 2026: npm run build correcto y 106 pruebas Jest en ocho suites correctas. Las pruebas HTTP usan repositorios simulados, sin cambiar Azure ni enviar correo. Las pruebas de configuración cubren rechazo de bases locales, administrador SQL, TLS desactivado, origen CORS incorrecto y secretos débiles. La primera ejecución HTTP fue bloqueada por el aislamiento de red del entorno; se repitió con permiso de red y pasó completa.
