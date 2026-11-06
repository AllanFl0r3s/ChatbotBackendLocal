# Sesiones y cierre en servidor · avance 20

Fecha: 6 de noviembre de 2026. Proyecto académico local, datos ficticios. No se modificó la empresa ni sus bases.

## Cambio de comportamiento

Antes, Salir retiraba el JWT del navegador y el servidor podía aceptarlo todavía. Ahora cada login abre una sesión de acceso propia, POST /auth/logout la marca como cerrada en SQL y todas las peticiones posteriores con ese token reciben 401. Otra sesión abierta con la misma cuenta sigue vigente. Cambiar la contraseña continúa invalidando todas las credenciales anteriores mediante la huella del avance 18.

Los JWT anteriores al avance 20 no tienen sid y se rechazan: iniciar sesión otra vez. No se cambió ninguna contraseña existente.

## Persistencia sin cambiar el esquema

Se usa dbo.TBL_SESIONES de CHATBOT, con **Canal = AUTH**. Sus columnas ya existen; no se agregan tablas ni migraciones y no se reinicia SQL.

| Columna | Uso en una sesión AUTH |
|---|---|
| ID_SESION | Identificador entero de la fila SQL. No se expone como autorización. |
| Id_Usuario | Cuenta autenticada por el servidor. |
| Canal | Siempre AUTH; conversaciones WEB y WHATSAPP usan otras filas. |
| CanalRef | UUID aleatorio nuevo por login; coincide con sid del JWT firmado. |
| Fecha_Inicio | Momento UTC de creación. |
| Ultima_Actividad | Se establece al crear/cerrar; no representa seguimiento de cada petición. |
| Contexto | JSON propio: version=1, expiresAt en segundos Unix y revokedAt nulo o fecha UTC del cierre. |

No se almacena el JWT en claro, la contraseña ni su hash en estos registros. El contexto se interpreta en TypeScript: no usa funciones JSON de SQL incompatibles con la base local. El servicio del chat ya filtra sus conversaciones por WEB/WHATSAPP y no reutiliza AUTH.

No existe FK entre Id_Usuario y TBL_USUARIOS en el esquema heredado. El servidor comprueba cuenta y rol existentes/activos en cada petición, además de la sesión. Definir integridad y conservación de registros antes de habilitar borrados administrativos en producción. Este avance no elimina historial ni depura sesiones vencidas automáticamente; la retención y el índice de búsqueda a mayor escala quedan pendientes.

## Secuencia del backend

1. Login valida contraseña y estado del usuario/rol, firma un JWT con propósito access, sid UUID, caducidad y huella de contraseña.
2. Persiste AUTH antes de devolver el JWT. Si SQL falla, responde 503 y no entrega el token.
3. JwtStrategy verifica firma/expiración, sid válido, cuenta/rol vigentes, huella de contraseña y registro AUTH perteneciente al usuario, sin cierre y con la misma caducidad.
4. POST /auth/logout exige JWT válido. Toma userId, sessionId y expiresAt de la identidad autenticada. No acepta elegir otra sesión mediante campos en el cuerpo.
5. La actualización guarda revokedAt antes de responder 204 sin cuerpo. Un nuevo intento con el mismo token recibe 401. Dos solicitudes concurrentes ya autorizadas pueden terminar en 204; ninguna reabre la sesión.
6. SQL indisponible responde 503. No se concede acceso como fallback ni se afirma un cierre que no pudo persistirse. Una petición autorizada antes del cierre puede terminar; la revocación se comprueba al entrar cada nueva petición.

## Frontend

Chat y administración usan AuthService.logout(). Los botones quedan deshabilitados mientras se espera. Solo después de 204, o 401 que confirma que el acceso ya es inválido, se limpian token/usuario y se vuelve al login. Una falla de conexión, timeout de 10 segundos o 503 muestra un error y conserva el token para reintentar. El error no se presenta como un cierre exitoso.

El interceptor redirige al login al recibir 401 en una petición protegida. Un 403 conserva la sesión. Una respuesta tardía no borra un token nuevo; se compara con el token de la petición original. El interceptor solo adjunta el JWT a la URL base exacta de la API y sus rutas, no a URLs que compartan únicamente un prefijo. Las pantallas de autenticación pública quedan excluidas de la redirección por 401.

Después de recuperar contraseña se limpia el estado local directamente, ya que el backend invalidó todos los JWT antiguos por la huella. No se intenta cerrar por API un token que el cambio ya hizo inválido.

## Verificación realizada

- Backend compilado y **89 pruebas aprobadas en 6 suites**: 20 nuevas de sesiones/cierre y 69 de regresión.
- **11 comprobaciones con HTTP y SQL reales**, usando una cuenta temporal: apertura de sesiones independientes para ADMINISTRADOR y USUARIO, cierre individual, repetición 401, segunda sesión y permisos preservados, persistencia tras reiniciar la aplicación, solicitud anónima denegada, metadatos sin JWT y limpieza de las filas de prueba. Se conservaron cuentas, contraseñas y conversaciones existentes. El servidor temporal se cerró al terminar.
- Frontend compilado para desarrollo/SSR y preview. Continúan los avisos heredados de tamaño CSS.
- **12 pruebas unitarias del frontend aprobadas** para respuesta 204/401, error 503/red, doble clic, respuesta tardía, ausencia de token, interceptor 401/403 y límite de URL. Se ejecutaron con Jasmine y Angular TestBed en Node, con DOM mínimo, almacenamiento y navegación simulados. El intento de ejecución con Karma/navegador estuvo bloqueado: la terminal no pudo arrancar el navegador y el navegador integrado no conectó al servidor. Las pruebas de Node comprueban lógica, no presentación visual ni interacción real de botones.
- Falta la prueba manual de Salir en ambas pantallas y la verificación en el despliegue público. Llegar a 20 commits no completa por sí solo la semana 4.

Pruebas del backend, desde su carpeta:

```powershell
npm run build
npm test -- --runInBand auth-sessions.spec.ts auth.register.spec.ts password-recovery.spec.ts users.permissions.spec.ts visits.spec.ts visits.academic.spec.ts
```

Pruebas unitarias del frontend sin arrancar navegador, desde su carpeta:

```powershell
npm run test:auth-session:node
```

El ejecutor usa Jasmine, Angular TestBed y el compilador esbuild ya presentes en las dependencias de desarrollo bloqueadas en package-lock.json. Ejecuta solo la suite de servicios/interceptor; no es un entorno DOM general para componentes.

Alternativa en una terminal nativa con Edge instalado:

```powershell
$env:CHROME_BIN = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/auth-session.spec.ts
```

## Prueba manual propuesta

1. Reiniciar backend y mantener frontend iniciado. Entrar como usuario y pulsar Salir desde chat: debe regresar al login. Entrar como administrador y repetir desde administración.
2. Para comprobar independencia usar dos contextos de navegador separados (por ejemplo, normal e incógnito); dos pestañas normales comparten localStorage y no son dos almacenes de acceso independientes.
3. Cerrar la sesión normal; una nueva petición del contexto incógnito debe seguir funcionando. Reutilizar el token cerrado contra un endpoint protegido debe devolver 401. No publicar tokens ni capturas que los expongan.
4. Simular backend detenido: Salir debe mostrar un error, sin indicar éxito. Al volver a iniciarlo, reintentar el cierre.

No se enviaron correos ni se publicaron secretos durante estas comprobaciones. El cierre individual y la recuperación se implementaron localmente; falta publicar backend/base por HTTPS y repetir los flujos para preparar release semana-4.

## Archivos para estudiar

Backend: src/auth/auth-sessions.service.ts guarda/valida/cierra; auth.service.ts abre la sesión; jwt.strategy.ts la comprueba; auth.controller.ts expone POST /auth/logout; auth.module.ts registra dependencias; auth-sessions.spec.ts prueba permisos y fallos. Frontend: src/app/core/auth.service.ts coordina la solicitud; auth.interceptor.ts trata 401/403; chat/chat.component.ts y users/users-layout.component.ts conectan los botones. Los comentarios del código explican las decisiones.
