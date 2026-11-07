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
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51902,N'Falta la marca de entorno Azure academico.',1;
EXEC(N'IF OBJECT_ID(N''dbo.__AcademicMigrations'', N''U'') IS NULL
    THROW 51303, N''Primero ejecuta la migración 001.'', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=1)
    THROW 51304, N''Falta registrar la migración 001.'', 1;
IF @@TRANCOUNT <> 0
    THROW 51305, N''Ejecuta la semilla sin una transacción abierta.'', 1;

BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @ResultadoBloqueo int;
    -- Comparte bloqueo con las migraciones: una creación y una carga no compiten.
    EXEC @ResultadoBloqueo = sys.sp_getapplock
        @Resource=N''chatbot-academico-migrations'',
        @LockMode=N''Exclusive'', @LockOwner=N''Transaction'', @LockTimeout=10000;
    IF @ResultadoBloqueo < 0
        THROW 51306, N''Otra migración o semilla está en curso.'', 1;

    -- Infraestructura de control; no cuenta como una tabla de negocio adicional.
    IF OBJECT_ID(N''dbo.__AcademicSeeds'', N''U'') IS NULL
    BEGIN
        CREATE TABLE dbo.__AcademicSeeds (
            Nombre nvarchar(80) NOT NULL CONSTRAINT PK_AcademicSeeds PRIMARY KEY,
            FechaDatos date NOT NULL,
            AplicadaEn datetime2 NOT NULL
                CONSTRAINT DF_AcademicSeeds_AplicadaEn DEFAULT (SYSUTCDATETIME())
        );
    END;
    IF EXISTS (SELECT 1 FROM dbo.__AcademicSeeds WHERE Nombre=N''001_datos_academicos'')
    BEGIN
        COMMIT TRANSACTION;
        PRINT N''Semilla 001 ya aplicada: no se duplicaron ni sobrescribieron datos.'';
        RETURN;
    END;

    -- Esta primera carga requiere las ocho tablas nuevas vacías.
    -- Si había datos y falta el registro de semilla, se detiene en lugar de adivinar su origen.
    IF EXISTS (SELECT 1 FROM academico.Clientes)
       OR EXISTS (SELECT 1 FROM academico.Rutas)
       OR EXISTS (SELECT 1 FROM academico.ClienteRuta)
       OR EXISTS (SELECT 1 FROM academico.Visitas)
       OR EXISTS (SELECT 1 FROM academico.Categorias)
       OR EXISTS (SELECT 1 FROM academico.Productos)
       OR EXISTS (SELECT 1 FROM academico.Bodegas)
       OR EXISTS (SELECT 1 FROM academico.Existencias)
        THROW 51307, N''Las tablas academico contienen datos sin registrar esta semilla. Revisa; no se reemplazó nada.'', 1;

    -- Fecha FIJA: repetir la demostración otro día devuelve los mismos resultados.
    -- FechaHora se guarda en UTC. 09:00 en Honduras equivale a 15:00 UTC.
    DECLARE @FechaDemo date = CONVERT(date, ''20261105'', 112);
    DECLARE @Desde date = CONVERT(date, ''20261101'', 112);

    INSERT INTO academico.Rutas(Codigo, Nombre)
    VALUES (N''S08'',N''Ruta ficticia Centro''), (N''S09'',N''Ruta ficticia Norte'');

    DECLARE @Clientes TABLE(Numero int PRIMARY KEY, Codigo nvarchar(20), Nombre nvarchar(150), Ruta nvarchar(20));
    INSERT INTO @Clientes(Numero, Codigo, Nombre, Ruta)
    SELECT n, N''DEMO''+RIGHT(N''000''+CONVERT(nvarchar(3),n),3),
        N''Comercio Ficticio ''+RIGHT(N''00''+CONVERT(nvarchar(2),n),2),
        CASE WHEN n<=11 THEN N''S08'' ELSE N''S09'' END
    FROM (VALUES(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14)) AS numeros(n);

    INSERT INTO academico.Clientes(Codigo, Nombre, Activo)
    SELECT Codigo, Nombre, CASE WHEN Numero=11 THEN 0 ELSE 1 END FROM @Clientes;

    -- Se resuelven las FK por códigos, no por IDs 1,2,3: los IDENTITY pueden tener saltos.
    INSERT INTO academico.ClienteRuta(ClienteId, RutaId, Desde)
    SELECT c.Id,r.Id,@Desde FROM @Clientes d
    JOIN academico.Clientes c ON c.Codigo=d.Codigo
    JOIN academico.Rutas r ON r.Codigo=d.Ruta;

    INSERT INTO academico.Categorias(Nombre)
    VALUES(N''Bebidas demo''),(N''Alimentos demo''),(N''Limpieza demo'');
    INSERT INTO academico.Bodegas(Codigo,Nombre)
    VALUES(N''DEMO-CENTRAL'',N''Bodega central ficticia''),(N''DEMO-RUTA'',N''Bodega de ruta ficticia'');

    DECLARE @Productos TABLE(
        SKU nvarchar(50) PRIMARY KEY, Nombre nvarchar(200), Categoria nvarchar(120),
        Precio decimal(18,2), Central decimal(18,3), EnRuta decimal(18,3)
    );
    INSERT INTO @Productos(SKU,Nombre,Categoria,Precio,Central,EnRuta) VALUES
    (N''DEMO-AGUA'',N''Agua purificada 600 ml'',N''Bebidas demo'',12.50,120,15),
    (N''DEMO-BEBIDA'',N''Bebida cítrica 1 litro'',N''Bebidas demo'',28.00,0,10),
    (N''DEMO-ARROZ'',N''Arroz bolsa 1 kg'',N''Alimentos demo'',32.00,80,5),
    (N''DEMO-FRIJOL'',N''Frijol bolsa 900 g'',N''Alimentos demo'',45.00,2,0),
    (N''DEMO-DETERGENTE'',N''Detergente en polvo 500 g'',N''Limpieza demo'',38.00,45,8),
    (N''DEMO-JABON'',N''Jabón en barra 125 g'',N''Limpieza demo'',15.00,200,12);

    INSERT INTO academico.Productos(CategoriaId,SKU,Nombre,Descripcion,PrecioBase)
    SELECT c.Id,p.SKU,p.Nombre,N''Producto ficticio exclusivo para demostración académica.'',p.Precio
    FROM @Productos p JOIN academico.Categorias c ON c.Nombre=p.Categoria;

    INSERT INTO academico.Existencias(ProductoId,BodegaId,Cantidad,Minimo,ActualizadoEn)
    SELECT p.Id,b.Id,CASE WHEN b.Codigo=N''DEMO-CENTRAL'' THEN d.Central ELSE d.EnRuta END,
        CASE WHEN b.Codigo=N''DEMO-CENTRAL'' THEN 10 ELSE 5 END,
        DATEADD(hour,14,CONVERT(datetime2,@FechaDemo))
    FROM @Productos d JOIN academico.Productos p ON p.SKU=d.SKU
    CROSS JOIN academico.Bodegas b;

    -- Cada fila representa un registro, no demuestra venta ni visita completada.
    -- S08 tiene 9 clientes distintos y 13 registros en la fecha de demostración.
    DECLARE @Visitas TABLE(Numero int PRIMARY KEY, ClienteNumero int, DiaOffset int, MinutosLocal int, EnRuta bit);
    INSERT INTO @Visitas(Numero,ClienteNumero,DiaOffset,MinutosLocal,EnRuta) VALUES
    (1,1,0,540,1),(2,2,0,550,1),(3,3,0,560,1),
    (4,4,0,570,0),(5,5,0,580,1),(6,6,0,590,1),
    (7,7,0,600,1),(8,8,0,610,0),(9,9,0,620,1),
    (10,1,0,630,1),(11,3,0,640,1),(12,5,0,650,1),(13,7,0,660,1),
    (14,12,0,720,1),(15,13,0,730,1),(16,14,0,740,1),
    (17,1,-1,540,1),(18,10,-1,550,1);

    INSERT INTO academico.Visitas(ClienteId,RutaId,FechaHora,CodigoRevision,EnRuta,Comentario)
    SELECT c.Id,r.Id,
        DATEADD(minute,v.MinutosLocal+360,DATEADD(day,v.DiaOffset,CONVERT(datetime2,@FechaDemo))),
        N''P'',v.EnRuta,N''SEMILLA-ACADEMICA-001: registro ficticio ''+CONVERT(nvarchar(3),v.Numero)
    FROM @Visitas v JOIN @Clientes d ON d.Numero=v.ClienteNumero
    JOIN academico.Clientes c ON c.Codigo=d.Codigo
    JOIN academico.Rutas r ON r.Codigo=d.Ruta;

    INSERT INTO dbo.__AcademicSeeds(Nombre,FechaDatos)
    VALUES(N''001_datos_academicos'',@FechaDemo);
    COMMIT TRANSACTION;
    PRINT N''Semilla 001 aplicada. Fecha de demostración en Honduras: 2026-11-05.'';
    PRINT N''14 clientes, 2 rutas, 14 asignaciones, 18 registros de visita, 3 categorías, 6 productos, 2 bodegas y 12 existencias.'';
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
');
