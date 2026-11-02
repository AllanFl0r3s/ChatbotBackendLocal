/* PASO 3 - Cuenta SQL exclusiva de la demostración local.
   Ejecutar TODO en localhost\SQLEXPRESS con Autenticación de Windows.
   No modifica cuentas ni bases de la empresa.
   Si la cuenta ya existe, se detiene sin cambiar su contraseña.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('Edition')), N'') NOT LIKE N'%Express%'
   OR UPPER(COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'')) <> UPPER(HOST_NAME())
BEGIN
    THROW 51000, N'Detenido: conecta desde esta computadora a su instancia local SQLEXPRESS.', 1;
END;

IF CONVERT(int, SERVERPROPERTY('IsIntegratedSecurityOnly')) <> 0
BEGIN
    THROW 51001, N'Primero activa el modo mixto y reinicia el servicio SQL Server (SQLEXPRESS).', 1;
END;

IF DB_ID(N'CHATBOT') IS NULL OR DB_ID(N'DW_ISTMA') IS NULL
BEGIN
    THROW 51002, N'Primero crea CHATBOT y DW_ISTMA locales con los scripts 01 y 02.', 1;
END;

-- Revisar las marcas colocadas por los scripts de demostración.
-- Es SQL dinámico para no compilar referencias a una base que pudiera faltar.
EXEC(N'
IF NOT EXISTS (
    SELECT 1 FROM [CHATBOT].sys.extended_properties
    WHERE class = 0 AND name = N''Entorno''
      AND CONVERT(nvarchar(200), value) = N''DEMOSTRACION LOCAL - DATOS FICTICIOS''
) OR NOT EXISTS (
    SELECT 1 FROM [DW_ISTMA].sys.extended_properties
    WHERE class = 0 AND name = N''Entorno''
      AND CONVERT(nvarchar(200), value) = N''DEMOSTRACION LOCAL - DATOS FICTICIOS''
)
BEGIN
    THROW 51003, N''Las bases no tienen las marcas de demostración esperadas. No se crearon permisos.'', 1;
END;
');

IF SUSER_ID(N'chatbot_demo') IS NOT NULL
BEGIN
    THROW 51004, N'El login chatbot_demo ya existe. No se ha cambiado su contraseña ni sus permisos.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Cuenta del motor SQL, NO cuenta para iniciar sesión en el frontend.
    -- Contraseña ficticia exclusiva de este entorno local de demostración.
    CREATE LOGIN [chatbot_demo]
    WITH PASSWORD = 'DemoSqlLocal2026!',
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF,
         DEFAULT_DATABASE = [CHATBOT];

    EXEC(N'
        USE [CHATBOT];
        CREATE USER [chatbot_demo] FOR LOGIN [chatbot_demo];
        -- La aplicación guarda usuarios, sesiones, mensajes y perfil en esta base local.
        GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [chatbot_demo];
    ');

    EXEC(N'
        USE [DW_ISTMA];
        CREATE USER [chatbot_demo] FOR LOGIN [chatbot_demo];
        -- Las fuentes comerciales se consultan: no necesita escribir en ellas.
        GRANT SELECT TO [chatbot_demo];
    ');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Comprobación sin mostrar la contraseña ni su hash.
SELECT name AS UsuarioSQL, type_desc AS Tipo, is_disabled AS Deshabilitado
FROM sys.server_principals
WHERE name = N'chatbot_demo';

-- Datos para el siguiente paso: averiguar si el motor escucha por TCP y en qué puerto.
-- Puede no devolver filas si TCP/IP está deshabilitado.
SELECT ip_address AS Direccion, port AS Puerto, state_desc AS Estado
FROM sys.dm_tcp_listener_states
WHERE type_desc = N'TSQL';
