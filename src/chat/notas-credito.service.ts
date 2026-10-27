import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class NotasCreditoService {
  constructor(
    @InjectDataSource('prodConnection')
    private readonly dataSource: DataSource,
  ) {}

  private readonly notasCreditoView = 'dbo.ZFI_NOTAS_CREDITO';

  // ==============================
  // CLIENTES CON NOTA DE CREDITO
  // ==============================
  async getClientesConNotasCredito(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;

    const clientes = await this.dataSource.query(`
      SELECT *
      FROM (
        SELECT 
          COD_CLIENTE,
          CLIENTE,
          COUNT(*) AS cantidad_notas,
          SUM(CAST(TOTAL AS DECIMAL(21,2))) AS total_notas,
          ROW_NUMBER() OVER (ORDER BY CLIENTE) AS rn
        FROM ${this.notasCreditoView}
        WHERE CLIENTE IS NOT NULL
        GROUP BY COD_CLIENTE, CLIENTE
      ) t
      WHERE t.rn BETWEEN ${offset + 1} AND ${offset + pageSize}
      ORDER BY t.rn
    `);

    const totalResult = await this.dataSource.query(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT COD_CLIENTE, CLIENTE
        FROM ${this.notasCreditoView}
        WHERE CLIENTE IS NOT NULL
        GROUP BY COD_CLIENTE, CLIENTE
      ) x
    `);

    const total = Number(totalResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: clientes,
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
    };
  }

  // ==============================
  // NOTAS POR CLIENTE
  // ==============================
  async getNotasPorCliente(cliente: string) {
    const term = cliente.trim();

    const rows = await this.dataSource.query(
      `
      SELECT 
        COD_CLIENTE,
        CLIENTE,
        [NOMBRE CTA] AS nombreCta,
        DESCRIPCION,
        DOC_SAP,
        DOC_SAR,
        FECHA_DOCUMENTO,
        TOTAL
      FROM ${this.notasCreditoView}
      WHERE CLIENTE LIKE @0
         OR COD_CLIENTE = @1
      ORDER BY FECHA_DOCUMENTO DESC
      `,
      [`%${term}%`, term],
    );

    return rows;
  }
}