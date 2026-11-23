/* Migración 006: opciones 9 y 10. Solo vistas y permisos de lectura.
   Seleccionar DW_ISTMA académica. No importa datos empresariales ni cambia existencias.
   Requiere migración 004. Ejecutar completo con una cuenta administradora de la base. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
DECLARE @azure bit=CASE WHEN SERVERPROPERTY('EngineEdition')=5 THEN 1 ELSE 0 END;
IF DB_NAME()<>N'DW_ISTMA' THROW 52100,N'Selecciona DW_ISTMA académica.',1;
IF @azure=1 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 THROW 52101,N'El servidor Azure no es el académico esperado.',1;
IF @azure=0 AND (COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'')<>N'SQLEXPRESS'
 OR UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))<>UPPER(HOST_NAME()))
 THROW 52102,N'Usa SQLEXPRESS de esta computadora o el servidor Azure académico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno' AND
 CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS' ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52103,N'Falta la marca de datos ficticios. No se modificó la base.',1;
IF @@TRANCOUNT<>0 THROW 52104,N'Ejecuta sin una transacción abierta.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL OR OBJECT_ID(N'academico.Ventas',N'U') IS NULL
 OR OBJECT_ID(N'academico.Promociones',N'U') IS NULL OR OBJECT_ID(N'academico.ChatProductos',N'V') IS NULL
 THROW 52105,N'Primero aplica la migración académica 004.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N'chatbot-academico-migrations',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 52106,N'Otra migración está en curso.',1;
 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=6)
 BEGIN
  IF OBJECT_ID(N'dbo.VWchatbot_CLIENTES_RUTA',N'V') IS NULL THROW 52107,N'Versión 006 registrada pero incompleta.',1;
  IF OBJECT_ID(N'dbo.VWchatbot_HISTORIAL_COMPRAS',N'V') IS NULL THROW 52107,N'Versión 006 registrada pero incompleta.',1;
  IF OBJECT_ID(N'dbo.VWchatbot_PROMOCIONES_SUGERIDAS',N'V') IS NULL THROW 52107,N'Versión 006 registrada pero incompleta.',1;
  COMMIT; PRINT N'Migración 006 ya aplicada; no se repitieron cambios.'; RETURN;
 END;
 IF OBJECT_ID(N'dbo.VWchatbot_CLIENTES_RUTA') IS NOT NULL THROW 52108,N'Ya existe VWchatbot_CLIENTES_RUTA; no se reemplazó.',1;
 EXEC(N'CREATE VIEW dbo.VWchatbot_CLIENTES_RUTA AS SELECT c.Codigo AS ClientCode,c.Nombre AS ClientName,r.Codigo AS Route,cr.Desde AS Since,cr.Hasta AS Until
 FROM academico.Clientes c JOIN academico.ClienteRuta cr ON cr.ClienteId=c.Id
 JOIN academico.Rutas r ON r.Id=cr.RutaId WHERE c.Activo=1 AND r.Activa=1');
 IF OBJECT_ID(N'dbo.VWchatbot_HISTORIAL_COMPRAS') IS NOT NULL THROW 52108,N'Ya existe VWchatbot_HISTORIAL_COMPRAS; no se reemplazó.',1;
 EXEC(N'CREATE VIEW dbo.VWchatbot_HISTORIAL_COMPRAS AS SELECT s.Id AS PurchaseId,c.Codigo AS ClientCode,r.Codigo AS Route,
 p.CodigoS4 AS sku,p.Nombre AS ProductName,s.Fecha AS PurchaseDate,s.Cantidad AS Quantity
 FROM academico.Ventas s JOIN academico.Clientes c ON c.Id=s.ClienteId
 JOIN academico.ChatProductos p ON p.Id=s.ProductoId CROSS JOIN academico.Rutas r
 WHERE s.Cantidad>0 AND s.PrecioUnitario>0 AND EXISTS
 (SELECT 1 FROM academico.ClienteRuta cr WHERE cr.ClienteId=c.Id AND cr.RutaId=r.Id)');
 IF OBJECT_ID(N'dbo.VWchatbot_PROMOCIONES_SUGERIDAS') IS NOT NULL THROW 52108,N'Ya existe VWchatbot_PROMOCIONES_SUGERIDAS; no se reemplazó.',1;
 EXEC(N'CREATE VIEW dbo.VWchatbot_PROMOCIONES_SUGERIDAS AS SELECT CONCAT(''DEMO-PROMO-'',o.Id) AS id,p.CodigoS4 AS sku,p.Nombre AS name,
 CONVERT(varchar(10),o.Desde,23) AS startsOn,CONVERT(varchar(10),o.Hasta,23) AS endsOn,o.Descripcion AS conditions
 FROM academico.Promociones o JOIN academico.ChatProductos p ON p.Id=o.ProductoId WHERE o.Activa=1 AND p.Activo=1');
 IF DATABASE_PRINCIPAL_ID(N'chatbot_web') IS NOT NULL
 BEGIN
  GRANT SELECT ON OBJECT::dbo.VWchatbot_CLIENTES_RUTA TO chatbot_web;
  GRANT SELECT ON OBJECT::dbo.VWchatbot_HISTORIAL_COMPRAS TO chatbot_web;
  GRANT SELECT ON OBJECT::dbo.VWchatbot_PROMOCIONES_SUGERIDAS TO chatbot_web;
 END;
 INSERT dbo.__AcademicMigrations(Version,Nombre) VALUES(6,N'Historial y promociones sugeridas académicas');
 COMMIT;
 PRINT N'Migración 006 aplicada: tres vistas, sin insertar ventas ni inventario.';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
