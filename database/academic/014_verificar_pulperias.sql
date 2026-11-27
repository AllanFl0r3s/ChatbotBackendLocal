/* Solo lectura: muestra de cincuenta pulperías después de 013, DW_ISTMA. */
SET NOCOUNT ON;
IF DB_NAME()<>N'DW_ISTMA' THROW 52900,N'Seleccionar DW_ISTMA académica.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value) IN(N'DEMOSTRACION LOCAL - DATOS FICTICIOS',N'DEMOSTRACION AZURE - DATOS FICTICIOS'))
 THROW 52901,N'Falta la marca de demostración.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=13 AND Nombre=N'013_cincuenta_pulperias')
 THROW 52902,N'Primero preparar 013.',1;
IF (SELECT COUNT(*) FROM academico.VendedorClientes)<>50
 OR (SELECT COUNT(*) FROM academico.Clientes WHERE Activo=1)<>50
 OR EXISTS(SELECT v.Id FROM academico.Vendedores v LEFT JOIN academico.VendedorClientes vc ON vc.VendedorId=v.Id GROUP BY v.Id HAVING COUNT(vc.ClienteId)<>5)
 THROW 52903,N'Se requieren cincuenta pulperías y cinco por vendedor.',1;
IF EXISTS(SELECT 1 FROM academico.VendedorClientes vc JOIN academico.Clientes c ON c.Id=vc.ClienteId
 JOIN academico.Vendedores v ON v.Id=vc.VendedorId JOIN academico.Rutas r ON r.Id=vc.RutaId
 JOIN academico.RutaTerritorio t ON t.RutaId=r.Id
 WHERE r.Codigo<>v.Codigo OR c.Nombre NOT LIKE N'Pulpería %' OR c.Activo<>1
 OR c.Codigo NOT LIKE N'CLI-[0-9][0-9][0-9]' OR t.Departamento<>N'Cortés' OR t.Zona<>N'NORTE'
 OR TRY_CAST(SUBSTRING(c.Codigo,5,3) AS int) NOT BETWEEN (CONVERT(int,SUBSTRING(v.Codigo,2,2))-1)*5+1 AND CONVERT(int,SUBSTRING(v.Codigo,2,2))*5
 OR NOT EXISTS(SELECT 1 FROM academico.ClienteRuta cr WHERE cr.ClienteId=c.Id AND cr.RutaId=r.Id
  AND cr.Desde<='20261127' AND (cr.Hasta IS NULL OR cr.Hasta>='20261127')))
 THROW 52904,N'La identificación, ruta, vendedor o territorio no coincide con la muestra.',1;
IF (SELECT COUNT(*) FROM academico.CarteraDocumentos)<>50
 OR (SELECT SUM(Monto-Pagado) FROM academico.CarteraDocumentos)<>32000
 OR (SELECT COUNT(*) FROM academico.CarteraDocumentos WHERE Monto=Pagado)<>10
 OR EXISTS(SELECT vc.ClienteId FROM academico.VendedorClientes vc LEFT JOIN academico.CarteraDocumentos d ON d.ClienteId=vc.ClienteId GROUP BY vc.ClienteId HAVING COUNT(d.Numero)<>1)
 THROW 52905,N'La muestra requiere cincuenta documentos, diez pagados y L 32000 pendientes.',1;
IF COALESCE((SELECT SUM(Monto-Pagado) FROM academico.CarteraDocumentos WHERE Vencimiento<'20261127'),0)<>18000
 THROW 52906,N'El saldo vencido de referencia debe ser L 18000 al 27/11/2026.',1;
IF (SELECT SUM(StockTotal) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>497 OR (SELECT COUNT(*) FROM academico.Ventas)<>8
 THROW 52907,N'Cambió el inventario o la cantidad de ventas de referencia.',1;
SELECT v.Codigo AS Vendedor,r.Codigo AS Ruta,c.Codigo AS PulperiaId,c.Nombre,t.Municipio,
 d.Numero,d.Monto,d.Pagado,d.Monto-d.Pagado AS Saldo,CONVERT(varchar(10),d.Vencimiento,23) AS Vencimiento
FROM academico.VendedorClientes vc JOIN academico.Vendedores v ON v.Id=vc.VendedorId
JOIN academico.Rutas r ON r.Id=vc.RutaId JOIN academico.RutaTerritorio t ON t.RutaId=r.Id
JOIN academico.Clientes c ON c.Id=vc.ClienteId JOIN academico.CarteraDocumentos d ON d.ClienteId=c.Id
ORDER BY v.Codigo,c.Codigo;
