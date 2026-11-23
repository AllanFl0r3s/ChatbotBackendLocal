-- Solo lectura. Ejecutar en DW_ISTMA académica después de 006.
IF DB_NAME()<>N'DW_ISTMA' THROW 52120,N'Selecciona DW_ISTMA académica.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno' AND CONVERT(nvarchar(128),value) LIKE N'DEMOSTRACION%DATOS FICTICIOS')
 THROW 52121,N'La base no está marcada como demostración.',1;
SELECT Version,Nombre,AplicadaEn FROM dbo.__AcademicMigrations WHERE Version=6;
SELECT Route,COUNT(DISTINCT ClientCode) AS Clientes FROM dbo.VWchatbot_CLIENTES_RUTA GROUP BY Route;
SELECT Route,ClientCode,COUNT(*) AS Registros,COUNT(DISTINCT sku) AS Productos,MAX(PurchaseDate) AS UltimaCompra
FROM dbo.VWchatbot_HISTORIAL_COMPRAS GROUP BY Route,ClientCode;
SELECT id,sku,startsOn,endsOn FROM dbo.VWchatbot_PROMOCIONES_SUGERIDAS ORDER BY id;
-- A noviembre de 2026: DEMO001/S08 tiene ventas; DEMO002 permite probar ausencia de compras.
