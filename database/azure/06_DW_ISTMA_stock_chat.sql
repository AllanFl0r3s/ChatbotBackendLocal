/* STOCK del chatbot en AZURE académico.
   Seleccionar DW_ISTMA en sql-chatbot-allanflores-2026.database.windows.net.
   Datos ficticios: seis productos existentes, sin copiar ni duplicar datos empresariales.
   Ejecutar todo el archivo en una sola tanda.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0) <> 5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME() <> N'DW_ISTMA'
 THROW 51930,N'Destino incorrecto: selecciona DW_ISTMA en nuestro Azure académico.',1;
IF @@TRANCOUNT<>0 THROW 51931,N'Ejecutar sin transacción abierta.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51932,N'Falta la marca de demostración Azure.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL
 THROW 51933,N'Primero aplica el esquema académico 001.',1;

-- La consulta a la tabla de versiones se compila después de comprobar que existe.
EXEC(N'
IF NOT EXISTS (SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=1)
    THROW 51405, N''Falta registrar la migración 001.'', 1;

BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @Bloqueo int;
    EXEC @Bloqueo=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',
        @LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
    IF @Bloqueo<0 THROW 51406,N''Otra migración está en curso.'',1;

    IF EXISTS (SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=2)
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.__AcademicMigrations
            WHERE Version=2 AND Nombre=N''002_vistas_stock_chat'')
            THROW 51407,N''La versión 002 pertenece a otro cambio. Revisar antes de continuar.'',1;
        IF OBJECT_ID(N''dbo.VW_STOCK_S4_PRODUCTO_CENTRO'',N''V'') IS NULL
           OR OBJECT_ID(N''dbo.VWchatbot_STOCK_S4_PRODUCTO'',N''V'') IS NULL
            THROW 51408,N''Versión 002 registrada, pero falta alguna vista.'',1;
        COMMIT;
        PRINT N''Migración 002 ya aplicada: no se sobrescribieron vistas ni datos.'';
        RETURN;
    END;

    IF OBJECT_ID(N''dbo.VW_STOCK_S4_PRODUCTO_CENTRO'') IS NOT NULL
       OR OBJECT_ID(N''dbo.VWchatbot_STOCK_S4_PRODUCTO'') IS NOT NULL
        THROW 51409,N''Ya existe un objeto con el nombre de las vistas. No se reemplazó nada.'',1;

    IF OBJECT_ID(N''academico.Productos'',N''U'') IS NULL
       OR OBJECT_ID(N''academico.Existencias'',N''U'') IS NULL
       OR OBJECT_ID(N''academico.Bodegas'',N''U'') IS NULL
        THROW 51410,N''Faltan tablas del esquema académico.'',1;

    -- El chat heredado filtra códigos PT/SE/ME. Estos alias son inventados;
    -- NO se cambian los SKU DEMO originales ni se afirma que sean códigos reales S4.
    EXEC(N''CREATE VIEW dbo.VW_STOCK_S4_PRODUCTO_CENTRO AS
        SELECT m.CodigoS4, p.Nombre,
               b.Codigo AS Centro, b.Nombre AS Centro_Nombre,
               CONVERT(nvarchar(30), N''''DEMOSTRACION'''') AS Zona,
               e.Cantidad AS StockTotal
        FROM academico.Productos AS p
        INNER JOIN (VALUES
            (N''''DEMO-AGUA'''',N''''PT990000001''''),
            (N''''DEMO-BEBIDA'''',N''''PT990000002''''),
            (N''''DEMO-ARROZ'''',N''''PT990000003''''),
            (N''''DEMO-FRIJOL'''',N''''PT990000004''''),
            (N''''DEMO-DETERGENTE'''',N''''PT990000005''''),
            (N''''DEMO-JABON'''',N''''PT990000006'''')
        ) AS m(SKU,CodigoS4) ON m.SKU=p.SKU
        INNER JOIN academico.Existencias AS e ON e.ProductoId=p.Id
        INNER JOIN academico.Bodegas AS b ON b.Id=e.BodegaId
        WHERE p.Activo=1 AND b.Activa=1;'');

    EXEC(N''CREATE VIEW dbo.VWchatbot_STOCK_S4_PRODUCTO AS
        SELECT CodigoS4,Nombre,SUM(StockTotal) AS StockTotal
        FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO
        GROUP BY CodigoS4,Nombre;'');

    INSERT INTO dbo.__AcademicMigrations(Version,Nombre)
    VALUES(2,N''002_vistas_stock_chat'');
    COMMIT;
    PRINT N''Migración 002 aplicada: dos vistas de stock, sin duplicar productos.'';
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;
');

-- Resultado esperado con la semilla original: 6 productos y 12 filas por bodega.
EXEC(N'SELECT CodigoS4,Nombre,StockTotal
       FROM dbo.VWchatbot_STOCK_S4_PRODUCTO ORDER BY CodigoS4;
       SELECT CodigoS4,Centro,Centro_Nombre,StockTotal
       FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO ORDER BY CodigoS4,Centro;');
