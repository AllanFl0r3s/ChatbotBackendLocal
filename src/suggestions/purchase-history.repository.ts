import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { todayInHonduras } from './suggestions.core';

export type HistoryRow = {
  code: string; name: string; document: string | null; date: string | null;
  sku: string | null; unit: string | null; quantity: string | null; purchases: number; total: number;
};

@Injectable()
export class PurchaseHistoryRepository {
  private readonly logger = new Logger(PurchaseHistoryRepository.name);
  constructor(@InjectDataSource('prodConnection') private readonly db: DataSource) {}

  async results(route: string, client: string | undefined, action: number, from: string, to: string, page: number): Promise<HistoryRow[]> {
    // Solo datos académicos. Una fila de Ventas es un registro, no una factura real.
    const source = `WITH Clients AS (
      SELECT DISTINCT ClientCode AS code,ClientName AS name FROM dbo.VWchatbot_CLIENTES_RUTA
      WHERE Route=@0 AND Since<=CAST(@6 AS date) AND (Until IS NULL OR Until>=CAST(@6 AS date))
    ), Purchases AS (
      SELECT ClientCode AS code,sku,ProductName AS name,PurchaseId,PurchaseDate,Quantity
      FROM dbo.VWchatbot_HISTORIAL_COMPRAS WHERE Route=@0 AND PurchaseDate<=CAST(@3 AS date)
        ${action === 4 ? '' : 'AND ClientCode=@1 AND EXISTS(SELECT 1 FROM Clients WHERE code=@1)'}
    )`;
    let results: string;
    let order: string;
    if (action === 1) {
      results = `SELECT TOP(1) code,name,CONCAT('DEMO-VENTA-',PurchaseId) AS document,
        CONVERT(varchar(10),PurchaseDate,23) AS date,NULL AS sku,NULL AS unit,NULL AS quantity,1 AS purchases
        FROM Purchases ORDER BY PurchaseDate DESC,PurchaseId DESC`;
      order = 'date DESC,document';
    } else if (action === 4) {
      results = `SELECT c.code,c.name,NULL AS document,CONVERT(varchar(10),MAX(p.PurchaseDate),23) AS date,
        NULL AS sku,NULL AS unit,NULL AS quantity,COUNT(p.PurchaseId) AS purchases
        FROM Clients c LEFT JOIN Purchases p ON p.code=c.code GROUP BY c.code,c.name
        HAVING MAX(p.PurchaseDate)<CAST(@2 AS date) OR MAX(p.PurchaseDate) IS NULL`;
      order = 'date,code';
    } else {
      results = `SELECT code,MAX(name) AS name,NULL AS document,CONVERT(varchar(10),MAX(PurchaseDate),23) AS date,
        sku,'unidad' AS unit,CAST(SUM(Quantity) AS varchar(60)) AS quantity,COUNT(*) AS purchases
        FROM Purchases WHERE PurchaseDate>=CAST(@2 AS date) GROUP BY code,sku`;
      order = action === 3 ? 'purchases DESC,date DESC,sku' : 'name,sku';
    }
    try {
      return await this.db.query(`${source}, Results AS (${results}), Ranked AS (
        SELECT *,COUNT(*) OVER() AS total,ROW_NUMBER() OVER(ORDER BY ${order}) AS rn FROM Results)
        SELECT code,name,document,date,sku,unit,quantity,purchases,total FROM Ranked WHERE rn>@4 AND rn<=@5 ORDER BY rn`,
      [route, client ?? '', from, to, page * 5, page * 5 + 5, todayInHonduras()]);
    } catch {
      this.logger.error('No fue posible consultar el historial académico.');
      throw new ServiceUnavailableException('No fue posible consultar las compras. Revisa la conexión y la migración 006.');
    }
  }
}
