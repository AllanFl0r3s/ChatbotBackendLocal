/* Datos académicos basados en CATÁLOGO ISTMANIA 2026, PDF de 64 páginas.
   Se usan seis nombres/presentaciones reales; SKU, alias PT, precios y cantidades son ficticios.
   Azure: seleccionar DW_ISTMA en sql-chatbot-allanflores-2026.database.windows.net.
   Requiere esquema 001, semilla 001 y vistas de stock 002.
   No borrar ni volver a crear las bases; ejecutar este archivo completo.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0)<>5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME()<>N'DW_ISTMA'
 THROW 51960,N'Destino incorrecto: seleccionar DW_ISTMA de nuestro Azure académico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51961,N'Falta la marca de demostración Azure.',1;
IF @@TRANCOUNT<>0 THROW 51962,N'Ejecutar sin transacción abierta.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL
 THROW 51963,N'Primero preparar el esquema académico.',1;

EXEC(N'
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @Bloqueo int;
 EXEC @Bloqueo=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',
  @LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @Bloqueo<0 THROW 51964,N''Otra migración está en curso.'',1;

 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=3)
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations
      WHERE Version=3 AND Nombre=N''003_catalogo_istmania_2026'')
   THROW 51965,N''La versión 003 pertenece a otro cambio. Revisar antes de continuar.'',1;
  COMMIT;
  PRINT N''Catálogo 003 ya aplicado; no se sobrescribieron datos.'';
  RETURN;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations
      WHERE Version=2 AND Nombre=N''002_vistas_stock_chat'')
  THROW 51966,N''Primero aplicar las vistas de stock 002.'',1;
 IF OBJECT_ID(N''dbo.VW_STOCK_S4_PRODUCTO_CENTRO'',N''V'') IS NULL
   OR OBJECT_ID(N''dbo.VWchatbot_STOCK_S4_PRODUCTO'',N''V'') IS NULL
  THROW 51967,N''Falta alguna de las vistas de stock.'',1;

 -- Los alias siguen siendo los mismos para conservar el contrato del chat.
 -- Se resuelven los productos por SKU, nunca por un IDENTITY supuesto.
 DECLARE @Catalogo TABLE(
  SKUAnterior nvarchar(50) PRIMARY KEY,
  SKU nvarchar(50) UNIQUE,
  AliasPT nvarchar(20) UNIQUE,
  Nombre nvarchar(200),CategoriaAnterior nvarchar(120),
  PrecioEjemplo decimal(18,2),PaginaPDF int
 );
 INSERT INTO @Catalogo VALUES
 (N''DEMO-AGUA'',N''DEMO-QUARTZ-600'',N''PT990000001'',N''Quartz agua purificada botella 600 ml'',N''Bebidas demo'',12.50,47),
 (N''DEMO-BEBIDA'',N''DEMO-QUARTZ-1000'',N''PT990000002'',N''Quartz agua purificada botella 1000 ml'',N''Bebidas demo'',20.00,47),
 (N''DEMO-ARROZ'',N''DEMO-PLATA-750'',N''PT990000003'',N''Plata Lite 750 ml'',N''Alimentos demo'',140.00,3),
 (N''DEMO-FRIJOL'',N''DEMO-VITALIT-600'',N''PT990000004'',N''Vitalit naranja mandarina 600 ml'',N''Bebidas demo'',35.00,48),
 (N''DEMO-DETERGENTE'',N''DEMO-DROPP-GAL'',N''PT990000005'',N''Dropp detergente líquido fragancia Fresh 1 galón'',N''Limpieza demo'',95.00,58),
 (N''DEMO-JABON'',N''DEMO-220-355'',N''PT990000006'',N''220 Energy Drink Original lata 355 ml'',N''Bebidas demo'',28.00,44);

 -- Este cambio solo transforma la semilla conocida. Si alguien agregó o cambió
 -- productos/categorías fuera de ella, se detiene para revisar en vez de pisarlos.
 IF (SELECT COUNT(*) FROM academico.Productos)<>6
    OR (SELECT COUNT(*) FROM academico.Categorias)<>3
    OR (SELECT COUNT(*) FROM academico.Categorias WHERE Nombre IN
        (N''Bebidas demo'',N''Alimentos demo'',N''Limpieza demo''))<>3
    OR (SELECT COUNT(*) FROM academico.Productos p JOIN @Catalogo c ON c.SKUAnterior=p.SKU)<>6
  THROW 51968,N''El catálogo actual no coincide con la semilla inicial. No se cambió nada.'',1;

 UPDATE p SET
  SKU=c.SKU,Nombre=c.Nombre,CategoriaId=k.Id,PrecioBase=c.PrecioEjemplo,
  Descripcion=N''Nombre/presentación del catálogo Istmania 2026, p. ''+
      CONVERT(nvarchar(3),c.PaginaPDF)+
      N''. SKU, alias, precio y existencias ficticios para demostración académica.''
 FROM academico.Productos p
 JOIN @Catalogo c ON c.SKUAnterior=p.SKU
 JOIN academico.Categorias k ON k.Nombre=c.CategoriaAnterior;
 IF @@ROWCOUNT<>6 THROW 51969,N''No se actualizaron exactamente seis productos.'',1;

 UPDATE academico.Categorias SET Nombre=CASE Nombre
  WHEN N''Bebidas demo'' THEN N''Bebidas sin alcohol (demo)''
  WHEN N''Alimentos demo'' THEN N''Licores nacionales (demo)''
  WHEN N''Limpieza demo'' THEN N''Higiene y limpieza (demo)'' END
 WHERE Nombre IN(N''Bebidas demo'',N''Alimentos demo'',N''Limpieza demo'');

 -- ALTER conserva los permisos SELECT que ya tiene chatbot_web sobre esta vista.
 -- Todo se confirma junto: no queda un intervalo de SKU nuevos con una vista vieja.
 EXEC(N''ALTER VIEW dbo.VW_STOCK_S4_PRODUCTO_CENTRO AS
  SELECT m.CodigoS4,p.Nombre,b.Codigo AS Centro,b.Nombre AS Centro_Nombre,
         CONVERT(nvarchar(30),N''''DEMOSTRACION'''') AS Zona,e.Cantidad AS StockTotal
  FROM academico.Productos p
  JOIN (VALUES
    (N''''DEMO-QUARTZ-600'''',N''''PT990000001''''),
    (N''''DEMO-QUARTZ-1000'''',N''''PT990000002''''),
    (N''''DEMO-PLATA-750'''',N''''PT990000003''''),
    (N''''DEMO-VITALIT-600'''',N''''PT990000004''''),
    (N''''DEMO-DROPP-GAL'''',N''''PT990000005''''),
    (N''''DEMO-220-355'''',N''''PT990000006'''')
  ) m(SKU,CodigoS4) ON m.SKU=p.SKU
  JOIN academico.Existencias e ON e.ProductoId=p.Id
  JOIN academico.Bodegas b ON b.Id=e.BodegaId
  WHERE p.Activo=1 AND b.Activa=1;'');

 IF (SELECT COUNT(*) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>6
  THROW 51970,N''La vista no devuelve los seis productos. Se revierte el cambio.'',1;

 INSERT INTO dbo.__AcademicMigrations(Version,Nombre)
 VALUES(3,N''003_catalogo_istmania_2026'');
 COMMIT;
 PRINT N''Catálogo actualizado: nombres reales, precios y existencias ficticios.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
');

-- Los nombres de esta muestra son distintos; esta unión es solo para mostrar el resultado.
EXEC(N'SELECT v.CodigoS4 AS AliasDemo,p.SKU,p.Nombre,c.Nombre AS Categoria,
 p.PrecioBase AS PrecioFicticioHNL,v.StockTotal AS UnidadesFicticias
 FROM dbo.VWchatbot_STOCK_S4_PRODUCTO v
 JOIN academico.Productos p ON p.Nombre=v.Nombre
 JOIN academico.Categorias c ON c.Id=p.CategoriaId
 ORDER BY v.CodigoS4;');
