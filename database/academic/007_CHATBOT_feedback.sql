/* Opiniones de demostracion. Ejecutar COMPLETO en CHATBOT, no DW_ISTMA.
   No reemplaza tablas ni crea cuentas. Guarda opiniones vinculadas a la cuenta,
   sin correo, nombre, IP ni contenido de las conversaciones.
*/
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'CHATBOT' OR @@TRANCOUNT<>0 THROW 52700,N'Seleccionar CHATBOT sin transaccion abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN(N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52701,N'Destino no academico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS' ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52702,N'Falta la marca de demostracion.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N'chatbot-demo-feedback',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 52703,N'Otra preparacion esta en curso.',1;
 IF OBJECT_ID(N'dbo.TBL_DEMO_FEEDBACK') IS NOT NULL
 BEGIN
  IF OBJECT_ID(N'dbo.TBL_DEMO_FEEDBACK',N'U') IS NULL
   OR NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBL_DEMO_FEEDBACK') AND name=N'DemoVersion' AND CONVERT(nvarchar(20),value)=N'1')
   THROW 52704,N'Existe un objeto distinto; no se reemplazo.',1;
  COMMIT; PRINT N'Opiniones ya preparadas; se conservaron los registros.'; RETURN;
 END;
 CREATE TABLE dbo.TBL_DEMO_FEEDBACK(
  Id int IDENTITY PRIMARY KEY,
  UserId int NOT NULL REFERENCES dbo.TBL_USUARIOS(ID_USUARIO),
  SubmissionId uniqueidentifier NOT NULL,
  Task nvarchar(40) NOT NULL CHECK(Task IN(N'general',N'stock',N'orders',N'sales',N'forecast',N'credit',N'promotions')),
  Outcome nvarchar(20) NOT NULL CHECK(Outcome IN(N'completed',N'assisted',N'blocked')),
  Ease int NOT NULL CHECK(Ease BETWEEN 1 AND 5),
  Usefulness int NOT NULL CHECK(Usefulness BETWEEN 1 AND 5),
  Comment nvarchar(1000) NOT NULL,
  CreatedAt datetime2 NOT NULL DEFAULT(SYSUTCDATETIME()),
  CONSTRAINT UQ_DEMO_FEEDBACK_Submission UNIQUE(UserId,SubmissionId)
 );
 EXEC sys.sp_addextendedproperty @name=N'DemoVersion',@value=N'1',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBL_DEMO_FEEDBACK';
 IF USER_ID(N'chatbot_web') IS NOT NULL GRANT SELECT,INSERT ON OBJECT::dbo.TBL_DEMO_FEEDBACK TO chatbot_web;
 IF USER_ID(N'chatbot_demo') IS NOT NULL GRANT SELECT,INSERT ON OBJECT::dbo.TBL_DEMO_FEEDBACK TO chatbot_demo;
 COMMIT; PRINT N'Opiniones preparadas. No se insertaron respuestas ficticias.';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
