/* PLANTILLA: el propietario la edita y ejecuta de forma privada en SSMS.
   Ejecutar una vez en CHATBOT y otra en DW_ISTMA del servidor indicado.
   Elegir una contraseña NUEVA y privada, de al menos 20 caracteres.
   No guardar la copia que contiene la contraseña en Git ni compartirla por chat.
   No ejecuta cambios de firewall ni usa el administrador como usuario del backend.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0)<>5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME() NOT IN (N'CHATBOT',N'DW_ISTMA')
 THROW 51920,N'Selecciona CHATBOT o DW_ISTMA en el servidor Azure academico.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51921,N'Falta la marca academica Azure.',1;
IF @@TRANCOUNT<>0 THROW 51922,N'Ejecutar sin transaccion abierta.',1;

DECLARE @Password nvarchar(128)=N'REEMPLAZAR_PRIVADAMENTE';
IF @Password=N'REEMPLAZAR_PRIVADAMENTE' OR LEN(@Password)<20
 THROW 51923,N'Primero elige una contraseña privada de al menos 20 caracteres.',1;
IF USER_ID(N'chatbot_web') IS NOT NULL
 THROW 51924,N'chatbot_web ya existe. No se ha cambiado su contraseña ni sus permisos.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @sql nvarchar(max)=N'CREATE USER [chatbot_web] WITH PASSWORD='+QUOTENAME(@Password,'''')+N';';
 EXEC sys.sp_executesql @sql;
 IF DB_NAME()=N'CHATBOT'
 BEGIN
  GRANT SELECT,INSERT,UPDATE,DELETE ON OBJECT::dbo.TBL_ROLES TO chatbot_web;
  GRANT SELECT,INSERT,UPDATE,DELETE ON OBJECT::dbo.TBL_USUARIOS TO chatbot_web;
  GRANT SELECT,INSERT,UPDATE,DELETE ON OBJECT::dbo.TBL_SESIONES TO chatbot_web;
  GRANT SELECT,INSERT,UPDATE,DELETE ON OBJECT::dbo.TBL_MENSAJES TO chatbot_web;
  GRANT SELECT,INSERT,UPDATE,DELETE ON OBJECT::dbo.TBL_PERFIL TO chatbot_web;
 END
 ELSE
 BEGIN
  GRANT SELECT ON OBJECT::academico.Clientes TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.Rutas TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.Visitas TO chatbot_web;
 END;
 COMMIT;
 SELECT DB_NAME() AS BaseAzure,N'chatbot_web' AS UsuarioAplicacion;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
