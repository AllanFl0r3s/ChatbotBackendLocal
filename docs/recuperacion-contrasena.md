# Recuperación de contraseña · avance 18

Fecha: 6 de noviembre de 2026. Implementado en los repositorios académicos locales. No se modificó el proyecto de empresa ni su base.

## Estado comprobado

- Formularios públicos /forgot-password y /reset-password, con enlace desde login.
- POST /auth/forgot-password y POST /auth/reset-password. No requieren sesión.
- 69 pruebas del backend aprobadas en 5 suites: 27 nuevas y 42 de regresión.
- 10 comprobaciones con la aplicación completa y SQL local: cuenta temporal, login, solicitud, cambio persistido, enlace usado rechazado, contraseña y JWT antiguos rechazados, nuevo login con permisos preservados, administrador preservado y limpieza de la cuenta temporal.
- Compilaciones de backend, frontend desarrollo/SSR y preview correctas. Los avisos de tamaño CSS heredados de preview continúan.
- El transporte de correo se sustituyó en las pruebas: **no se envió un correo real**. La cuenta de Brevo y sus credenciales no están configuradas. La integración devuelve 503 si falta configuración; no muestra un éxito inventado.
- Las nuevas pantallas necesitan comprobación manual con un correo recibido. Vercel sigue siendo solo una vista previa.

## Cómo funciona

1. El usuario solicita el enlace con el correo de su cuenta. Si la cuenta existe y tanto usuario como rol están activos, el backend solicita el envío a Brevo mediante HTTPS. La respuesta normal es genérica también para correos inexistentes o inactivos.
2. El enlace dura 15 minutos. Lleva un JWT firmado con PASSWORD_RESET_SECRET, audiencia y propósito password-reset, y una huella HMAC del hash actual de la contraseña. Usa una clave diferente de JWT_SECRET. No contiene correo, contraseña ni hash bcrypt.
3. El token viaja en el fragmento de URL (#token=...), que no se envía al hosting al pedir la página. La pantalla lo retira de la dirección visible y lo conserva en memoria mientras se usa. No se almacena en localStorage ni se registra en consola.
4. El backend verifica firma HS256, audiencia, propósito, vencimiento, usuario/rol activos y huella vigente. Solo permite cambiar la cuenta vinculada por el servidor al token. La contraseña debe tener al menos 12 caracteres, máximo 72 bytes UTF-8 y ser distinta de la anterior.
5. El cambio SQL compara ID, estado y hash anterior con intercalación binaria en la misma actualización. Si llegan dos cambios simultáneos con el mismo estado, solo uno puede actualizar una fila.
6. Al guardar otro hash bcrypt, todos los enlaces y JWT de acceso anteriores dejan de coincidir. No hay una tabla de tokens ni un token persistido en claro: el estado de un solo uso depende del hash vigente y del cambio SQL atómico. No se inicia sesión automáticamente después de recuperar.

## Configurar el correo sin subir secretos

El autor todavía no tiene una cuenta de correo transaccional. Crear una cuenta gratuita en [Brevo](https://www.brevo.com/), verificar el correo y configurar un remitente según los requisitos vigentes de la cuenta. Puede ser necesario autenticar un dominio o conseguir la activación transaccional; no se presume aprobada la entrega. No contratar planes ni comprar dominios sin revisar antes el presupuesto cero.

Crear una clave API de Brevo y guardarla **solo en el .env privado del backend**. Completar estas variables (también aparecen vacías en .env.example):

```dotenv
FRONTEND_URL=http://localhost:4200
PASSWORD_RESET_SECRET=<valor aleatorio exclusivo de al menos 32 caracteres>
BREVO_API_KEY=<clave privada de Brevo>
RECOVERY_FROM_EMAIL=<correo remitente verificado>
```

Para generar PASSWORD_RESET_SECRET, ejecutar en una terminal privada y copiar la salida al .env:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No compartir claves, enlaces ni capturas del .env. PASSWORD_RESET_SECRET debe diferir de JWT_SECRET. FRONTEND_URL debe ser un origen exacto sin rutas, credenciales ni parámetros; HTTPS en publicación, HTTP permitido solo para localhost/127.0.0.1. El destino del enlace lo decide el servidor, nunca un encabezado Host ni un valor enviado por el usuario.

Después de configurar, reiniciar **el backend**. No reiniciar SQL ni ejecutar migraciones: este cambio usa las tablas actuales. El frontend debe seguir iniciado desde su propia carpeta.

## Prueba manual pendiente

1. Usar una cuenta propia con un correo real que controle el autor. Las direcciones example.invalid de demostración no reciben mensajes.
2. Abrir /forgot-password y pedir el enlace. Revisar bandeja y spam, además del estado de entrega en Brevo. La aceptación de la API no garantiza recepción.
3. Abrir el enlace una vez y definir otra contraseña. Iniciar sesión con la nueva; comprobar que la anterior falla.
4. Reabrir el enlace usado: debe rechazarse. Probar uno vencido y comprobar errores claros.
5. Confirmar que otra sesión abierta antes del cambio recibe 401 al solicitar datos. Este avance rechaza la API; las pantallas protegidas pueden requerir volver al login manualmente.
6. Repetir permisos USUARIO: no puede administrar cuentas ni asignarse rutas. No probar cambios de contraseña en cuentas ajenas.

## Límites y trabajo pendiente

- Límite local por proceso: 3 intentos por correo y 20 por IP del socket en 15 minutos. Correos se representan con SHA-256 en la memoria del limitador; tamaño acotado y limpieza al expirar. Se reinicia con el proceso. Detrás de un proxy puede compartirse la IP; antes de ampliar instancias necesita almacenamiento compartido y una política explícita de proxies. No se confía en X-Forwarded-For arbitrario.
- El envío es síncrono. Los fallos del proveedor producen 503; los tiempos y fallos requieren mayor protección contra enumeración para una publicación expuesta a abuso. No se presenta esta implementación académica como certificación de seguridad de producción.
- Los JWT emitidos antes del avance 18 no tienen propósito/huella y se rechazan: volver a iniciar sesión una vez. Se revalida usuario, rol activo y permisos actuales en cada petición protegida; no se aceptan privilegios antiguos del token.
- Logout todavía solo limpia el navegador. Invalidar una sesión concreta en servidor sigue pendiente y es distinto de revocar todas las sesiones por cambio de contraseña.
- Falta configurar proveedor, recibir correo real, probar la interfaz, publicar backend/base por HTTPS y preparar release semana-4. No marcar la entrega como finalizada.

## Fuentes y archivos

- [Envío transaccional mediante API Brevo](https://developers.brevo.com/docs/send-a-transactional-email).
- [Límites del plan gratuito](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan): 300 correos diarios según la consulta del 6 de noviembre de 2026. Verificar límites y requisitos de activación de la cuenta antes de publicar.
- Snapshot complementario conservado en integraciones/backend-recuperacion.patch del repositorio de frontend; el código ya está aplicado en este backend.

Backend: src/auth/password-recovery.service.ts (flujo), recovery-mail.service.ts (proveedor), guards/recovery-rate.guard.ts (límites), credential-version.ts y jwt.strategy.ts (vigencia), dto/password-recovery.dto.ts (entrada), password-recovery.spec.ts (pruebas). Frontend: src/app/auth/password-recovery.component.ts y .html (pantallas), core/auth.service.ts (HTTP), app.routes.ts (rutas) y auth/login.component.html (enlace).
