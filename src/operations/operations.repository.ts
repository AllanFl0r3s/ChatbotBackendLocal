import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class OperationsRepository {
  constructor(@InjectDataSource('prodConnection') private readonly db: DataSource) {}
  private async query(sql: string, args: unknown[]) {
    try { return await this.db.query(sql, args); }
    catch { throw new ServiceUnavailableException('No fue posible consultar cartera o rutas. Revisa la conexión y la migración 011.'); }
  }
  async territory(route: string) {
    const rows = await this.query(`SELECT r.Codigo,r.Nombre,t.Municipio,t.Departamento,t.Zona
      FROM academico.Rutas r JOIN academico.RutaTerritorio t ON t.RutaId=r.Id
      WHERE r.Codigo=@0 AND r.Activa=1`, [route]);
    return rows[0] ?? null;
  }
  clients(route: string, date: string, page: number, filter: 'all'|'visited'|'unvisited') {
    return this.query(`WITH Clients AS (
      SELECT c.Id,c.Codigo,c.Nombre,COUNT(v.Id) AS Registros
      FROM academico.Clientes c
      LEFT JOIN academico.Visitas v ON v.ClienteId=c.Id
        AND v.RutaId=(SELECT Id FROM academico.Rutas WHERE Codigo=@0)
        AND v.FechaHora>=DATEADD(hour,6,CAST(CAST(@1 AS date) AS datetime2))
        AND v.FechaHora<DATEADD(day,1,DATEADD(hour,6,CAST(CAST(@1 AS date) AS datetime2)))
      WHERE c.Activo=1 AND EXISTS(SELECT 1 FROM academico.ClienteRuta cr JOIN academico.Rutas r ON r.Id=cr.RutaId
        WHERE cr.ClienteId=c.Id AND r.Codigo=@0 AND r.Activa=1
          AND cr.Desde<=CAST(@1 AS date) AND (cr.Hasta IS NULL OR cr.Hasta>=CAST(@1 AS date)))
      GROUP BY c.Id,c.Codigo,c.Nombre
    ), Filtered AS (SELECT * FROM Clients WHERE @2='all' OR (@2='visited' AND Registros>0) OR (@2='unvisited' AND Registros=0)),
    Ranked AS (SELECT *,COUNT(*) OVER() AS Total,ROW_NUMBER() OVER(ORDER BY Codigo) AS rn FROM Filtered)
    SELECT Codigo,Nombre,Registros,Total FROM Ranked WHERE rn>@3 AND rn<=@4 ORDER BY rn`,
    [route,date,filter,page*5,page*5+5]);
  }
  async summary(route: string, today: string) {
    const rows = await this.query(`SELECT COUNT(*) AS Documentos,COALESCE(SUM(d.Monto-d.Pagado),0) AS Saldo,
      COALESCE(SUM(CASE WHEN d.Vencimiento<CAST(@1 AS date) THEN d.Monto-d.Pagado ELSE 0 END),0) AS Vencido,
      COALESCE(SUM(CASE WHEN d.Vencimiento BETWEEN CAST(@1 AS date) AND DATEADD(day,7,CAST(@1 AS date)) THEN d.Monto-d.Pagado ELSE 0 END),0) AS Proximos
      FROM academico.CarteraDocumentos d JOIN academico.Clientes c ON c.Id=d.ClienteId
      WHERE d.Monto>d.Pagado AND d.Emision<=CAST(@1 AS date) AND c.Activo=1
        AND EXISTS(SELECT 1 FROM academico.ClienteRuta cr JOIN academico.Rutas r ON r.Id=cr.RutaId
          WHERE cr.ClienteId=c.Id AND r.Codigo=@0 AND r.Activa=1
          AND cr.Desde<=CAST(@1 AS date) AND (cr.Hasta IS NULL OR cr.Hasta>=CAST(@1 AS date)))`,[route,today]);
    return rows[0];
  }
  wallet(route: string, today: string, page: number, mode: number, client?: string) {
    return this.query(`WITH Documents AS (
      SELECT d.Numero,c.Codigo,c.Nombre,CONVERT(varchar(10),d.Vencimiento,23) AS Vencimiento,
        d.Monto-d.Pagado AS Saldo,CASE WHEN d.Vencimiento<CAST(@1 AS date) THEN 1 ELSE 0 END AS Vencido
      FROM academico.CarteraDocumentos d JOIN academico.Clientes c ON c.Id=d.ClienteId
      WHERE d.Monto>d.Pagado AND d.Emision<=CAST(@1 AS date) AND c.Activo=1
        AND (@2<>2 OR d.Vencimiento<CAST(@1 AS date))
        AND (@2<>3 OR c.Codigo=@3)
        AND (@2<>4 OR d.Vencimiento BETWEEN CAST(@1 AS date) AND DATEADD(day,7,CAST(@1 AS date)))
        AND EXISTS(SELECT 1 FROM academico.ClienteRuta cr JOIN academico.Rutas r ON r.Id=cr.RutaId
          WHERE cr.ClienteId=c.Id AND r.Codigo=@0 AND r.Activa=1
          AND cr.Desde<=CAST(@1 AS date) AND (cr.Hasta IS NULL OR cr.Hasta>=CAST(@1 AS date)))
    ), Ranked AS (SELECT *,COUNT(*) OVER() AS Total,ROW_NUMBER() OVER(ORDER BY Vencimiento,Numero) AS rn FROM Documents)
    SELECT * FROM Ranked WHERE rn>@4 AND rn<=@5 ORDER BY rn`,[route,today,mode,client??'',page*5,page*5+5]);
  }
}
