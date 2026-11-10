/* Verificación de solo lectura, DESPUÉS de 06 y del permiso de lectura de 08.
   Seleccionar DW_ISTMA del Azure académico. No inserta ni cambia productos.
*/
SET NOCOUNT ON;
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0)<>5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME()<>N'DW_ISTMA'
 THROW 51940,N'Destino incorrecto: selecciona DW_ISTMA de nuestro Azure académico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51941,N'Falta la marca académica Azure.',1;

EXEC(N'
IF OBJECT_ID(N''dbo.VWchatbot_STOCK_S4_PRODUCTO'',N''V'') IS NULL
 OR OBJECT_ID(N''dbo.VW_STOCK_S4_PRODUCTO_CENTRO'',N''V'') IS NULL
 THROW 51942,N''Primero ejecuta 06_DW_ISTMA_stock_chat.sql.'',1;

-- Estos totales corresponden a la semilla original, no a datos empresariales.
DECLARE @Esperado TABLE(CodigoS4 nvarchar(20),StockTotal decimal(18,3));
INSERT INTO @Esperado VALUES
 (N''PT990000001'',135),(N''PT990000002'',10),(N''PT990000003'',85),
 (N''PT990000004'',2),(N''PT990000005'',53),(N''PT990000006'',212);
IF (SELECT COUNT(*) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>6
 THROW 51943,N''No hay seis productos de demostración en la vista.'',1;
IF (SELECT COUNT(*) FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO)<>12
 THROW 51944,N''No hay doce existencias por centro en la vista.'',1;
IF EXISTS(SELECT CodigoS4,StockTotal FROM @Esperado EXCEPT
          SELECT CodigoS4,StockTotal FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)
 THROW 51945,N''Los totales difieren de la semilla inicial. Revisa los datos sin sobrescribirlos.'',1;

-- Las mismas columnas que selecciona InventoryService.
SELECT TOP(20) CodigoS4,Nombre,StockTotal
FROM dbo.VWchatbot_STOCK_S4_PRODUCTO WHERE Nombre LIKE N''%agua%'' ORDER BY Nombre;
SELECT CodigoS4,Nombre,Centro,Centro_Nombre AS CentroNom,Zona,StockTotal
FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO WHERE CodigoS4=N''PT990000001'' ORDER BY Centro;

-- Comprueba acceso con el usuario limitado sin cambiar permisos ni contraseñas.
IF USER_ID(N''chatbot_web'') IS NULL THROW 51946,N''No existe el usuario de aplicación.'',1;
EXECUTE AS USER=N''chatbot_web'';
BEGIN TRY
    SELECT COUNT(*) AS ProductosLegibles FROM dbo.VWchatbot_STOCK_S4_PRODUCTO;
    SELECT COUNT(*) AS ExistenciasLegibles FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO;
    REVERT;
END TRY
BEGIN CATCH
    REVERT;
    THROW;
END CATCH;
PRINT N''Stock comprobado: seis productos, doce existencias y lectura del usuario de aplicación.'';
');
