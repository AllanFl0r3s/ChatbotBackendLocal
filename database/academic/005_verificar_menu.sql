/* Solo lectura. Seleccionar DW_ISTMA academica despues de 004.
   Valores exactos de la semilla, antes de editar los datos de demostracion.
   Las promociones vigentes dependen de fecha real; las aserciones usan 14/11/2026.
*/
SET NOCOUNT ON;
IF DB_NAME()<>N'DW_ISTMA' THROW 52100,N'Seleccionar DW_ISTMA academica.',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'Entorno'
 AND CONVERT(nvarchar(128),value) IN(N'DEMOSTRACION AZURE - DATOS FICTICIOS',N'DEMOSTRACION LOCAL - DATOS FICTICIOS'))
 THROW 52101,N'Falta la marca academica.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.__AcademicMigrations WHERE Version=4 AND Nombre=N'004_menu_completo_academico')
 THROW 52102,N'Primero aplicar 004.',1;
IF (SELECT COUNT(*) FROM academico.Vendedores)<>2 OR (SELECT COUNT(*) FROM academico.Pedidos)<>2
 OR (SELECT COUNT(*) FROM academico.PedidoDetalle)<>3 OR (SELECT COUNT(*) FROM academico.Ventas)<>8
 OR (SELECT COUNT(*) FROM academico.Proyecciones)<>7 OR (SELECT COUNT(*) FROM academico.NotasCredito)<>3
 OR (SELECT COUNT(*) FROM academico.Promociones)<>6
 THROW 52103,N'Conteos distintos de la semilla comercial.',1;
IF (SELECT SUM(Unidades) FROM dbo.VWchatbot_PEDIDO_DETALLE_S4 WHERE IdPedido=N'0001001')<>26
 THROW 52104,N'Pedido demo incorrecto.',1;
IF (SELECT SUM(xtndprce+IMPUESTO-descuentoNormal-descuentoEspecial) FROM dbo.VentasCasaMarca
 WHERE ITEMNMBR=N'PT990000001' AND Mes=11 AND Anio=2026)<>502.50
 THROW 52105,N'Venta por producto incorrecta.',1;
IF (SELECT SUM(xtndprce+IMPUESTO-descuentoNormal-descuentoEspecial) FROM dbo.VentasCasaMarca
 WHERE SLPRSNID=N'DEMO01' AND Mes=11 AND Anio=2026)<>1772.00
 THROW 52106,N'Venta por vendedor incorrecta.',1;
IF (SELECT SUM(Cajas) FROM dbo.Proyecciones_TEST WHERE sku=N'PT990000001' AND mes=11 AND anio=2026)<>15
 THROW 52107,N'Proyeccion por producto incorrecta.',1;
IF (SELECT SUM(Cajas) FROM dbo.Proyecciones_TEST WHERE sku=N'PT990000001' AND Zona=N'NORTE' AND mes=11 AND anio=2026)<>10
 THROW 52108,N'Proyeccion por zona incorrecta.',1;
IF (SELECT SUM(TOTAL) FROM dbo.ZFI_NOTAS_CREDITO WHERE COD_CLIENTE=N'DEMO001')<>75
 THROW 52109,N'Notas de credito incorrectas.',1;
IF (SELECT COUNT(*) FROM academico.Promociones WHERE Activa=1 AND CONVERT(date,'20261114') BETWEEN Desde AND Hasta)<>3
 THROW 52110,N'Filtro de vigencia incorrecto en la fecha de referencia.',1;
IF (SELECT SUM(StockTotal) FROM dbo.VWchatbot_STOCK_S4_PRODUCTO)<>497
 THROW 52111,N'Las existencias ya no coinciden con la semilla inicial.',1;

/* En Azure comprueba las vistas con el usuario limitado, sin mostrar secretos.
   Los privilegios para crear tablas NO se conceden al proceso de la aplicacion.
*/
IF USER_ID(N'chatbot_web') IS NOT NULL
BEGIN
 BEGIN TRY
  EXECUTE AS USER=N'chatbot_web';
  SELECT COUNT(*) AS ProductosLegibles FROM dbo.IV00101;
  SELECT COUNT(*) AS VendedoresLegibles FROM dbo.RM00301;
  SELECT COUNT(*) AS VentasLegibles FROM dbo.VentasCasaMarca;
  SELECT COUNT(*) AS ProyeccionesLegibles FROM dbo.Proyecciones_TEST;
  SELECT COUNT(*) AS ProyeccionesCompatibles FROM dbo.proyecciones2026;
  SELECT COUNT(*) AS PedidosLegibles FROM dbo.VWchatbot_PEDIDO_DETALLE_S4;
  SELECT COUNT(*) AS NotasLegibles FROM dbo.ZFI_NOTAS_CREDITO;
  SELECT COUNT(*) AS ProductosConPromocionLegibles FROM pbx.TMP_IV00101;
  REVERT;
 END TRY
 BEGIN CATCH
  IF USER_NAME()=N'chatbot_web' REVERT;
  THROW;
 END CATCH;
END;
SELECT N'OK: semilla, formulas y compatibilidad del menu comprobadas' AS Resultado;
