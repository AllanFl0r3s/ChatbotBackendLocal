/* Ejecutar completo en CHATBOT antes de desplegar el backend.
   Agrega asignación de ruta a las cuentas existentes, sin cambiar sus accesos actuales. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'CHATBOT' OR @@TRANCOUNT<>0 THROW 52500,N'Seleccionar CHATBOT sin transacción abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52501,N'Destino no autorizado para esta demostración.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS'
 ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52502,N'Falta la marca de demostración.',1;
IF OBJECT_ID(N'dbo.TBL_USUARIOS',N'U') IS NULL THROW 52503,N'Falta la tabla de usuarios.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N'chatbot-rutas-usuarios',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 52504,N'Otra migración está en curso.',1;
 IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'UserRouteVersion' AND CONVERT(int,value)=1)
 BEGIN
  IF COL_LENGTH(N'dbo.TBL_USUARIOS',N'RutaCodigo')<>6 OR COL_LENGTH(N'dbo.TBL_USUARIOS',N'RutaGestionada')<>1
   OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_TBL_USUARIOS_RutaCodigo'
    AND parent_object_id=OBJECT_ID(N'dbo.TBL_USUARIOS') AND is_disabled=0 AND is_not_trusted=0)
   THROW 52505,N'La migración registrada no coincide con el esquema; revisar.',1;
  COMMIT;
  PRINT N'Rutas de usuarios ya preparadas; no se modificaron asignaciones.';
  RETURN;
 END;
 IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'UserRouteVersion')
  OR COL_LENGTH(N'dbo.TBL_USUARIOS',N'RutaCodigo') IS NOT NULL
  OR COL_LENGTH(N'dbo.TBL_USUARIOS',N'RutaGestionada') IS NOT NULL
  THROW 52506,N'Ya existe otra definición de rutas; no se sobrescribió.',1;
 ALTER TABLE dbo.TBL_USUARIOS ADD RutaCodigo nvarchar(3) NULL,
  RutaGestionada bit NOT NULL CONSTRAINT DF_TBL_USUARIOS_RutaGestionada DEFAULT(0) WITH VALUES;
 EXEC(N'ALTER TABLE dbo.TBL_USUARIOS WITH CHECK ADD CONSTRAINT CK_TBL_USUARIOS_RutaCodigo
  CHECK(RutaCodigo IS NULL OR RutaCodigo COLLATE Latin1_General_100_BIN2 IN
   (N''S01'',N''S02'',N''S03'',N''S04'',N''S05'',N''S06'',N''S07'',N''S08'',N''S09'',N''S10''));');
 EXEC sys.sp_addextendedproperty @name=N'UserRouteVersion',@value=1;
 COMMIT;
 PRINT N'Rutas S01-S10 disponibles para administración. No se crearon cuentas ni contraseñas.';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
