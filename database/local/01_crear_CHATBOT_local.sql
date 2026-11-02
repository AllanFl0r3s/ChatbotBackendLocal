/* PASO 1 - CHATBOT local para demostración.
   Abrir con SSMS conectado a localhost\SQLEXPRESS mediante Windows.
   Ejecutar TODO el archivo, sin seleccionar fragmentos.
   Solo crea una base NUEVA. No elimina ni reemplaza bases existentes.
   No contiene datos ni credenciales de la empresa.
*/
SET NOCOUNT ON;

-- Una sola tanda (sin GO) evita que se ejecuten pasos posteriores si falla la comprobación.
-- Estos controles evitan una ejecución accidental sobre los servidores de la empresa.
IF COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('Edition')), N'') NOT LIKE N'%Express%'
   OR UPPER(COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'')) <> UPPER(HOST_NAME())
BEGIN
    THROW 51000, N'Detenido: conecta desde esta misma computadora a su instancia local SQLEXPRESS (Express Edition).', 1;
END;

IF DB_ID(N'CHATBOT') IS NOT NULL
BEGIN
    THROW 51001, N'CHATBOT ya existe en esta instancia. No se ha reemplazado. Revisa su contenido antes de continuar.', 1;
END;

-- CREATE DATABASE debe ejecutarse fuera de una transacción explícita.
IF @@TRANCOUNT <> 0
BEGIN
    THROW 51002, N'Ejecuta este archivo sin una transacción abierta.', 1;
END;

CREATE DATABASE [CHATBOT];

-- El bloque siguiente cambia su contexto a la base recién creada.
-- Las comillas dobles simples dentro de EXEC representan comillas del SQL interno.
EXEC(N'
USE [CHATBOT];
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    -- Marca visible para distinguir este entorno de las bases empresariales.
    EXEC sys.sp_addextendedproperty
        @name = N''Entorno'', @value = N''DEMOSTRACION LOCAL - DATOS FICTICIOS'';

    -- Los nombres se tomaron de las entidades del backend, no del manual antiguo.
    CREATE TABLE dbo.TBL_ROLES (
        ID_ROL int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre nvarchar(100) NOT NULL,
        Descripcion nvarchar(255) NULL,
        Estado_Rol bit NOT NULL DEFAULT (1),
        Fecha_Creacion datetime2 NOT NULL DEFAULT (SYSDATETIME())
    );

    CREATE TABLE dbo.TBL_USUARIOS (
        ID_USUARIO int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Rol int NOT NULL,
        Nombre nvarchar(150) NOT NULL,
        Usuario nvarchar(100) NULL,
        Email nvarchar(150) NOT NULL UNIQUE,
        PasswordHash nvarchar(255) NOT NULL,
        Telefono_numero nvarchar(20) NULL,
        Fecha_Registro datetime2 NOT NULL DEFAULT (SYSDATETIME()),
        Ultimo_Contacto datetime2 NULL,
        Estado bit NOT NULL DEFAULT (1),
        CONSTRAINT FK_USUARIOS_ROLES FOREIGN KEY (Id_Rol)
            REFERENCES dbo.TBL_ROLES(ID_ROL)
    );
    CREATE UNIQUE INDEX UX_USUARIOS_Usuario
        ON dbo.TBL_USUARIOS(Usuario) WHERE Usuario IS NOT NULL;

    CREATE TABLE dbo.TBL_SESIONES (
        ID_SESION int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Usuario int NULL,
        Fecha_Inicio datetime2 NOT NULL DEFAULT (SYSDATETIME()),
        Ultima_Actividad datetime2 NOT NULL DEFAULT (SYSDATETIME()),
        Contexto nvarchar(max) NULL,
        Canal nvarchar(20) NOT NULL,
        CanalRef nvarchar(100) NOT NULL
    );
    CREATE INDEX IX_SESIONES_UsuarioCanal
        ON dbo.TBL_SESIONES(Id_Usuario, Canal, ID_SESION DESC);

    CREATE TABLE dbo.TBL_MENSAJES (
        ID_MENSAJES int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Sesion int NOT NULL,
        Id_Usuario int NULL,
        Remitente nvarchar(30) NOT NULL,
        Tipo_Mensaje nvarchar(30) NOT NULL,
        Contenido nvarchar(max) NULL,
        Fecha_Hora datetime2 NOT NULL DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_MENSAJES_SESIONES FOREIGN KEY (Id_Sesion)
            REFERENCES dbo.TBL_SESIONES(ID_SESION) ON DELETE CASCADE
    );
    CREATE INDEX IX_MENSAJES_Sesion ON dbo.TBL_MENSAJES(Id_Sesion, ID_MENSAJES);

    -- PerfilService lee esta tabla mediante SQL directo y actualiza el ID 1.
    CREATE TABLE dbo.TBL_PERFIL (
        ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre nvarchar(150) NOT NULL,
        Telefono nvarchar(50) NULL,
        WhatsApp nvarchar(50) NULL,
        Correo nvarchar(150) NULL,
        Direccion1 nvarchar(250) NULL,
        Direccion2 nvarchar(250) NULL,
        Horario nvarchar(150) NULL,
        Imagen nvarchar(500) NULL,
        Fecha_Modificacion datetime2 NOT NULL DEFAULT (SYSDATETIME())
    );

    -- Es una base NUEVA: el primer rol tendrá ID 1, como espera AdminGuard.
    INSERT INTO dbo.TBL_ROLES (Nombre, Descripcion)
    VALUES
        (N''ADMINISTRADOR'', N''Administrador de la demostración local''),
        (N''USUARIO'', N''Usuario de la demostración local'');

    -- Credenciales EXCLUSIVAS DE DEMOSTRACION:
    -- identifier: admin.local | password: DemoLocal2026!
    -- PasswordHash contiene bcrypt; el backend no compara contraseñas en texto.
    INSERT INTO dbo.TBL_USUARIOS
        (Id_Rol, Nombre, Usuario, Email, PasswordHash)
    VALUES (
        1,
        N''Administrador Local de Demostración'',
        N''admin.local'',
        N''admin.local@example.invalid'',
        N''$2b$12$IOONSgEt6S532oiSQvLzO.wIwAA0buFLvdEOj99T0ULyM4FVi73jO''
    );

    INSERT INTO dbo.TBL_PERFIL (Nombre, Correo, Direccion1, Horario)
    VALUES (
        N''EMPRESA FICTICIA - DEMOSTRACION ACADEMICA'',
        N''contacto@example.invalid'',
        N''Dirección ficticia para pruebas locales'',
        N''Entorno de demostración''
    );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Resultado de comprobación. No muestra hashes ni contraseñas.
SELECT
    CAST(SERVERPROPERTY(''ServerName'') AS nvarchar(128)) AS Servidor,
    DB_NAME() AS BaseLocal,
    N''DEMOSTRACION LOCAL - DATOS FICTICIOS'' AS Entorno;

SELECT N''TBL_ROLES'' AS Tabla, COUNT(*) AS Registros FROM dbo.TBL_ROLES
UNION ALL SELECT N''TBL_USUARIOS'', COUNT(*) FROM dbo.TBL_USUARIOS
UNION ALL SELECT N''TBL_SESIONES'', COUNT(*) FROM dbo.TBL_SESIONES
UNION ALL SELECT N''TBL_MENSAJES'', COUNT(*) FROM dbo.TBL_MENSAJES
UNION ALL SELECT N''TBL_PERFIL'', COUNT(*) FROM dbo.TBL_PERFIL;

SELECT ID_USUARIO, Usuario, Nombre, Id_Rol, Estado
FROM dbo.TBL_USUARIOS;
');
