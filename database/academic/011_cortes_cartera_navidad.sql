/* DW_ISTMA académica. Ejecutar completo antes de publicar el backend.
   Rutas y clientes ficticios en Cortés; cartera ficticia y promoción navideña 6+1.
   No modifica cantidades de inventario, ventas, visitas anteriores ni cuentas. */
SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'DW_ISTMA' OR @@TRANCOUNT<>0 THROW 52600,N'Seleccionar DW_ISTMA sin transacción abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52601,N'Destino no autorizado para esta demostración.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS'
 ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52602,N'Falta la marca de demostración.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL THROW 52603,N'Falta el esquema académico.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',
  @LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 52604,N''Otra migración está en curso.'',1;
 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=11)
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=11 AND Nombre=N''011_cortes_cartera_navidad'')
   THROW 52605,N''Versión 011 ocupada por otra migración.'',1;
  IF OBJECT_ID(N''academico.RutaTerritorio'',N''U'') IS NULL OR OBJECT_ID(N''academico.CarteraDocumentos'',N''U'') IS NULL
   OR COL_LENGTH(N''academico.Promociones'',N''BuyQuantity'') IS NULL
   THROW 52606,N''Migración 011 registrada pero incompleta.'',1;
  COMMIT; PRINT N''011 ya aplicada; no se restauraron datos ni promociones.''; RETURN;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=9 AND Nombre=N''009_solo_zona_norte'')
  OR NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=6)
  THROW 52607,N''Primero preparar historial 006 y zona NORTE 009.'',1;
 IF OBJECT_ID(N''academico.RutaTerritorio'') IS NOT NULL OR OBJECT_ID(N''academico.CarteraDocumentos'') IS NOT NULL
  OR COL_LENGTH(N''academico.Promociones'',N''BuyQuantity'') IS NOT NULL
  THROW 52608,N''Ya existe otra definición de cartera, territorio o bonificaciones. No se reemplazó.'',1;
 IF EXISTS(SELECT 1 FROM academico.Rutas WHERE Codigo NOT IN(N''S01'',N''S02'',N''S03'',N''S04'',N''S05'',N''S06'',N''S07'',N''S08'',N''S09'',N''S10''))
  THROW 52609,N''Hay rutas fuera del catálogo acordado; revisar antes de continuar.'',1;
 CREATE TABLE academico.RutaTerritorio(
  RutaId int PRIMARY KEY REFERENCES academico.Rutas(Id),Municipio nvarchar(80) NOT NULL,
  Departamento nvarchar(20) NOT NULL CHECK(Departamento=N''Cortés''),Zona nvarchar(20) NOT NULL CHECK(Zona=N''NORTE''));
 DECLARE @Rutas TABLE(Codigo nvarchar(20) PRIMARY KEY,Municipio nvarchar(80));
 INSERT @Rutas VALUES(N''S01'',N''San Pedro Sula''),(N''S02'',N''Choloma''),(N''S03'',N''Villanueva''),
 (N''S04'',N''Puerto Cortés''),(N''S05'',N''La Lima''),(N''S06'',N''San Manuel''),(N''S07'',N''Pimienta''),
 (N''S08'',N''Potrerillos''),(N''S09'',N''Omoa''),(N''S10'',N''San Antonio de Cortés'');
 INSERT academico.Rutas(Codigo,Nombre) SELECT Codigo,N''Ruta de demostración ''+Codigo FROM @Rutas x
  WHERE NOT EXISTS(SELECT 1 FROM academico.Rutas r WHERE r.Codigo=x.Codigo);
 INSERT academico.RutaTerritorio(RutaId,Municipio,Departamento,Zona)
 SELECT r.Id,x.Municipio,N''Cortés'',N''NORTE'' FROM @Rutas x JOIN academico.Rutas r ON r.Codigo=x.Codigo;
 -- Se conservan los clientes DEMO y sus asignaciones anteriores. Dos nuevos ejemplos por ruta.
 IF EXISTS(SELECT 1 FROM academico.Clientes WHERE Codigo LIKE N''CORT-S%'')
  THROW 52610,N''Ya existen clientes con los códigos reservados para esta muestra.'',1;
 INSERT academico.Clientes(Codigo,Nombre,Activo)
 SELECT N''CORT-''+x.Codigo+N''-0''+CONVERT(nvarchar(1),n.Numero),
  N''Comercio ficticio ''+x.Municipio+N'' ''+CONVERT(nvarchar(1),n.Numero),1
 FROM @Rutas x CROSS JOIN (VALUES(1),(2))n(Numero);
 INSERT academico.ClienteRuta(ClienteId,RutaId,Desde)
 SELECT c.Id,r.Id,CONVERT(date,''20261127'',112) FROM @Rutas x JOIN academico.Rutas r ON r.Codigo=x.Codigo
 JOIN academico.Clientes c ON c.Codigo IN(N''CORT-''+x.Codigo+N''-01'',N''CORT-''+x.Codigo+N''-02'');
 CREATE TABLE academico.CarteraDocumentos(
  Numero nvarchar(40) PRIMARY KEY,ClienteId int NOT NULL REFERENCES academico.Clientes(Id),
  Emision date NOT NULL,Vencimiento date NOT NULL,Monto decimal(18,2) NOT NULL,Pagado decimal(18,2) NOT NULL,
  CHECK(Vencimiento>=Emision),CHECK(Monto>0 AND Pagado>=0 AND Pagado<=Monto));
 INSERT academico.CarteraDocumentos(Numero,ClienteId,Emision,Vencimiento,Monto,Pagado)
 SELECT N''FAC-DEMO-''+c.Codigo,c.Id,CASE WHEN RIGHT(c.Codigo,2)=N''01'' THEN ''20261101'' ELSE ''20261120'' END,
  CASE WHEN RIGHT(c.Codigo,2)=N''01'' THEN ''20261115'' ELSE ''20261201'' END,
  CASE WHEN RIGHT(c.Codigo,2)=N''01'' THEN 1000 ELSE 600 END,
  CASE WHEN RIGHT(c.Codigo,2)=N''01'' THEN 200 ELSE 100 END
 FROM academico.Clientes c WHERE c.Codigo LIKE N''CORT-S%'';
 -- Dos registros ficticios del 27/11 por ruta, ambos para el primer cliente.
 -- Permite demostrar que registros de visita y clientes distintos no son lo mismo.
 INSERT academico.Visitas(ClienteId,RutaId,FechaHora,CodigoRevision,EnRuta,Comentario)
 SELECT c.Id,r.Id,DATEADD(minute,n.Minutos,CONVERT(datetime2,''2026-11-27T15:00:00'')),
 N''NAVIDAD-DEMO'',1,N''Registro ficticio para prueba; no acredita visita completada.''
 FROM @Rutas x JOIN academico.Rutas r ON r.Codigo=x.Codigo JOIN academico.Clientes c ON c.Codigo=N''CORT-''+x.Codigo+N''-01''
 CROSS JOIN (VALUES(0),(30))n(Minutos);
 ALTER TABLE academico.Promociones ADD BuyQuantity int NULL,BuyUnit nvarchar(20) NULL,BonusQuantity int NULL,BonusUnit nvarchar(20) NULL;
 EXEC(N''ALTER TABLE academico.Promociones WITH CHECK ADD CONSTRAINT CK_Promociones_Bonificacion CHECK(CASE
  WHEN BuyQuantity IS NULL AND BuyUnit IS NULL AND BonusQuantity IS NULL AND BonusUnit IS NULL THEN 1
  WHEN BuyQuantity>0 AND BonusQuantity>0 AND NULLIF(LTRIM(RTRIM(BuyUnit)),N'''''''') IS NOT NULL
   AND NULLIF(LTRIM(RTRIM(BonusUnit)),N'''''''') IS NOT NULL THEN 1 ELSE 0 END=1);'');
 EXEC(N''UPDATE o SET Desde=''''20261127'''',Hasta=''''20261231'''',Activa=1,
  Descripcion=N''''Promo navideña DEMO 6+1: compra 6 botellas de agua Quartz 600 ml y recibe 1 gratis del mismo producto. Vigencia 27/11/2026 al 31/12/2026. Sujeto a stock; sin validez comercial.'''',
  BuyQuantity=6,BuyUnit=N''''botellas'''',BonusQuantity=1,BonusUnit=N''''botella''''
  FROM academico.Promociones o JOIN academico.ChatProductos p ON p.Id=o.ProductoId WHERE p.CodigoS4=N''''PT990000001'''';
  IF @@ROWCOUNT<>1 THROW 52611,N''''No se encontró la promoción de Quartz 600 ml.'''',1;'');
 EXEC(N''ALTER VIEW dbo.VWchatbot_PROMOCIONES_SUGERIDAS AS SELECT CONCAT(''''DEMO-PROMO-'''',o.Id) AS id,p.CodigoS4 AS sku,p.Nombre AS name,
  CONVERT(varchar(10),o.Desde,23) AS startsOn,CONVERT(varchar(10),o.Hasta,23) AS endsOn,o.Descripcion AS conditions,
  o.BuyQuantity AS buyQuantity,o.BuyUnit AS buyUnit,o.BonusQuantity AS bonusQuantity,o.BonusUnit AS bonusUnit
  FROM academico.Promociones o JOIN academico.ChatProductos p ON p.Id=o.ProductoId WHERE o.Activa=1 AND p.Activo=1'');
 IF USER_ID(N''chatbot_web'') IS NOT NULL
 BEGIN
  GRANT SELECT ON OBJECT::academico.RutaTerritorio TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.CarteraDocumentos TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.ClienteRuta TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.Rutas TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.Clientes TO chatbot_web;
  GRANT SELECT ON OBJECT::academico.Visitas TO chatbot_web;
 END;
 IF USER_ID(N''chatbot_demo'') IS NOT NULL
 BEGIN
  GRANT SELECT ON OBJECT::academico.RutaTerritorio TO chatbot_demo;
  GRANT SELECT ON OBJECT::academico.CarteraDocumentos TO chatbot_demo;
  GRANT SELECT ON OBJECT::academico.ClienteRuta TO chatbot_demo;
  GRANT SELECT ON OBJECT::academico.Rutas TO chatbot_demo;
  GRANT SELECT ON OBJECT::academico.Clientes TO chatbot_demo;
  GRANT SELECT ON OBJECT::academico.Visitas TO chatbot_demo;
 END;
 INSERT dbo.__AcademicMigrations(Version,Nombre) VALUES(11,N''011_cortes_cartera_navidad'');
 COMMIT; PRINT N''011 preparada: diez rutas de Cortés, cartera ficticia y promoción navideña 6+1.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
