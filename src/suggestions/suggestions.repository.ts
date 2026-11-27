import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { todayInHonduras } from './suggestions.core';
import type { Catalog, Client, ProductFacts, Promotion } from './suggestions.core';

@Injectable()
export class SuggestionsRepository {
  private readonly logger = new Logger(SuggestionsRepository.name);
  constructor(@InjectDataSource('prodConnection') private readonly db: DataSource) {}

  private async query<T>(sql: string, parameters: unknown[]): Promise<T[]> {
    try { return await this.db.query(sql, parameters); }
    catch {
      this.logger.error('No fue posible consultar las fuentes académicas de clientes y promociones.');
      throw new ServiceUnavailableException('No fue posible consultar los datos. Revisa la conexión y la migración 006.');
    }
  }

  clients(route: string, term: string, page: number): Promise<Client[]> {
    return this.query<Client>(`WITH Clients AS (
      SELECT DISTINCT ClientCode AS code, ClientName AS name FROM dbo.VWchatbot_CLIENTES_RUTA
      WHERE Route=@0 AND Since<=CAST(@4 AS date) AND (Until IS NULL OR Until>=CAST(@4 AS date))
        AND (ClientCode=@1 OR CHARINDEX(@1,ClientName COLLATE Latin1_General_CI_AI)>0)
    ), Ranked AS (SELECT *,COUNT(*) OVER() AS total,
      ROW_NUMBER() OVER(ORDER BY CASE WHEN code=@1 THEN 0 ELSE 1 END,name,code) AS rn FROM Clients)
    SELECT code,name,total FROM Ranked WHERE rn>@2 AND rn<=@3 ORDER BY rn`,
    [route, term, page * 5, page * 5 + 5, todayInHonduras()]);
  }

  async catalog(today: string): Promise<Catalog> {
    const promotions = await this.query<Promotion>(`SELECT id,sku,name,startsOn,endsOn,conditions,buyQuantity,buyUnit,bonusQuantity,bonusUnit
      FROM dbo.VWchatbot_PROMOCIONES_SUGERIDAS
      WHERE startsOn<=CAST(@0 AS date) AND endsOn>=CAST(@0 AS date) ORDER BY id`, [today]);
    // Bonificación estructurada de 011; los valores nulos no se deducen del texto.
    return { source: 'Promociones académicas ficticias', updatedAt: null,
      promotions: promotions.map(p => ({ ...p, clientCodes: ['*'] })) };
  }

  async facts(route: string, client: string, from: string, today: string, skus: string[]): Promise<ProductFacts[]> {
    if (!skus.length) return [];
    const rows = await this.query<ProductFacts>(`WITH Purchases AS (
      SELECT sku,COUNT(*) AS purchases FROM dbo.VWchatbot_HISTORIAL_COMPRAS
      WHERE Route=@0 AND ClientCode=@1 AND PurchaseDate BETWEEN CAST(@2 AS date) AND CAST(@3 AS date)
      GROUP BY sku
    ) SELECT COALESCE(s.CodigoS4,p.sku) AS sku,ISNULL(p.purchases,0) AS purchases,s.StockTotal AS stock
      FROM dbo.VWchatbot_STOCK_S4_PRODUCTO s FULL OUTER JOIN Purchases p ON p.sku=s.CodigoS4`,
    [route, client, from, today]);
    const allowed = new Set(skus);
    return rows.filter(r => allowed.has(r.sku)).map(r => ({ ...r, purchases: Number(r.purchases), stock: r.stock === null ? null : Number(r.stock) }));
  }
}
