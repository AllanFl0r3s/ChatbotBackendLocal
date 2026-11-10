/* Verificación sin modificar datos. Azure académico, DW_ISTMA.
   Nombres/presentaciones del catálogo. Precios, códigos y cantidades ficticios.
*/
SET NOCOUNT ON;
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0)<>5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME()<>N'DW_ISTMA'
 THROW 51980,N'Destino incorrecto: selecciona DW_ISTMA de nuestro Azure académico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51981,N'Falta la marca académica Azure.',1;

EXEC(N'
IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations
 WHERE Version=3 AND Nombre=N''003_catalogo_istmania_2026'')
 THROW 51982,N''Primero aplicar el catálogo 003.'',1;
DECLARE @Esperado TABLE(
 SKU nvarchar(50),Nombre nvarchar(200),Categoria nvarchar(120),
 Precio decimal(18,2),Total decimal(18,3),AliasPT nvarchar(20));
INSERT INTO @Esperado VALUES
 (N''DEMO-QUARTZ-600'',N''Quartz agua purificada botella 600 ml'',N''Bebidas sin alcohol (demo)'',12.50,135,N''PT990000001''),
 (N''DEMO-QUARTZ-1000'',N''Quartz agua purificada botella 1000 ml'',N''Bebidas sin alcohol (demo)'',20,10,N''PT990000002''),
 (N''DEMO-PLATA-750'',N''Plata Lite 750 ml'',N''Licores nacionales (demo)'',140,85,N''PT990000003''),
 (N''DEMO-VITALIT-600'',N''Vitalit naranja mandarina 600 ml'',N''Bebidas sin alcohol (demo)'',35,2,N''PT990000004''),
 (N''DEMO-DROPP-GAL'',N''Dropp detergente líquido fragancia Fresh 1 galón'',N''Higiene y limpieza (demo)'',95,53,N''PT990000005''),
 (N''DEMO-220-355'',N''220 Energy Drink Original lata 355 ml'',N''Bebidas sin alcohol (demo)'',28,212,N''PT990000006'');
IF (SELECT COUNT(*) FROM academico.Productos)<>6
 OR (SELECT COUNT(*) FROM academico.Categorias)<>3
 OR (SELECT COUNT(*) FROM academico.Existencias)<>12
 OR (SELECT COUNT(*) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>6
 THROW 51983,N''Cantidad inesperada de productos, categorías, existencias o productos visibles.'',1;

-- FK y stock se enlazan por IDs; se compara el catálogo completo con el resultado esperado.
IF EXISTS(
 SELECT SKU,Nombre,Categoria,Precio,Total,AliasPT FROM @Esperado
 EXCEPT
 SELECT p.SKU,p.Nombre,c.Nombre,p.PrecioBase,SUM(e.Cantidad),d.CodigoS4
 FROM academico.Productos p
 JOIN academico.Categorias c ON c.Id=p.CategoriaId
 JOIN academico.Existencias e ON e.ProductoId=p.Id
 JOIN academico.Bodegas b ON b.Id=e.BodegaId
 JOIN dbo.VW_STOCK_S4_PRODUCTO_CENTRO d ON d.Centro=b.Codigo AND d.Nombre=p.Nombre
 GROUP BY p.SKU,p.Nombre,c.Nombre,p.PrecioBase,d.CodigoS4)
 THROW 51984,N''Nombres, precios, categorías, alias o existencias no coinciden con la demostración.'',1;

IF EXISTS(SELECT 1 FROM academico.Productos WHERE SKU IN
 (N''DEMO-AGUA'',N''DEMO-BEBIDA'',N''DEMO-ARROZ'',N''DEMO-FRIJOL'',N''DEMO-DETERGENTE'',N''DEMO-JABON''))
 THROW 51985,N''Aún queda algún SKU genérico de la muestra anterior.'',1;

IF USER_ID(N''chatbot_web'') IS NULL THROW 51986,N''Falta el usuario del backend.'',1;
EXECUTE AS USER=N''chatbot_web'';
BEGIN TRY
 IF (SELECT COUNT(*) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>6
  THROW 51987,N''El usuario del backend no ve seis productos.'',1;
 IF (SELECT COUNT(*) FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO)<>12
  THROW 51988,N''El usuario del backend no ve doce existencias.'',1;
 SELECT CodigoS4,Nombre,StockTotal AS UnidadesFicticias
 FROM dbo.VWchatbot_STOCK_S4_PRODUCTO ORDER BY CodigoS4;
 REVERT;
END TRY
BEGIN CATCH
 REVERT;
 THROW;
END CATCH;
PRINT N''Catálogo 003 verificado: nombres reales, precios/stock ficticios y acceso del backend conservado.'';
');
