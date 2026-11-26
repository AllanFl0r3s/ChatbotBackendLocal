/* Ejecutar completo en DW_ISTMA académica local o Azure conocido.
   Convierte los dos vendedores demo y agrega ocho, sin crear cuentas de acceso.
   Conserva IDs, ventas y proyecciones. Repetir no restaura ni duplica datos. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'DW_ISTMA' OR @@TRANCOUNT<>0
 THROW 52300,N'Seleccionar DW_ISTMA sin transacción abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52301,N'Destino no autorizado para esta demostración.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS'
 ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52302,N'Falta la marca de demostración esperada.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL OR OBJECT_ID(N'academico.Vendedores',N'U') IS NULL
 THROW 52303,N'Primero preparar el menú académico 004.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',
  @LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 52304,N''Otra migración está en curso.'',1;
 DECLARE @Expected TABLE(Codigo nvarchar(20) PRIMARY KEY,Nombre nvarchar(100));
 INSERT @Expected VALUES
 (N''S01'',N''Vendedor S01''),(N''S02'',N''Vendedor S02''),(N''S03'',N''Vendedor S03''),
 (N''S04'',N''Vendedor S04''),(N''S05'',N''Vendedor S05''),(N''S06'',N''Vendedor S06''),
 (N''S07'',N''Vendedor S07''),(N''S08'',N''Vendedor S08''),(N''S09'',N''Vendedor S09''),(N''S10'',N''Vendedor S10'');
 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=8)
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=8 AND Nombre=N''008_vendedores_S01_S10'')
   THROW 52305,N''Versión 008 ocupada por otra migración.'',1;
  IF (SELECT COUNT(*) FROM academico.Vendedores)<>10 OR EXISTS
   (SELECT Codigo FROM @Expected EXCEPT SELECT Codigo FROM academico.Vendedores)
   THROW 52306,N''El catálogo cambió después de 008; revisar sin sobrescribir.'',1;
  COMMIT;
  PRINT N''Vendedores 008 ya aplicados; no se sobrescribieron datos.'';
  RETURN;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=4 AND Nombre=N''004_menu_completo_academico'')
  THROW 52303,N''Primero preparar el menú académico 004.'',1;
 IF (SELECT COUNT(*) FROM academico.Vendedores)<>2
  OR NOT EXISTS(SELECT 1 FROM academico.Vendedores WHERE Codigo=N''DEMO01'' AND Nombre=N''Vendedor DEMO Norte'')
  OR NOT EXISTS(SELECT 1 FROM academico.Vendedores WHERE Codigo=N''DEMO02'' AND Nombre=N''Vendedor DEMO Sur'')
  THROW 52307,N''Los vendedores no coinciden con la muestra inicial. No se cambió nada.'',1;
 DECLARE @BeforeSales TABLE(Id int, VendedorId int);
 DECLARE @BeforeForecast TABLE(Id int, VendedorId int);
 INSERT @BeforeSales SELECT Id,VendedorId FROM academico.Ventas;
 INSERT @BeforeForecast SELECT Id,VendedorId FROM academico.Proyecciones;
 UPDATE academico.Vendedores SET Codigo=CASE Codigo WHEN N''DEMO01'' THEN N''S01'' ELSE N''S02'' END,
  Nombre=CASE Codigo WHEN N''DEMO01'' THEN N''Vendedor S01'' ELSE N''Vendedor S02'' END
 WHERE Codigo IN(N''DEMO01'',N''DEMO02'');
 IF @@ROWCOUNT<>2 THROW 52308,N''No se actualizaron los dos vendedores esperados.'',1;
 INSERT academico.Vendedores(Codigo,Nombre)
 SELECT e.Codigo,e.Nombre FROM @Expected e WHERE NOT EXISTS
  (SELECT 1 FROM academico.Vendedores v WHERE v.Codigo=e.Codigo);
 IF (SELECT COUNT(*) FROM academico.Vendedores)<>10
  OR EXISTS(SELECT Codigo,Nombre FROM @Expected EXCEPT SELECT Codigo,Nombre FROM academico.Vendedores)
  THROW 52309,N''No se obtuvieron exactamente los diez vendedores esperados.'',1;
 IF EXISTS(SELECT Id,VendedorId FROM @BeforeSales EXCEPT SELECT Id,VendedorId FROM academico.Ventas)
  OR EXISTS(SELECT Id,VendedorId FROM academico.Ventas EXCEPT SELECT Id,VendedorId FROM @BeforeSales)
  OR EXISTS(SELECT Id,VendedorId FROM @BeforeForecast EXCEPT SELECT Id,VendedorId FROM academico.Proyecciones)
  OR EXISTS(SELECT Id,VendedorId FROM academico.Proyecciones EXCEPT SELECT Id,VendedorId FROM @BeforeForecast)
  THROW 52310,N''Cambió una relación comercial. Se revierte la actualización.'',1;
 INSERT dbo.__AcademicMigrations(Version,Nombre) VALUES(8,N''008_vendedores_S01_S10'');
 COMMIT;
 PRINT N''Diez vendedores S01 a S10 preparados; ventas y proyecciones conservadas.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
SELECT Codigo,Nombre FROM academico.Vendedores ORDER BY Codigo;
