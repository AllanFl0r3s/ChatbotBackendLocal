/* PASO 2 - DW_ISTMA local: primera demostración de rutas y visitas.
   Conectar a localhost\SQLEXPRESS con Autenticación de Windows.
   Ejecutar TODO el archivo, sin seleccionar fragmentos.
   Crea únicamente una base nueva; se detiene si DW_ISTMA ya existe.
   No usa datos de clientes ni credenciales de la empresa.
   Esta primera etapa NO implementa stock, cartera, ventas ni cotizaciones.
*/
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

-- Evitar ejecución accidental en un servidor empresarial o en otra computadora.
IF COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('Edition')), N'') NOT LIKE N'%Express%'
   OR UPPER(COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'')) <> UPPER(HOST_NAME())
BEGIN
    THROW 51000, N'Detenido: conecta desde esta misma computadora a su instancia local SQLEXPRESS (Express Edition).', 1;
END;
IF DB_ID(N'DW_ISTMA') IS NOT NULL
BEGIN
    THROW 51001, N'DW_ISTMA ya existe en esta instancia. No se ha reemplazado.', 1;
END;
IF @@TRANCOUNT <> 0
BEGIN
    THROW 51002, N'Ejecuta este archivo sin una transacción abierta.', 1;
END;

CREATE DATABASE [DW_ISTMA];
-- Solo ajusta la base LOCAL recién creada al nivel que observamos en la empresa.
ALTER DATABASE [DW_ISTMA] SET COMPATIBILITY_LEVEL = 100;

EXEC(N'
USE [DW_ISTMA];
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    EXEC sys.sp_addextendedproperty
        @name=N''Entorno'', @value=N''DEMOSTRACION LOCAL - DATOS FICTICIOS'';

    -- Los esquemas organizan objetos: paco conserva los nombres que consulta el backend.
    EXEC(N''CREATE SCHEMA paco AUTHORIZATION dbo;'');
    EXEC(N''CREATE SCHEMA demo AUTHORIZATION dbo;'');

    -- Tabla auxiliar propia de la demostración: no representa una tabla empresarial.
    CREATE TABLE demo.Clientes (
        Numero int NOT NULL PRIMARY KEY,
        Codigo nvarchar(20) NOT NULL UNIQUE,
        Nombre nvarchar(150) NOT NULL,
        Ruta nvarchar(20) NOT NULL
    );

    -- Columnas y tipos básicos tomados del inventario de la fuente empresarial.
    -- Las longitudes y restricciones son locales, porque no tenemos su DDL completo.
    CREATE TABLE paco.APP_LR_S4HANA (
        Code varchar(50) NOT NULL PRIMARY KEY,
        Ruta varchar(20) NOT NULL,
        Cliente varchar(20) NOT NULL,
        Semana varchar(10) NULL,
        Dias int NULL,
        Orden int NULL,
        CodigoAnterior varchar(30) NULL
    );

    -- Fecha y Hora se mantienen como texto, tal como las recibe la consulta del backend.
    CREATE TABLE paco.APP_RV (
        IDVisita int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID int NULL,
        Ruta nvarchar(20) NOT NULL,
        Liquidacion nvarchar(50) NULL,
        Cliente nvarchar(20) NOT NULL,
        Fecha nvarchar(50) NOT NULL,
        CodigoRevision nvarchar(20) NULL,
        EnRuta nvarchar(1) NULL,
        Hora nvarchar(10) NULL,
        Latitud nvarchar(50) NULL,
        Longitud nvarchar(50) NULL,
        Semana nvarchar(10) NULL,
        Comentario nvarchar(500) NULL,
        IDListaVisita_IDListaVisita int NULL
    );
    CREATE INDEX IX_APP_RV_RutaCliente ON paco.APP_RV(Ruta, Cliente);

    -- Códigos, nombres y movimientos creados desde cero: no se copiaron clientes reales.
    INSERT INTO demo.Clientes (Numero, Codigo, Nombre, Ruta)
    SELECT n,
        N''DEMO'' + RIGHT(N''000'' + CONVERT(nvarchar(3), n), 3),
        N''Comercio Ficticio '' + RIGHT(N''00'' + CONVERT(nvarchar(2), n), 2),
        CASE WHEN n <= 11 THEN N''S08'' ELSE N''S09'' END
    FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14)) AS numeros(n);

    INSERT INTO paco.APP_LR_S4HANA (Code, Ruta, Cliente, Semana, Dias, Orden)
    SELECT
        ''DEMO-LR-'' + CONVERT(varchar(3), Numero),
        CONVERT(varchar(20), Ruta),
        CONVERT(varchar(20), Codigo),
        ''S1'', 1,
        CASE WHEN Numero <= 11 THEN Numero ELSE Numero - 11 END
    FROM demo.Clientes;
    -- S1/Dias=1 son valores ficticios de programación; no prueban el calendario real.

    -- Fecha del día en Honduras: UTC-6. Se fija al crear la demostración.
    -- Si se usa otro día, consultar el valor FechaDemostracion del resultado final.
    DECLARE @FechaDemo date = CONVERT(date, DATEADD(hour, -6, SYSUTCDATETIME()));
    DECLARE @Ayer date = DATEADD(day, -1, @FechaDemo);

    -- S08: 9 clientes distintos y 13 registros; cuatro clientes aparecen dos veces.
    INSERT INTO paco.APP_RV
        (Ruta, Cliente, Fecha, CodigoRevision, EnRuta, Hora, Semana, Comentario)
    SELECT
        N''S08'', c.Codigo,
        CASE WHEN v.n = 1 AND v.hora = N''0900''
             THEN CONVERT(nvarchar(4), YEAR(@FechaDemo)) + N''-'' +
                  CONVERT(nvarchar(2), MONTH(@FechaDemo)) + N''-'' +
                  CONVERT(nvarchar(2), DAY(@FechaDemo)) + N''T09:00:00''
             ELSE CONVERT(nvarchar(10), @FechaDemo, 23) END,
        N''P'', v.enruta, v.hora, N''S1'', N''DATO FICTICIO - visita de demostración''
    FROM (VALUES
        (1,N''0900'',N''S''), (2,N''0910'',N''S''), (3,N''0920'',N''S''),
        (4,N''0930'',N''N''), (5,N''0940'',N''S''), (6,N''0950'',N''S''),
        (7,N''1000'',N''S''), (8,N''1010'',N''N''), (9,N''1020'',N''S''),
        (1,N''1030'',N''S''), (3,N''1040'',N''S''), (5,N''1050'',N''S''), (7,N''1100'',N''S'')
    ) AS v(n,hora,enruta)
    INNER JOIN demo.Clientes AS c ON c.Numero = v.n;

    -- S09 permite comprobar que filtrar por S08 no devuelve datos de otra ruta.
    INSERT INTO paco.APP_RV
        (Ruta, Cliente, Fecha, CodigoRevision, EnRuta, Hora, Semana, Comentario)
    SELECT N''S09'', Codigo, CONVERT(nvarchar(10), @FechaDemo, 23),
        N''P'', N''S'', N''1200'', N''S1'', N''DATO FICTICIO - otra ruta''
    FROM demo.Clientes WHERE Numero BETWEEN 12 AND 14;

    -- Dos registros de ayer permiten comprobar el filtro por fecha.
    INSERT INTO paco.APP_RV
        (Ruta, Cliente, Fecha, CodigoRevision, EnRuta, Hora, Semana, Comentario)
    SELECT N''S08'', Codigo, CONVERT(nvarchar(10), @Ayer, 23),
        N''P'', N''S'', N''0900'', N''S1'', N''DATO FICTICIO - día anterior''
    FROM demo.Clientes WHERE Numero IN (1, 10);

    COMMIT TRANSACTION;

    SELECT
        CAST(SERVERPROPERTY(''ServerName'') AS nvarchar(128)) AS Servidor,
        DB_NAME() AS BaseLocal,
        N''DEMOSTRACION LOCAL - DATOS FICTICIOS'' AS Entorno,
        @FechaDemo AS FechaDemostracion;

    SELECT N''demo.Clientes'' AS Tabla, COUNT(*) AS Registros FROM demo.Clientes
    UNION ALL SELECT N''paco.APP_LR_S4HANA'', COUNT(*) FROM paco.APP_LR_S4HANA
    UNION ALL SELECT N''paco.APP_RV'', COUNT(*) FROM paco.APP_RV;

    -- Mismo criterio que el endpoint: clientes distintos y registros de hoy por ruta.
    SELECT
        LTRIM(RTRIM(Ruta)) AS Ruta,
        COUNT(DISTINCT LTRIM(RTRIM(Cliente))) AS ClientesDistintos,
        COUNT(*) AS RegistrosDeVisita
    FROM paco.APP_RV
    WHERE TRY_CAST(Fecha AS date) = @FechaDemo
    GROUP BY LTRIM(RTRIM(Ruta))
    ORDER BY Ruta;

    SELECT c.Codigo, c.Nombre, COUNT(*) AS RegistrosDeVisita
    FROM paco.APP_RV AS v
    INNER JOIN demo.Clientes AS c ON c.Codigo = LTRIM(RTRIM(v.Cliente))
    WHERE LTRIM(RTRIM(v.Ruta)) = N''S08''
      AND TRY_CAST(v.Fecha AS date) = @FechaDemo
    GROUP BY c.Codigo, c.Nombre
    ORDER BY c.Codigo;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
');
