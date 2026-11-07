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
 OR DB_NAME() <> N'DW_ISTMA'
 THROW 51900,N'Destino incorrecto: selecciona DW_ISTMA en el servidor Azure academico.',1;
IF @@TRANCOUNT <> 0 THROW 51901,N'Ejecutar sin transaccion abierta.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''azure-dw-init'',@LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 51903,N''Otra inicializacion esta en curso.'',1;
 IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N''Entorno'')
 BEGIN
  IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THROW 51905,N''DW_ISTMA debe estar vacia en la primera inicializacion.'',1;
  EXEC sys.sp_addextendedproperty @name=N''Entorno'',@value=N''DEMOSTRACION AZURE - DATOS FICTICIOS'';
 END;
 IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N''Entorno''
 AND CONVERT(nvarchar(128),value)=N''DEMOSTRACION AZURE - DATOS FICTICIOS'')
 THROW 51902,N''Falta la marca de entorno Azure academico.'',1;

 COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
EXEC(N'BEGIN TRY
    BEGIN TRANSACTION;

    -- Dos ejecuciones simultáneas no deben intentar crear las mismas tablas.
    DECLARE @ResultadoBloqueo int;
    EXEC @ResultadoBloqueo = sys.sp_getapplock
        @Resource = N''chatbot-academico-migrations'',
        @LockMode = N''Exclusive'', @LockOwner = N''Transaction'', @LockTimeout = 10000;
    IF @ResultadoBloqueo < 0
    BEGIN
        THROW 51004, N''Otra migración está en curso. Intenta de nuevo al terminar.'', 1;
    END;

    -- Esta tabla es infraestructura, no cuenta como tabla de negocio.
    IF OBJECT_ID(N''dbo.__AcademicMigrations'', N''U'') IS NULL
    BEGIN
        CREATE TABLE dbo.__AcademicMigrations (
            Version int NOT NULL CONSTRAINT PK_AcademicMigrations PRIMARY KEY,
            Nombre nvarchar(150) NOT NULL,
            AplicadaEn datetime2 NOT NULL
                CONSTRAINT DF_AcademicMigrations_AplicadaEn DEFAULT (SYSUTCDATETIME())
        );
    END;

    IF EXISTS (SELECT 1 FROM dbo.__AcademicMigrations WHERE Version = 1)
    BEGIN
        -- Una versión registrada pero incompleta requiere revisión, no un falso éxito.
        IF (SELECT COUNT(*) FROM sys.tables AS t
            INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
            WHERE s.name = N''academico'' AND t.name IN
                (N''Clientes'', N''Rutas'', N''ClienteRuta'', N''Visitas'',
                 N''Categorias'', N''Productos'', N''Bodegas'', N''Existencias'')) <> 8
        BEGIN
            THROW 51005, N''Versión 001 registrada, pero faltan tablas. Revisa el esquema antes de continuar.'', 1;
        END;
        COMMIT TRANSACTION;
        PRINT N''Migración 001 ya aplicada: no se repitieron cambios ni se insertaron datos.'';
        RETURN;
    END;

    IF SCHEMA_ID(N''academico'') IS NULL
        EXEC(N''CREATE SCHEMA academico AUTHORIZATION dbo;'');

    IF EXISTS (
        SELECT 1 FROM sys.objects AS o
        INNER JOIN sys.schemas AS s ON s.schema_id = o.schema_id
        WHERE s.name = N''academico'' AND o.name IN
            (N''Clientes'', N''Rutas'', N''ClienteRuta'', N''Visitas'',
             N''Categorias'', N''Productos'', N''Bodegas'', N''Existencias'')
    )
    BEGIN
        THROW 51006, N''Ya hay objetos comerciales sin registrar la versión 001. No se reemplazarán.'', 1;
    END;

    CREATE TABLE academico.Clientes (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Clientes PRIMARY KEY,
        Codigo nvarchar(20) NOT NULL CONSTRAINT UQ_Academico_Clientes_Codigo UNIQUE,
        Nombre nvarchar(150) NOT NULL,
        Activo bit NOT NULL CONSTRAINT DF_Academico_Clientes_Activo DEFAULT (1),
        CONSTRAINT CK_Academico_Clientes_Codigo CHECK (LEN(LTRIM(RTRIM(Codigo))) > 0),
        CONSTRAINT CK_Academico_Clientes_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
    );

    CREATE TABLE academico.Rutas (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Rutas PRIMARY KEY,
        Codigo nvarchar(20) NOT NULL CONSTRAINT UQ_Academico_Rutas_Codigo UNIQUE,
        Nombre nvarchar(100) NOT NULL,
        Activa bit NOT NULL CONSTRAINT DF_Academico_Rutas_Activa DEFAULT (1),
        CONSTRAINT CK_Academico_Rutas_Codigo CHECK (
            LEN(LTRIM(RTRIM(Codigo))) > 0
            AND DATALENGTH(Codigo) = DATALENGTH(LTRIM(RTRIM(Codigo)))
        ),
        CONSTRAINT CK_Academico_Rutas_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
    );

    CREATE TABLE academico.ClienteRuta (
        ClienteId int NOT NULL,
        RutaId int NOT NULL,
        Desde date NOT NULL,
        Hasta date NULL,
        CONSTRAINT PK_Academico_ClienteRuta PRIMARY KEY (ClienteId, RutaId, Desde),
        CONSTRAINT FK_Academico_ClienteRuta_Cliente FOREIGN KEY (ClienteId)
            REFERENCES academico.Clientes(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_Academico_ClienteRuta_Ruta FOREIGN KEY (RutaId)
            REFERENCES academico.Rutas(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_Academico_ClienteRuta_Fechas CHECK (Hasta IS NULL OR Hasta >= Desde)
    );
    CREATE INDEX IX_Academico_ClienteRuta_Ruta ON academico.ClienteRuta(RutaId, Desde, Hasta);

    CREATE TABLE academico.Visitas (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Visitas PRIMARY KEY,
        ClienteId int NOT NULL,
        RutaId int NOT NULL,
        FechaHora datetime2 NOT NULL,
        CodigoRevision nvarchar(20) NULL,
        EnRuta bit NULL,
        Comentario nvarchar(500) NULL,
        CONSTRAINT FK_Academico_Visitas_Cliente FOREIGN KEY (ClienteId)
            REFERENCES academico.Clientes(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_Academico_Visitas_Ruta FOREIGN KEY (RutaId)
            REFERENCES academico.Rutas(Id) ON DELETE NO ACTION
    );
    -- No hay UNIQUE por cliente/día: puede haber más de un registro legítimo.
    CREATE INDEX IX_Academico_Visitas_RutaFechaCliente
        ON academico.Visitas(RutaId, FechaHora, ClienteId);

    CREATE TABLE academico.Categorias (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Categorias PRIMARY KEY,
        Nombre nvarchar(120) NOT NULL CONSTRAINT UQ_Academico_Categorias_Nombre UNIQUE,
        Activa bit NOT NULL CONSTRAINT DF_Academico_Categorias_Activa DEFAULT (1),
        CONSTRAINT CK_Academico_Categorias_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
    );

    CREATE TABLE academico.Productos (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Productos PRIMARY KEY,
        CategoriaId int NOT NULL,
        SKU nvarchar(50) NOT NULL CONSTRAINT UQ_Academico_Productos_SKU UNIQUE,
        Nombre nvarchar(200) NOT NULL,
        Descripcion nvarchar(255) NULL,
        PrecioBase decimal(18,2) NOT NULL,
        Activo bit NOT NULL CONSTRAINT DF_Academico_Productos_Activo DEFAULT (1),
        CONSTRAINT FK_Academico_Productos_Categoria FOREIGN KEY (CategoriaId)
            REFERENCES academico.Categorias(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_Academico_Productos_SKU CHECK (LEN(LTRIM(RTRIM(SKU))) > 0),
        CONSTRAINT CK_Academico_Productos_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0),
        CONSTRAINT CK_Academico_Productos_Precio CHECK (PrecioBase >= 0)
    );
    CREATE INDEX IX_Academico_Productos_Categoria ON academico.Productos(CategoriaId);

    CREATE TABLE academico.Bodegas (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Bodegas PRIMARY KEY,
        Codigo nvarchar(20) NOT NULL CONSTRAINT UQ_Academico_Bodegas_Codigo UNIQUE,
        Nombre nvarchar(150) NOT NULL,
        Activa bit NOT NULL CONSTRAINT DF_Academico_Bodegas_Activa DEFAULT (1),
        CONSTRAINT CK_Academico_Bodegas_Codigo CHECK (LEN(LTRIM(RTRIM(Codigo))) > 0),
        CONSTRAINT CK_Academico_Bodegas_Nombre CHECK (LEN(LTRIM(RTRIM(Nombre))) > 0)
    );

    CREATE TABLE academico.Existencias (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Academico_Existencias PRIMARY KEY,
        ProductoId int NOT NULL,
        BodegaId int NOT NULL,
        Cantidad decimal(18,3) NOT NULL,
        Minimo decimal(18,3) NOT NULL CONSTRAINT DF_Academico_Existencias_Minimo DEFAULT (0),
        ActualizadoEn datetime2 NOT NULL
            CONSTRAINT DF_Academico_Existencias_ActualizadoEn DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_Academico_Existencias_ProductoBodega UNIQUE (ProductoId, BodegaId),
        CONSTRAINT FK_Academico_Existencias_Producto FOREIGN KEY (ProductoId)
            REFERENCES academico.Productos(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_Academico_Existencias_Bodega FOREIGN KEY (BodegaId)
            REFERENCES academico.Bodegas(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_Academico_Existencias_Cantidad CHECK (Cantidad >= 0),
        CONSTRAINT CK_Academico_Existencias_Minimo CHECK (Minimo >= 0)
    );
    CREATE INDEX IX_Academico_Existencias_Bodega ON academico.Existencias(BodegaId);

    -- Se registra al final y en la misma transacción: no hay versión de una creación parcial.
    INSERT INTO dbo.__AcademicMigrations (Version, Nombre)
    VALUES (1, N''001_crear_esquema_comercial'');

    COMMIT TRANSACTION;
    PRINT N''Migración 001 aplicada: ocho tablas comerciales, sin datos semilla.'';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
');
