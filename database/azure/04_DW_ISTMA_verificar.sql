SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
-- Solo este servidor academico de Azure y la base indicada. No cambia de conexion.
IF COALESCE(CONVERT(int,SERVERPROPERTY('EngineEdition')),0) <> 5
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') NOT IN
 (N'sql-chatbot-allanflores-2026',N'sql-chatbot-allanflores-2026.database.windows.net')
 OR DB_NAME() <> N'DW_ISTMA'
 THROW 51900,N'Destino incorrecto: selecciona DW_ISTMA en el servidor Azure academico.',1;
IF @@TRANCOUNT <> 0 THROW 51901,N'Ejecutar sin transaccion abierta.',1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value)=N'DEMOSTRACION AZURE - DATOS FICTICIOS')
 THROW 51902,N'Falta la marca de entorno Azure academico.',1;
EXEC(N'SELECT N''Clientes'' AS Tabla, COUNT(*) AS Registros FROM academico.Clientes
UNION ALL SELECT N''Rutas'',COUNT(*) FROM academico.Rutas
UNION ALL SELECT N''ClienteRuta'',COUNT(*) FROM academico.ClienteRuta
UNION ALL SELECT N''Visitas'',COUNT(*) FROM academico.Visitas
UNION ALL SELECT N''Categorias'',COUNT(*) FROM academico.Categorias
UNION ALL SELECT N''Productos'',COUNT(*) FROM academico.Productos
UNION ALL SELECT N''Bodegas'',COUNT(*) FROM academico.Bodegas
UNION ALL SELECT N''Existencias'',COUNT(*) FROM academico.Existencias;
DECLARE @clientes int,@visitas int;
SELECT @clientes=COUNT(DISTINCT v.ClienteId),@visitas=COUNT(*)
FROM academico.Visitas v JOIN academico.Rutas r ON r.Id=v.RutaId
WHERE r.Codigo=N''S08'' AND v.FechaHora>=''2026-11-05T06:00:00'' AND v.FechaHora<''2026-11-06T06:00:00'';
IF @clientes<>9 OR @visitas<>13 THROW 51910,N''Fallo en consulta de visitas S08.'',1;
SELECT N''S08'' AS Ruta,N''2026-11-05'' AS FechaHonduras,@clientes AS ClientesDistintos,@visitas AS RegistrosVisita;
SELECT DB_NAME() AS BaseAzure,CONVERT(nvarchar(128),SERVERPROPERTY(''ServerName'')) AS Servidor;');
