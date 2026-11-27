/* Solo lectura: validar la muestra después de 011 en DW_ISTMA académica. */
SET NOCOUNT ON;
IF DB_NAME()<>N'DW_ISTMA' THROW 52700,N'Seleccionar DW_ISTMA académica.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value) IN(N'DEMOSTRACION LOCAL - DATOS FICTICIOS',N'DEMOSTRACION AZURE - DATOS FICTICIOS'))
 THROW 52701,N'Falta la marca de demostración.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=11 AND Nombre=N'011_cortes_cartera_navidad')
 THROW 52702,N'Primero ejecutar 011.',1;
IF (SELECT COUNT(*) FROM academico.RutaTerritorio)<>10
 OR EXISTS(SELECT 1 FROM academico.RutaTerritorio WHERE Departamento<>N'Cortés' OR Zona<>N'NORTE')
 THROW 52703,N'La muestra debe tener diez sectores de Cortés en zona NORTE.',1;
IF (SELECT COUNT(*) FROM academico.CarteraDocumentos WHERE Numero LIKE N'FAC-DEMO-CORT-S%')<>20
 OR (SELECT SUM(Monto-Pagado) FROM academico.CarteraDocumentos WHERE Numero LIKE N'FAC-DEMO-CORT-S%')<>13000
 THROW 52704,N'La cartera de referencia no coincide con 20 documentos y L 13000.',1;
IF (SELECT COUNT(*) FROM academico.Visitas WHERE CodigoRevision=N'NAVIDAD-DEMO')<>20
 THROW 52705,N'La muestra debe contener veinte registros nuevos de visita.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.VWchatbot_PROMOCIONES_SUGERIDAS WHERE sku=N'PT990000001'
 AND startsOn='2026-11-27' AND endsOn='2026-12-31' AND buyQuantity=6 AND bonusQuantity=1)
 THROW 52706,N'La promoción navideña no coincide con la condición 6+1 y su vigencia.',1;
IF (SELECT SUM(StockTotal) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>497
 THROW 52707,N'El inventario de referencia cambió.',1;
SELECT r.Codigo,t.Municipio,t.Departamento,t.Zona FROM academico.Rutas r JOIN academico.RutaTerritorio t ON t.RutaId=r.Id ORDER BY r.Codigo;
SELECT N'OK: muestra de Cortés, cartera, registros y promoción navideña' AS Resultado;
