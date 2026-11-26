/* Ejecutar completo en DW_ISTMA después de 008. Solo datos académicos.
   Reasigna las proyecciones SUR a NORTE y conserva vendedores y cantidades. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'DW_ISTMA' OR @@TRANCOUNT<>0 THROW 52400,N'Seleccionar DW_ISTMA sin transacción abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52401,N'Destino no autorizado para esta demostración.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS'
 ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52402,N'Falta la marca de demostración.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL THROW 52403,N'Falta el esquema académico.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',
  @LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 52404,N''Otra migración está en curso.'',1;
 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=9)
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=9 AND Nombre=N''009_solo_zona_norte'')
   THROW 52405,N''Versión 009 ocupada por otra migración.'',1;
  IF EXISTS(SELECT 1 FROM academico.Proyecciones WHERE Zona<>N''NORTE'')
   OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N''academico.Proyecciones'')
    AND name=N''CK_Proyecciones_SoloNorte'' AND is_disabled=0 AND is_not_trusted=0)
   THROW 52406,N''La configuración de zona cambió; revisar sin sobrescribir.'',1;
  COMMIT;
  PRINT N''Zona NORTE 009 ya aplicada; no se sobrescribieron datos.'';
  RETURN;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=8 AND Nombre=N''008_vendedores_S01_S10'')
  THROW 52407,N''Primero ejecutar 008_vendedores_S01_S10.sql.'',1;
 IF EXISTS(SELECT 1 FROM academico.Proyecciones WHERE Zona NOT IN(N''NORTE'',N''SUR''))
  THROW 52408,N''Se encontraron zonas diferentes de la muestra conocida. No se cambió nada.'',1;
 DECLARE @before TABLE(Id int PRIMARY KEY,ProductoId int,VendedorId int,Mes int,Anio int,Cajas decimal(18,3));
 INSERT @before SELECT Id,ProductoId,VendedorId,Mes,Anio,Cajas FROM academico.Proyecciones;
 IF EXISTS(SELECT ProductoId,VendedorId,Mes,Anio FROM academico.Proyecciones
  GROUP BY ProductoId,VendedorId,Mes,Anio HAVING COUNT(*)>1)
  THROW 52409,N''Hay proyecciones que se duplicarían al unificar zonas. Revisar sin fusionar cantidades.'',1;
 UPDATE academico.Proyecciones SET Zona=N''NORTE'' WHERE Zona=N''SUR'';
 ALTER TABLE academico.Proyecciones WITH CHECK ADD CONSTRAINT CK_Proyecciones_SoloNorte CHECK(Zona=N''NORTE'');
 IF EXISTS(SELECT * FROM @before EXCEPT SELECT Id,ProductoId,VendedorId,Mes,Anio,Cajas FROM academico.Proyecciones)
  OR EXISTS(SELECT Id,ProductoId,VendedorId,Mes,Anio,Cajas FROM academico.Proyecciones EXCEPT SELECT * FROM @before)
  THROW 52410,N''Cambió una cantidad o relación; se revierte la actualización.'',1;
 INSERT dbo.__AcademicMigrations(Version,Nombre) VALUES(9,N''009_solo_zona_norte'');
 COMMIT;
 PRINT N''Proyecciones configuradas únicamente para zona NORTE.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
SELECT Codigo,Nombre FROM academico.Vendedores ORDER BY Codigo;
SELECT Zona,COUNT(*) AS Proyecciones,SUM(Cajas) AS Cajas FROM academico.Proyecciones GROUP BY Zona;
