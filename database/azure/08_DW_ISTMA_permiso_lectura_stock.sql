/* Permiso mínimo para que el backend consulte las DOS vistas de stock.
   Revisar y autorizar antes de ejecutar. No concede escritura, DDL ni administración.
   Seleccionar DW_ISTMA en el servidor Azure académico.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0)<>5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME()<>N'DW_ISTMA'
 THROW 51950,N'Destino incorrecto: selecciona DW_ISTMA de nuestro Azure académico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51951,N'Falta la marca académica Azure.',1;
IF @@TRANCOUNT<>0 THROW 51952,N'Ejecutar sin transacción abierta.',1;
IF USER_ID(N'chatbot_web') IS NULL THROW 51953,N'No existe el usuario chatbot_web.',1;
IF OBJECT_ID(N'dbo.VWchatbot_STOCK_S4_PRODUCTO',N'V') IS NULL
 OR OBJECT_ID(N'dbo.VW_STOCK_S4_PRODUCTO_CENTRO',N'V') IS NULL
 THROW 51954,N'Primero crea las dos vistas mediante el archivo 06.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 GRANT SELECT ON OBJECT::dbo.VWchatbot_STOCK_S4_PRODUCTO TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.VW_STOCK_S4_PRODUCTO_CENTRO TO chatbot_web;
 COMMIT;
 PRINT N'Lectura de las dos vistas concedida al backend.';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
