SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
-- Solo este servidor academico de Azure y la base indicada. No cambia de conexion.
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0) <> 5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME() <> N'CHATBOT'
 THROW 51900,N'Destino incorrecto: selecciona CHATBOT en el servidor Azure academico.',1;
IF @@TRANCOUNT <> 0 THROW 51901,N'Ejecutar sin transaccion abierta.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''azure-chatbot-init'',@LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 51903,N''Otra inicializacion esta en curso.'',1;
 IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N''AzureChatbotSchemaVersion'' AND CONVERT(int,value)=1)
 BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N''Entorno''
 AND CONVERT(nvarchar(128),value)=N''DEMOSTRACION AZURE - DATOS FICTICIOS'')
 THROW 51902,N''Falta la marca de entorno Azure academico.'',1;

  IF (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID(N''dbo'') AND name IN
   (N''TBL_ROLES'',N''TBL_USUARIOS'',N''TBL_SESIONES'',N''TBL_MENSAJES'',N''TBL_PERFIL''))<>5
   THROW 51904,N''Esquema registrado incompleto; revisar.'',1;
  COMMIT; PRINT N''CHATBOT ya inicializada. No se duplicaron datos.''; RETURN;
 END;
 IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0)
  OR EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N''Entorno'')
  THROW 51905,N''La inicializacion exige una base vacia sin marca previa.'',1;
 EXEC sys.sp_addextendedproperty @name=N''Entorno'',@value=N''DEMOSTRACION AZURE - DATOS FICTICIOS'';
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


 -- Los roles conservan los IDs requeridos por el backend. No se crean usuarios.
 INSERT dbo.TBL_ROLES(Nombre,Descripcion) VALUES
 (N''ADMINISTRADOR'',N''Administrador academico Azure''),(N''USUARIO'',N''Usuario academico Azure'');
 INSERT dbo.TBL_PERFIL(Nombre,Correo,Direccion1,Horario) VALUES
 (N''EMPRESA FICTICIA - DEMOSTRACION ACADEMICA'',N''contacto@example.invalid'',N''Direccion ficticia'',N''Entorno academico'');
 EXEC sys.sp_addextendedproperty @name=N''AzureChatbotSchemaVersion'',@value=1;
 COMMIT; PRINT N''CHATBOT preparada: cinco tablas, dos roles, perfil ficticio y cero usuarios.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
