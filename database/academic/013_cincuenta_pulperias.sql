/* DW_ISTMA académica, después de 011. Cincuenta pulperías ficticias:
   cinco por vendedor y ruta S01-S10, con códigos CLI-001 a CLI-050.
   Reutiliza clientes ficticios conservando sus IDs y relaciones históricas.
   No modifica ventas, inventario, pagos anteriores ni cuentas de acceso. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'DW_ISTMA' OR @@TRANCOUNT<>0 THROW 52800,N'Seleccionar DW_ISTMA sin transacción abierta.',1;
DECLARE @azure bit=CASE WHEN CONVERT(int,SERVERPROPERTY('EngineEdition'))=5
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net') THEN 1 ELSE 0 END;
DECLARE @local bit=CASE WHEN CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName'))=N'SQLEXPRESS'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) LIKE N'%Express%'
 AND UPPER(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')))=UPPER(HOST_NAME()) THEN 1 ELSE 0 END;
IF @azure=0 AND @local=0 THROW 52801,N'Destino no autorizado para esta demostración.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=CASE WHEN @azure=1 THEN N'DEMOSTRACION AZURE - DATOS FICTICIOS'
 ELSE N'DEMOSTRACION LOCAL - DATOS FICTICIOS' END)
 THROW 52802,N'Falta la marca de demostración.',1;
IF OBJECT_ID(N'dbo.__AcademicMigrations',N'U') IS NULL THROW 52803,N'Falta el esquema académico.',1;
EXEC(N'BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''chatbot-academico-migrations'',
  @LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 52804,N''Otra migración está en curso.'',1;
 IF EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=13)
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=13 AND Nombre=N''013_cincuenta_pulperias'')
   THROW 52805,N''Versión 013 ocupada por otro cambio.'',1;
  IF OBJECT_ID(N''academico.VendedorClientes'',N''U'') IS NULL
   OR EXISTS(SELECT 1 FROM academico.Vendedores v LEFT JOIN academico.VendedorClientes vc ON vc.VendedorId=v.Id
    GROUP BY v.Id HAVING COUNT(vc.ClienteId)<>5)
   THROW 52806,N''La asignación cambió después de 013; revisar sin sobrescribir.'',1;
  COMMIT; PRINT N''013 ya aplicada; no se restauraron nombres, saldos ni asignaciones.''; RETURN;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=11 AND Nombre=N''011_cortes_cartera_navidad'')
  THROW 52807,N''Primero ejecutar 011_cortes_cartera_navidad.sql.'',1;
 IF OBJECT_ID(N''academico.VendedorClientes'') IS NOT NULL
  OR (SELECT COUNT(*) FROM academico.Clientes)<>34
  OR (SELECT COUNT(*) FROM academico.Clientes WHERE Activo=1)<>33
  OR EXISTS(SELECT 1 FROM academico.Clientes WHERE Codigo LIKE N''CLI-%'')
  THROW 52808,N''Los clientes no coinciden con la muestra anterior. No se reemplazó ningún dato.'',1;
 IF (SELECT COUNT(*) FROM academico.Vendedores)<>10 OR (SELECT COUNT(*) FROM academico.RutaTerritorio)<>10
  THROW 52809,N''Se requieren diez vendedores y diez sectores de Cortés.'',1;
 DECLARE @Legacy TABLE(Ruta nvarchar(20),Posicion int,Codigo nvarchar(20));
 INSERT @Legacy VALUES
 (N''S01'',3,N''DEMO007''),(N''S01'',4,N''DEMO008''),(N''S01'',5,N''DEMO009''),
 (N''S02'',3,N''DEMO010''),(N''S02'',4,N''DEMO012''),(N''S02'',5,N''DEMO013''),
 (N''S03'',3,N''DEMO014''),
 (N''S08'',3,N''DEMO001''),(N''S08'',4,N''DEMO002''),(N''S08'',5,N''DEMO003''),
 (N''S09'',3,N''DEMO004''),(N''S09'',4,N''DEMO005''),(N''S09'',5,N''DEMO006'');
 DECLARE @Map TABLE(Ruta nvarchar(20),RutaId int,VendedorId int,Posicion int,
  CodigoAnterior nvarchar(20) NULL,Codigo nvarchar(20) PRIMARY KEY,Nombre nvarchar(150),ClienteId int NULL);
 INSERT @Map(Ruta,RutaId,VendedorId,Posicion,CodigoAnterior,Codigo,Nombre)
 SELECT r.Codigo,r.Id,v.Id,n.Posicion,
  CASE WHEN n.Posicion<=2 THEN N''CORT-''+r.Codigo+N''-0''+CONVERT(nvarchar(1),n.Posicion) ELSE l.Codigo END,
  N''CLI-''+RIGHT(N''000''+CONVERT(nvarchar(3),(CONVERT(int,SUBSTRING(r.Codigo,2,2))-1)*5+n.Posicion),3),
  N''Pulpería ''+n.Nombre+N'' · ''+t.Municipio
 FROM academico.Rutas r JOIN academico.RutaTerritorio t ON t.RutaId=r.Id
 JOIN academico.Vendedores v ON v.Codigo=r.Codigo
 CROSS JOIN (VALUES(1,N''La Bendición''),(2,N''El Ahorro''),(3,N''Doña Rosa''),(4,N''El Buen Vecino''),(5,N''La Esperanza''))n(Posicion,Nombre)
 LEFT JOIN @Legacy l ON l.Ruta=r.Codigo AND l.Posicion=n.Posicion
 WHERE r.Activa=1 AND t.Zona=N''NORTE'' AND t.Departamento=N''Cortés'';
 IF (SELECT COUNT(*) FROM @Map)<>50 THROW 52810,N''No se resolvieron cincuenta pulperías.'',1;
 IF EXISTS(SELECT 1 FROM @Map m JOIN academico.RutaTerritorio t ON t.RutaId=m.RutaId
  LEFT JOIN academico.Clientes c WITH(UPDLOCK,HOLDLOCK) ON c.Codigo=m.CodigoAnterior
  WHERE m.CodigoAnterior IS NOT NULL AND (c.Id IS NULL OR c.Activo<>1
   OR (m.Posicion<=2 AND c.Nombre<>N''Comercio ficticio ''+t.Municipio+N'' ''+CONVERT(nvarchar(1),m.Posicion))
   OR (m.Posicion>2 AND c.Nombre<>N''Comercio Ficticio ''+RIGHT(m.CodigoAnterior,2))))
  THROW 52811,N''Un cliente anterior fue personalizado; revisar sin sobrescribir.'',1;
 IF EXISTS(SELECT 1 FROM academico.ClienteRuta cr JOIN academico.Clientes c ON c.Id=cr.ClienteId
  JOIN @Map m ON m.CodigoAnterior=c.Codigo WHERE cr.Desde>CONVERT(date,''20261127'',112))
  THROW 52812,N''Hay asignaciones futuras que requieren revisión.'',1;
 UPDATE m SET ClienteId=c.Id FROM @Map m JOIN academico.Clientes c ON c.Codigo=m.CodigoAnterior;
 UPDATE c SET Codigo=m.Codigo,Nombre=m.Nombre FROM academico.Clientes c JOIN @Map m ON m.ClienteId=c.Id;
 INSERT academico.Clientes(Codigo,Nombre,Activo) SELECT Codigo,Nombre,1 FROM @Map WHERE ClienteId IS NULL;
 UPDATE m SET ClienteId=c.Id FROM @Map m JOIN academico.Clientes c ON c.Codigo=m.Codigo;
 -- Se cierra únicamente la pertenencia anterior de clientes trasladados. Las visitas e IDs permanecen.
 UPDATE cr SET Hasta=CONVERT(date,''20261126'',112)
 FROM academico.ClienteRuta cr JOIN @Map m ON m.ClienteId=cr.ClienteId
 WHERE cr.RutaId<>m.RutaId AND cr.Desde<=CONVERT(date,''20261126'',112)
 AND (cr.Hasta IS NULL OR cr.Hasta>=CONVERT(date,''20261127'',112));
 INSERT academico.ClienteRuta(ClienteId,RutaId,Desde)
 SELECT ClienteId,RutaId,CONVERT(date,''20261127'',112) FROM @Map m
 WHERE NOT EXISTS(SELECT 1 FROM academico.ClienteRuta cr WHERE cr.ClienteId=m.ClienteId AND cr.RutaId=m.RutaId
  AND cr.Desde<=CONVERT(date,''20261127'',112) AND (cr.Hasta IS NULL OR cr.Hasta>=CONVERT(date,''20261127'',112)));
 CREATE TABLE academico.VendedorClientes(
  ClienteId int PRIMARY KEY REFERENCES academico.Clientes(Id),
  VendedorId int NOT NULL REFERENCES academico.Vendedores(Id),
  RutaId int NOT NULL REFERENCES academico.Rutas(Id),Desde date NOT NULL);
 INSERT academico.VendedorClientes(ClienteId,VendedorId,RutaId,Desde)
 SELECT ClienteId,VendedorId,RutaId,CONVERT(date,''20261127'',112) FROM @Map;
 -- Se conservan los veinte documentos anteriores. Se agregan treinta para los otros clientes.
 IF EXISTS(SELECT 1 FROM academico.CarteraDocumentos WHERE Numero LIKE N''FAC-DEMO-CLI-%'')
  THROW 52813,N''Ya existen documentos con los códigos reservados.'',1;
 INSERT academico.CarteraDocumentos(Numero,ClienteId,Emision,Vencimiento,Monto,Pagado)
 SELECT N''FAC-DEMO-''+Codigo,ClienteId,CONVERT(date,''20261101'',112),
  CONVERT(date,CASE Posicion WHEN 3 THEN ''20261120'' WHEN 4 THEN ''20261215'' ELSE ''20261110'' END,112),
  CASE Posicion WHEN 3 THEN 1500 WHEN 4 THEN 900 ELSE 700 END,
  CASE Posicion WHEN 3 THEN 500 WHEN 4 THEN 0 ELSE 700 END FROM @Map WHERE Posicion>=3;
 IF EXISTS(SELECT v.Id FROM academico.Vendedores v LEFT JOIN academico.VendedorClientes vc ON vc.VendedorId=v.Id
  GROUP BY v.Id HAVING COUNT(vc.ClienteId)<>5)
  THROW 52814,N''No se asignaron exactamente cinco pulperías por vendedor.'',1;
 IF EXISTS(SELECT r.Id FROM academico.Rutas r LEFT JOIN academico.ClienteRuta cr ON cr.RutaId=r.Id
   AND cr.Desde<=CONVERT(date,''20261127'',112) AND (cr.Hasta IS NULL OR cr.Hasta>=CONVERT(date,''20261127'',112))
  LEFT JOIN academico.Clientes c ON c.Id=cr.ClienteId AND c.Activo=1 GROUP BY r.Id HAVING COUNT(c.Id)<>5)
  THROW 52815,N''Una ruta no tiene exactamente cinco clientes activos.'',1;
 IF EXISTS(SELECT 1 FROM @Map m WHERE (SELECT COUNT(*) FROM academico.CarteraDocumentos d WHERE d.ClienteId=m.ClienteId)<>1)
  THROW 52816,N''La muestra debe tener un documento por pulpería.'',1;
 IF USER_ID(N''chatbot_web'') IS NOT NULL GRANT SELECT ON OBJECT::academico.VendedorClientes TO chatbot_web;
 IF USER_ID(N''chatbot_demo'') IS NOT NULL GRANT SELECT ON OBJECT::academico.VendedorClientes TO chatbot_demo;
 INSERT dbo.__AcademicMigrations(Version,Nombre) VALUES(13,N''013_cincuenta_pulperias'');
 COMMIT; PRINT N''Cincuenta pulperías ficticias preparadas con vendedor, ruta y cartera.'';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;');
SELECT v.Codigo AS Vendedor,r.Codigo AS Ruta,c.Codigo AS PulperiaId,c.Nombre,d.Numero,
 d.Monto,d.Pagado,d.Monto-d.Pagado AS Saldo,d.Vencimiento
FROM academico.VendedorClientes vc JOIN academico.Vendedores v ON v.Id=vc.VendedorId
JOIN academico.Rutas r ON r.Id=vc.RutaId JOIN academico.Clientes c ON c.Id=vc.ClienteId
JOIN academico.CarteraDocumentos d ON d.ClienteId=c.Id ORDER BY v.Codigo,c.Codigo;
