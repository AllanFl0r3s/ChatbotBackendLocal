/* 004 - Menu academico completo. Ejecutar TODO en DW_ISTMA.
Datos exclusivamente ficticios. No modifica existencias ni cuentas.
Solo admite SQLEXPRESS local marcado o el Azure academico conocido.
No reemplaza objetos existentes. Repetir no duplica ni restaura datos.
Stock 002 es requisito; admite catalogo inicial local o catalogo Azure 003.
*/
SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'DW_ISTMA' OR @@TRANCOUNT<>0 THROW 52000,N'Seleccionar DW_ISTMA sin transaccion abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN(N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52001,N'Destino no autorizado para esta demostracion.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS' ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52002,N'La base no tiene la marca academica esperada.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL THROW 52003,N'Falta esquema academico 001.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',@LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 52004,N''Otra migracion esta en curso.'',1;
 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=4)
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=4 AND Nombre=N''004_menu_completo_academico'')
   THROW 52005,N''Version 004 reservada para otro cambio.'',1;
  IF OBJECT_ID(N''academico.Vendedores'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.Vendedores.'',1;
  IF OBJECT_ID(N''academico.Pedidos'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.Pedidos.'',1;
  IF OBJECT_ID(N''academico.PedidoDetalle'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.PedidoDetalle.'',1;
  IF OBJECT_ID(N''academico.Ventas'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.Ventas.'',1;
  IF OBJECT_ID(N''academico.Proyecciones'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.Proyecciones.'',1;
  IF OBJECT_ID(N''academico.NotasCredito'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.NotasCredito.'',1;
  IF OBJECT_ID(N''academico.Promociones'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.Promociones.'',1;
  IF OBJECT_ID(N''academico.ChatProductos'') IS NULL THROW 52006,N''Migracion registrada pero falta academico.ChatProductos.'',1;
  IF OBJECT_ID(N''dbo.IV00101'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.IV00101.'',1;
  IF OBJECT_ID(N''dbo.RM00301'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.RM00301.'',1;
  IF OBJECT_ID(N''dbo.VentasCasaMarca'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.VentasCasaMarca.'',1;
  IF OBJECT_ID(N''dbo.Proyecciones_TEST'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.Proyecciones_TEST.'',1;
  IF OBJECT_ID(N''dbo.proyecciones2026'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.proyecciones2026.'',1;
  IF OBJECT_ID(N''dbo.VWchatbot_PEDIDO_DETALLE_S4'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.VWchatbot_PEDIDO_DETALLE_S4.'',1;
  IF OBJECT_ID(N''dbo.ZFI_NOTAS_CREDITO'') IS NULL THROW 52006,N''Migracion registrada pero falta dbo.ZFI_NOTAS_CREDITO.'',1;
  IF OBJECT_ID(N''pbx.TMP_IV00101'') IS NULL THROW 52006,N''Migracion registrada pero falta pbx.TMP_IV00101.'',1;
  COMMIT; PRINT N''004 ya aplicada: no se modificaron datos.''; RETURN;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=2 AND Nombre=N''002_vistas_stock_chat'')
  THROW 52007,N''Primero preparar vistas de stock 002.'',1;
 IF OBJECT_ID(N''academico.Vendedores'') IS NOT NULL THROW 52008,N''Ya existe academico.Vendedores: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.Pedidos'') IS NOT NULL THROW 52008,N''Ya existe academico.Pedidos: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.PedidoDetalle'') IS NOT NULL THROW 52008,N''Ya existe academico.PedidoDetalle: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.Ventas'') IS NOT NULL THROW 52008,N''Ya existe academico.Ventas: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.Proyecciones'') IS NOT NULL THROW 52008,N''Ya existe academico.Proyecciones: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.NotasCredito'') IS NOT NULL THROW 52008,N''Ya existe academico.NotasCredito: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.Promociones'') IS NOT NULL THROW 52008,N''Ya existe academico.Promociones: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''academico.ChatProductos'') IS NOT NULL THROW 52008,N''Ya existe academico.ChatProductos: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.IV00101'') IS NOT NULL THROW 52008,N''Ya existe dbo.IV00101: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.RM00301'') IS NOT NULL THROW 52008,N''Ya existe dbo.RM00301: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.VentasCasaMarca'') IS NOT NULL THROW 52008,N''Ya existe dbo.VentasCasaMarca: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.Proyecciones_TEST'') IS NOT NULL THROW 52008,N''Ya existe dbo.Proyecciones_TEST: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.proyecciones2026'') IS NOT NULL THROW 52008,N''Ya existe dbo.proyecciones2026: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.VWchatbot_PEDIDO_DETALLE_S4'') IS NOT NULL THROW 52008,N''Ya existe dbo.VWchatbot_PEDIDO_DETALLE_S4: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''dbo.ZFI_NOTAS_CREDITO'') IS NOT NULL THROW 52008,N''Ya existe dbo.ZFI_NOTAS_CREDITO: no se reemplazo nada.'',1;
 IF OBJECT_ID(N''pbx.TMP_IV00101'') IS NOT NULL THROW 52008,N''Ya existe pbx.TMP_IV00101: no se reemplazo nada.'',1;
 IF SCHEMA_ID(N''pbx'') IS NULL EXEC(N''CREATE SCHEMA pbx AUTHORIZATION dbo;'');
 IF EXISTS(SELECT 1 FROM sys.schemas WHERE name=N''pbx'' AND principal_id<>USER_ID(N''dbo''))
  THROW 52011,N''El esquema pbx tiene otro propietario. Revisar permisos antes de continuar.'',1;
 CREATE TABLE academico.Vendedores(
 Id int IDENTITY PRIMARY KEY,Codigo nvarchar(20) NOT NULL UNIQUE,Nombre nvarchar(100) NOT NULL);
 CREATE TABLE academico.Pedidos(
 Id int IDENTITY PRIMARY KEY,Numero nvarchar(30) NOT NULL UNIQUE,ClienteId int NOT NULL REFERENCES academico.Clientes(Id),Fecha date NOT NULL);
 CREATE TABLE academico.PedidoDetalle(
 PedidoId int NOT NULL REFERENCES academico.Pedidos(Id),ProductoId int NOT NULL REFERENCES academico.Productos(Id),
 Cantidad decimal(18,3) NOT NULL CHECK(Cantidad>0),PRIMARY KEY(PedidoId,ProductoId));
 CREATE TABLE academico.Ventas(
 Id int IDENTITY PRIMARY KEY,ProductoId int NOT NULL REFERENCES academico.Productos(Id),
 VendedorId int NOT NULL REFERENCES academico.Vendedores(Id),ClienteId int NOT NULL REFERENCES academico.Clientes(Id),Fecha date NOT NULL,
 Cantidad decimal(18,3) NOT NULL CHECK(Cantidad>0),PrecioUnitario decimal(18,2) NOT NULL CHECK(PrecioUnitario>=0),
 Impuesto decimal(18,2) NOT NULL CHECK(Impuesto>=0),DescuentoNormal decimal(18,2) NOT NULL CHECK(DescuentoNormal>=0),
 DescuentoEspecial decimal(18,2) NOT NULL CHECK(DescuentoEspecial>=0),
 CHECK(DescuentoNormal+DescuentoEspecial<=Cantidad*PrecioUnitario+Impuesto));
 CREATE TABLE academico.Proyecciones(
 Id int IDENTITY PRIMARY KEY,ProductoId int NOT NULL REFERENCES academico.Productos(Id),
 VendedorId int NOT NULL REFERENCES academico.Vendedores(Id),Zona nvarchar(30) NOT NULL,
 Mes int NOT NULL CHECK(Mes BETWEEN 1 AND 12),Anio int NOT NULL CHECK(Anio BETWEEN 2000 AND 2100),
 Cajas decimal(18,3) NOT NULL CHECK(Cajas>=0),UNIQUE(ProductoId,VendedorId,Zona,Mes,Anio));
 CREATE TABLE academico.NotasCredito(
 Id int IDENTITY PRIMARY KEY,Numero nvarchar(30) NOT NULL UNIQUE,ClienteId int NOT NULL REFERENCES academico.Clientes(Id),
 Fecha date NOT NULL,Descripcion nvarchar(200) NOT NULL,Total decimal(18,2) NOT NULL CHECK(Total>0));
 CREATE TABLE academico.Promociones(
 Id int IDENTITY PRIMARY KEY,ProductoId int NOT NULL UNIQUE REFERENCES academico.Productos(Id),
 Descripcion nvarchar(250) NOT NULL,Desde date NOT NULL,Hasta date NOT NULL,Activa bit NOT NULL,
 CHECK(Hasta>=Desde));
 EXEC(N''CREATE VIEW academico.ChatProductos AS SELECT p.Id,p.SKU,p.Nombre,p.PrecioBase,p.Activo,c.Nombre AS Categoria,m.CodigoS4
FROM academico.Productos p JOIN academico.Categorias c ON c.Id=p.CategoriaId
JOIN (VALUES
(N''''DEMO-AGUA'''',N''''PT990000001''''),(N''''DEMO-QUARTZ-600'''',N''''PT990000001''''),
(N''''DEMO-BEBIDA'''',N''''PT990000002''''),(N''''DEMO-QUARTZ-1000'''',N''''PT990000002''''),
(N''''DEMO-ARROZ'''',N''''PT990000003''''),(N''''DEMO-PLATA-750'''',N''''PT990000003''''),
(N''''DEMO-FRIJOL'''',N''''PT990000004''''),(N''''DEMO-VITALIT-600'''',N''''PT990000004''''),
(N''''DEMO-DETERGENTE'''',N''''PT990000005''''),(N''''DEMO-DROPP-GAL'''',N''''PT990000005''''),
(N''''DEMO-JABON'''',N''''PT990000006''''),(N''''DEMO-220-355'''',N''''PT990000006''''))m(SKU,CodigoS4) ON m.SKU=p.SKU'');
 IF (SELECT COUNT(*) FROM academico.ChatProductos)<>6 THROW 52009,N''El catalogo no coincide con los seis productos demo esperados.'',1;
 DECLARE @cliente int=(SELECT Id FROM academico.Clientes WHERE Codigo=N''DEMO001'');
 DECLARE @cliente2 int=(SELECT Id FROM academico.Clientes WHERE Codigo=N''DEMO002'');
 IF @cliente IS NULL OR @cliente2 IS NULL THROW 52010,N''Falta la semilla de clientes ficticios.'',1;
 INSERT academico.Vendedores(Codigo,Nombre) VALUES(N''DEMO01'',N''Vendedor DEMO Norte''),(N''DEMO02'',N''Vendedor DEMO Sur'');
 INSERT academico.Pedidos(Numero,ClienteId,Fecha) VALUES(N''0001001'',@cliente,''20261105''),(N''0001002'',@cliente2,''20261106'');
 INSERT academico.PedidoDetalle(PedidoId,ProductoId,Cantidad)
 SELECT o.Id,p.Id,x.Cantidad FROM (VALUES(N''0001001'',N''PT990000001'',24),(N''0001001'',N''PT990000005'',2),(N''0001002'',N''PT990000002'',12))x(Numero,Codigo,Cantidad)
 JOIN academico.Pedidos o ON o.Numero=x.Numero JOIN academico.ChatProductos p ON p.CodigoS4=x.Codigo;
 INSERT academico.Ventas(ProductoId,VendedorId,ClienteId,Fecha,Cantidad,PrecioUnitario,Impuesto,DescuentoNormal,DescuentoEspecial)
 SELECT p.Id,v.Id,@cliente,''20261105'',x.Cantidad,x.Precio,x.Impuesto,x.Descuento,0
 FROM (VALUES(N''PT990000001'',N''DEMO01'',24,12.50,45.00,10.00),
 (N''PT990000001'',N''DEMO02'',12,12.50,22.50,5.00),
 (N''PT990000002'',N''DEMO01'',10,20.00,30.00,0.00),
 (N''PT990000003'',N''DEMO01'',5,140.00,105.00,20.00),
 (N''PT990000004'',N''DEMO02'',6,35.00,31.50,0.00),
 (N''PT990000005'',N''DEMO01'',4,95.00,57.00,15.00),
 (N''PT990000006'',N''DEMO02'',8,28.00,33.60,0.00))x(Codigo,Vendedor,Cantidad,Precio,Impuesto,Descuento)
 JOIN academico.ChatProductos p ON p.CodigoS4=x.Codigo JOIN academico.Vendedores v ON v.Codigo=x.Vendedor;
 INSERT academico.Ventas(ProductoId,VendedorId,ClienteId,Fecha,Cantidad,PrecioUnitario,Impuesto,DescuentoNormal,DescuentoEspecial)
 SELECT p.Id,v.Id,@cliente,''20261005'',10,12.50,18.75,0,0 FROM academico.ChatProductos p CROSS JOIN academico.Vendedores v
 WHERE p.CodigoS4=N''PT990000001'' AND v.Codigo=N''DEMO01'';
 INSERT academico.Proyecciones(ProductoId,VendedorId,Zona,Mes,Anio,Cajas)
 SELECT p.Id,v.Id,x.Zona,11,2026,x.Cajas FROM (VALUES
 (N''PT990000001'',N''DEMO01'',N''NORTE'',10),(N''PT990000001'',N''DEMO02'',N''SUR'',5),
 (N''PT990000002'',N''DEMO01'',N''NORTE'',8),(N''PT990000003'',N''DEMO01'',N''NORTE'',6),
 (N''PT990000004'',N''DEMO02'',N''SUR'',4),(N''PT990000005'',N''DEMO01'',N''NORTE'',7),
 (N''PT990000006'',N''DEMO02'',N''SUR'',12))x(Codigo,Vendedor,Zona,Cajas)
 JOIN academico.ChatProductos p ON p.CodigoS4=x.Codigo JOIN academico.Vendedores v ON v.Codigo=x.Vendedor;
 INSERT academico.NotasCredito(Numero,ClienteId,Fecha,Descripcion,Total) VALUES
 (N''NC-DEMO-001'',@cliente,''20261105'',N''Devolucion ficticia de demostracion'',50.00),
 (N''NC-DEMO-002'',@cliente,''20261106'',N''Ajuste ficticio sin validez contable'',25.00),
 (N''NC-DEMO-003'',@cliente2,''20261107'',N''Bonificacion ficticia de demostracion'',40.00);
 INSERT academico.Promociones(ProductoId,Descripcion,Desde,Hasta,Activa)
 SELECT p.Id,x.Descripcion,x.Desde,x.Hasta,x.Activa FROM (VALUES
 (N''PT990000001'',N''10% ficticio; sin validez comercial'',''20261101'',''20261130'',1),
 (N''PT990000002'',N''5% ficticio; sin validez comercial'',''20261101'',''20261130'',1),
 (N''PT990000005'',N''15% ficticio; sin validez comercial'',''20261101'',''20261130'',1),
 (N''PT990000003'',N''Expirada, no debe mostrarse'',''20261001'',''20261031'',1),
 (N''PT990000004'',N''Futura, no debe mostrarse en noviembre'',''20261201'',''20261231'',1),
 (N''PT990000006'',N''Inactiva, no debe mostrarse'',''20261101'',''20261130'',0))x(Codigo,Descripcion,Desde,Hasta,Activa)
 JOIN academico.ChatProductos p ON p.CodigoS4=x.Codigo;
 EXEC(N''CREATE VIEW dbo.IV00101 AS SELECT CodigoS4 AS ITEMNMBR,Nombre AS ITEMDESC,Categoria AS itmclscd,
CAST(12 AS decimal(18,6)) AS itmgedsc,Activo AS active FROM academico.ChatProductos'');
 EXEC(N''CREATE VIEW dbo.RM00301 AS SELECT Codigo AS slprsnid,Nombre AS sprsnsln FROM academico.Vendedores'');
 EXEC(N''CREATE VIEW dbo.VentasCasaMarca AS SELECT p.CodigoS4 AS ITEMNMBR,v.Codigo AS SLPRSNID,s.Fecha AS DOCDATE,
MONTH(s.Fecha) AS Mes,YEAR(s.Fecha) AS Anio,
CAST(s.Cantidad*s.PrecioUnitario AS decimal(18,2)) AS xtndprce,
s.Impuesto AS IMPUESTO,s.DescuentoNormal AS descuentoNormal,s.DescuentoEspecial AS descuentoEspecial
FROM academico.Ventas s JOIN academico.ChatProductos p ON p.Id=s.ProductoId
JOIN academico.Vendedores v ON v.Id=s.VendedorId'');
 EXEC(N''CREATE VIEW dbo.Proyecciones_TEST AS SELECT p.CodigoS4 AS sku,v.Codigo AS idVendedor,f.Mes AS mes,f.Anio AS anio,f.Zona,f.Cajas
FROM academico.Proyecciones f JOIN academico.ChatProductos p ON p.Id=f.ProductoId
JOIN academico.Vendedores v ON v.Id=f.VendedorId'');
 EXEC(N''CREATE VIEW dbo.proyecciones2026 AS SELECT sku,idVendedor,mes,anio,Zona,Cajas FROM dbo.Proyecciones_TEST'');
 EXEC(N''CREATE VIEW dbo.VWchatbot_PEDIDO_DETALLE_S4 AS SELECT o.Numero AS IdPedido,p.CodigoS4 AS Material,p.Nombre AS NombreMaterial,
d.Cantidad AS Unidades,CAST(N''''UN'''' AS nvarchar(10)) AS UndMedida
FROM academico.Pedidos o JOIN academico.PedidoDetalle d ON d.PedidoId=o.Id
JOIN academico.ChatProductos p ON p.Id=d.ProductoId'');
 EXEC(N''CREATE VIEW dbo.ZFI_NOTAS_CREDITO AS SELECT c.Codigo AS COD_CLIENTE,c.Nombre AS CLIENTE,
CAST(N''''Cuenta DEMO - sin validez contable'''' AS nvarchar(100)) AS [NOMBRE CTA],n.Descripcion AS DESCRIPCION,
n.Numero AS DOC_SAP,n.Numero AS DOC_SAR,n.Fecha AS FECHA_DOCUMENTO,n.Total AS TOTAL
FROM academico.NotasCredito n JOIN academico.Clientes c ON c.Id=n.ClienteId'');
 EXEC(N''CREATE VIEW pbx.TMP_IV00101 AS SELECT p.CodigoS4 AS ITEMNMBR,
CAST(p.Nombre+CASE WHEN x.Id IS NOT NULL THEN N'''' | Promo DEMO: ''''+x.Descripcion ELSE N'''''''' END AS nvarchar(600)) AS itemdesc,
p.Categoria AS itmclscd,p.Activo AS active,CAST(12 AS decimal(18,6)) AS itmgedsc,
CAST(N''''DEMO'''' AS nvarchar(40)) AS Purchase_Item_Tax_Schedu,
COALESCE(x.Descripcion,N'''''''') AS uscatvls_1
FROM academico.ChatProductos p LEFT JOIN academico.Promociones x ON x.ProductoId=p.Id AND x.Activa=1
AND CONVERT(date,DATEADD(hour,-6,SYSUTCDATETIME())) BETWEEN x.Desde AND x.Hasta'');
 IF USER_ID(N''chatbot_web'') IS NOT NULL
 BEGIN
 GRANT SELECT ON OBJECT::dbo.IV00101 TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.RM00301 TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.VentasCasaMarca TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.Proyecciones_TEST TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.proyecciones2026 TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.VWchatbot_PEDIDO_DETALLE_S4 TO chatbot_web;
 GRANT SELECT ON OBJECT::dbo.ZFI_NOTAS_CREDITO TO chatbot_web;
 GRANT SELECT ON OBJECT::pbx.TMP_IV00101 TO chatbot_web;
 END;
 INSERT dbo.__AcademicMigrations(Version,Nombre) VALUES(4,N''004_menu_completo_academico'');
 COMMIT; PRINT N''004 aplicada: menu con datos ficticios, sin cambiar existencias ni cuentas.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
