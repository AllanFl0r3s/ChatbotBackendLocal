import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type StockRow = { CodigoS4: string; Nombre: string; StockTotal: any };

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource, // BD CHATBOT

    @InjectDataSource('prodConnection')
    private readonly prodDataSource: DataSource, // BD DW_ISTMA
  ) {}

  private cleanString(value: any): string {
    return (value ?? '').toString().trim();
  }

  private normalizeText(value: string): string {
    return this.cleanString(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/(\d+)(ml|lt|l)\b/g, '$1 $2')
      .replace(/\b(ml|lt|l)(\d+)\b/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildSearchTokens(termRaw: string): string[] {
    const normalized = this.normalizeText(termRaw);
    if (!normalized) return [];

    return normalized
      .split(' ')
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => t.length >= 2)
      .filter(
        (t) =>
          ![
            'de',
            'del',
            'la',
            'el',
            'los',
            'las',
            'y',
            'en',
            'cuanto',
            'cuantos',
            'hay',
            'tiene',
            'tienen',
            'queda',
            'quedan',
            'disponible',
            'disponibles',
            'stock',
            'existencia',
            'existencias',
          ].includes(t),
      );
  }

  private normalizeToken(value: string): string {
    return this.normalizeText(value);
  }

  private isAllowedCodigoS4(value: string): boolean {
    const code = this.cleanString(value).toUpperCase();
    return /^(PT|SE|ME)/.test(code);
  }

  private cleanStockRow(row: any): StockRow {
    return {
      CodigoS4: this.cleanString(row?.CodigoS4).toUpperCase(),
      Nombre: this.cleanString(row?.Nombre),
      StockTotal: Number(row?.StockTotal ?? 0),
    };
  }

  private getProdObject(
    schemaEnv: string,
    tableEnv: string,
    schemaDefault: string,
    tableDefault: string,
  ): string {
    const schema = process.env[schemaEnv] || schemaDefault;
    const table = process.env[tableEnv] || tableDefault;
    return `${schema}.${table}`;
  }

  async findStockDetalleByCodigoS4(codigoS4Raw: string) {
    const codigoS4 = this.cleanString(codigoS4Raw).toUpperCase();
    if (!codigoS4) return null;

    const rows = await this.prodDataSource.query(
      `
      SELECT
        v.CodigoS4 AS CodigoS4,
        v.Nombre AS Nombre,
        v.Centro AS Centro,
        v.Centro_Nombre AS CentroNom,
        v.Zona AS Zona,
        v.StockTotal AS StockTotal
      FROM dbo.VW_STOCK_S4_PRODUCTO_CENTRO v
      WHERE v.CodigoS4 = @0
      ORDER BY v.Centro
      `,
      [codigoS4],
    );

    if (!rows?.length) return null;

    const total = rows.reduce(
      (a: number, r: any) => a + Number(r.StockTotal ?? 0),
      0,
    );

    return {
      CodigoS4: this.cleanString(rows[0].CodigoS4).toUpperCase(),
      Nombre: this.cleanString(rows[0].Nombre),
      StockTotal: total,
      Centros: rows.map((r: any) => ({
        Centro: this.cleanString(r.Centro),
        CentroNom: this.cleanString(r.CentroNom || r.Centro),
        Zona: this.cleanString(r.Zona),
        StockTotal: Number(r.StockTotal ?? 0),
      })),
    };
  }

  async findStockByCodeOrName(termRaw: string) {
    const term = this.cleanString(termRaw);
    const termUpper = term.toUpperCase();
    if (!termUpper) return null;

    const isCodigoS4 = /^[A-Z]{2,5}\d{6,20}$/.test(termUpper);

    if (isCodigoS4) {
      if (!this.isAllowedCodigoS4(termUpper)) return null;

      const rows = await this.prodDataSource.query(
        `
        SELECT TOP 1
          CodigoS4,
          Nombre,
          StockTotal
        FROM dbo.VWchatbot_STOCK_S4_PRODUCTO
        WHERE CodigoS4 = @0
        `,
        [termUpper],
      );

      return rows?.[0] ? this.cleanStockRow(rows[0]) : null;
    }

    const tokens = this.buildSearchTokens(term);
    if (!tokens.length) return [];

    const rows = await this.prodDataSource.query(
      `
      SELECT TOP 20
        CodigoS4,
        Nombre,
        StockTotal
      FROM dbo.VWchatbot_STOCK_S4_PRODUCTO
      WHERE (@0 IS NULL OR Nombre LIKE '%' + @0 + '%')
        AND (@1 IS NULL OR Nombre LIKE '%' + @1 + '%')
        AND (@2 IS NULL OR Nombre LIKE '%' + @2 + '%')
        AND (@3 IS NULL OR Nombre LIKE '%' + @3 + '%')
      ORDER BY Nombre
      `,
      [
        tokens[0] ?? null,
        tokens[1] ?? null,
        tokens[2] ?? null,
        tokens[3] ?? null,
      ],
    );

    const mapped = (rows ?? [])
      .map((r: any) => this.cleanStockRow(r))
      .filter((item) => this.isAllowedCodigoS4(item.CodigoS4));

    if (!mapped.length) return [];

    const normalizedTokens = tokens.map((t) => this.normalizeToken(t));
    const normalizedFullTerm = this.normalizeToken(term);

    const ranked = mapped
      .map((item) => {
        const normalizedName = this.normalizeToken(item.Nombre);
        let score = 0;

        for (const token of normalizedTokens) {
          if (normalizedName.includes(token)) score += 10;
        }

        if (normalizedName.includes(normalizedFullTerm)) score += 20;

        if (
          normalizedTokens.length &&
          normalizedName.startsWith(normalizedTokens[0])
        ) {
          score += 5;
        }

        return { ...item, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.Nombre.localeCompare(b.Nombre);
      });

    const unique: StockRow[] = [];
    const seen = new Set<string>();

    for (const item of ranked) {
      const key = this.normalizeToken(item.Nombre);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          CodigoS4: item.CodigoS4,
          Nombre: item.Nombre,
          StockTotal: item.StockTotal,
        });
      }

      if (unique.length >= 5) break;
    }

    return unique;
  }

  async findStockByNamePaged(termRaw: string, page: number, pageSize: number) {
    const term = this.cleanString(termRaw);
    const p = Number.isFinite(page) && page >= 0 ? page : 0;
    const s = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 5;

    const tokens = this.buildSearchTokens(term);
    if (!tokens.length) return [];

    const rows = await this.prodDataSource.query(
      `
      SELECT TOP 100
        CodigoS4,
        Nombre,
        StockTotal
      FROM dbo.VWchatbot_STOCK_S4_PRODUCTO
      WHERE (@0 IS NULL OR Nombre LIKE '%' + @0 + '%')
        AND (@1 IS NULL OR Nombre LIKE '%' + @1 + '%')
        AND (@2 IS NULL OR Nombre LIKE '%' + @2 + '%')
        AND (@3 IS NULL OR Nombre LIKE '%' + @3 + '%')
      ORDER BY Nombre
      `,
      [
        tokens[0] ?? null,
        tokens[1] ?? null,
        tokens[2] ?? null,
        tokens[3] ?? null,
      ],
    );

    const mapped = (rows ?? [])
      .map((r: any) => this.cleanStockRow(r))
      .filter((item) => this.isAllowedCodigoS4(item.CodigoS4));

    const normalizedTokens = tokens.map((t) => this.normalizeToken(t));
    const normalizedFullTerm = this.normalizeToken(term);

    const ranked = mapped
      .map((item) => {
        const normalizedName = this.normalizeToken(item.Nombre);
        let score = 0;

        for (const token of normalizedTokens) {
          if (normalizedName.includes(token)) score += 10;
        }

        if (normalizedName.includes(normalizedFullTerm)) score += 20;

        if (
          normalizedTokens.length &&
          normalizedName.startsWith(normalizedTokens[0])
        ) {
          score += 5;
        }

        return { ...item, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.Nombre.localeCompare(b.Nombre);
      });

    const unique: StockRow[] = [];
    const seen = new Set<string>();

    for (const item of ranked) {
      const key = this.normalizeToken(item.Nombre);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          CodigoS4: item.CodigoS4,
          Nombre: item.Nombre,
          StockTotal: item.StockTotal,
        });
      }
    }

    const offset = p * s;
    return unique.slice(offset, offset + s);
  }

  async countStockByName(termRaw: string): Promise<number> {
    const term = this.cleanString(termRaw);
    const tokens = this.buildSearchTokens(term);
    if (!tokens.length) return 0;

    const rows = await this.prodDataSource.query(
      `
      SELECT
        CodigoS4,
        Nombre,
        StockTotal
      FROM dbo.VWchatbot_STOCK_S4_PRODUCTO
      WHERE (@0 IS NULL OR Nombre LIKE '%' + @0 + '%')
        AND (@1 IS NULL OR Nombre LIKE '%' + @1 + '%')
        AND (@2 IS NULL OR Nombre LIKE '%' + @2 + '%')
        AND (@3 IS NULL OR Nombre LIKE '%' + @3 + '%')
      ORDER BY Nombre
      `,
      [
        tokens[0] ?? null,
        tokens[1] ?? null,
        tokens[2] ?? null,
        tokens[3] ?? null,
      ],
    );

    const uniqueNames = new Set<string>();

    for (const row of rows ?? []) {
      const item = this.cleanStockRow(row);
      if (!this.isAllowedCodigoS4(item.CodigoS4)) continue;
      uniqueNames.add(this.normalizeToken(item.Nombre));
    }

    return uniqueNames.size;
  }

  async countProductosEnPromocion(filtro?: string | null) {
    const filtroNormalizado = (filtro || '').trim().toLowerCase();

    const productoTable = this.getProdObject(
      'DB_SCHEMA_TMP_IV00101_PROD',
      'DB_TABLE_TMP_IV00101_PROD',
      'pbx',
      'TMP_IV00101',
    );

    let sql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT DISTINCT
          LTRIM(RTRIM(ITEMNMBR)) AS sku,
          LTRIM(RTRIM(itemdesc)) AS nombre
        FROM ${productoTable}
        WHERE active = 1
          AND (
            LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promo%'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promos%'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promocion%'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '% prom %'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE 'prom %'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '% prom'
          )
    `;

    const params: any[] = [];

    if (filtroNormalizado) {
      sql += `
          AND (
            LOWER(LTRIM(RTRIM(itemdesc))) LIKE @0
            OR LOWER(LTRIM(RTRIM(itmclscd))) LIKE @0
            OR LOWER(LTRIM(RTRIM(Purchase_Item_Tax_Schedu))) LIKE @0
            OR LOWER(LTRIM(RTRIM(uscatvls_1))) LIKE @0
          )
      `;
      params.push(`%${filtroNormalizado}%`);
    }

    sql += `
      ) X
      WHERE X.sku LIKE '[A-Z]%'
    `;

    const rows = await this.prodDataSource.query(sql, params);
    return Number(rows?.[0]?.total ?? 0);
  }

  async findProductosEnPromocionPaged(
    filtro?: string | null,
    page = 0,
    pageSize = 5,
  ) {
    const filtroNormalizado = (filtro || '').trim().toLowerCase();
    const p = Number.isFinite(page) && page >= 0 ? page : 0;
    const s = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 5;
    const offset = p * s;

    const productoTable = this.getProdObject(
      'DB_SCHEMA_TMP_IV00101_PROD',
      'DB_TABLE_TMP_IV00101_PROD',
      'pbx',
      'TMP_IV00101',
    );

    let sql = `
      SELECT
        X.sku,
        X.nombre
      FROM (
        SELECT DISTINCT
          LTRIM(RTRIM(ITEMNMBR)) AS sku,
          LTRIM(RTRIM(itemdesc)) AS nombre
        FROM ${productoTable}
        WHERE active = 1
          AND (
            LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promo%'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promos%'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promocion%'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '% prom %'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE 'prom %'
            OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '% prom'
          )
    `;

    const params: any[] = [];

    if (filtroNormalizado) {
      sql += `
          AND (
            LOWER(LTRIM(RTRIM(itemdesc))) LIKE @0
            OR LOWER(LTRIM(RTRIM(itmclscd))) LIKE @0
            OR LOWER(LTRIM(RTRIM(Purchase_Item_Tax_Schedu))) LIKE @0
            OR LOWER(LTRIM(RTRIM(uscatvls_1))) LIKE @0
          )
      `;
      params.push(`%${filtroNormalizado}%`);
    }

    const idxOffset = params.length;
    const idxFetch = params.length + 1;

    sql += `
      ) X
      WHERE X.sku LIKE '[A-Z]%'
      ORDER BY X.nombre, X.sku
      OFFSET @${idxOffset} ROWS
      FETCH NEXT @${idxFetch} ROWS ONLY
    `;

    params.push(offset, s);

    return this.prodDataSource.query(sql, params);
  }

  async findStockByCodeOrNamePaged(termRaw: string, page = 0, pageSize = 5) {
    const term = this.cleanString(termRaw);
    if (!term) return null;

    const termUpper = term.toUpperCase();
    const isCodigoS4 = /^[A-Z]{2,5}\d{6,20}$/.test(termUpper);

    if (isCodigoS4) {
      return this.findStockByCodeOrName(termUpper);
    }

    return this.findStockByNamePaged(term, page, pageSize);
  }

  async findPedidoDetalleById(idPedidoRaw: string) {
    const idPedido = this.cleanString(idPedidoRaw);
    if (!idPedido) return [];

    const rows = await this.prodDataSource.query(
      `
      SELECT
        IdPedido,
        Material,
        NombreMaterial,
        Unidades,
        UndMedida
      FROM dbo.VWchatbot_PEDIDO_DETALLE_S4
      WHERE IdPedido = @0
      ORDER BY Material
      `,
      [idPedido],
    );

    return rows as Array<{
      IdPedido: string;
      Material: string;
      NombreMaterial: string | null;
      Unidades: number;
      UndMedida: string | null;
    }>;
  }

  async findProyeccionGeneral(params: {
    mes?: number | null;
    anio?: number | null;
    sku?: string | null;
    zona?: string | null;
    vendedor?: string | null;
  }) {
    const sku = this.cleanString(params.sku).toUpperCase();
    const zona = this.cleanString(params.zona).toUpperCase();
    const vendedor = this.cleanString(params.vendedor).toUpperCase();

    const now = new Date();

    const mes =
      Number.isFinite(params.mes as any) &&
      Number(params.mes) >= 1 &&
      Number(params.mes) <= 12
        ? Number(params.mes)
        : now.getMonth() + 1;

    const anio =
      Number.isFinite(params.anio as any) && Number(params.anio) >= 2000
        ? Number(params.anio)
        : now.getFullYear();

    const proyeccionesTable = this.getProdObject(
      'DB_SCHEMA_PROYECCIONES_PROD',
      'DB_TABLE_PROYECCIONES_PROD',
      'dbo',
      'Proyecciones_TEST',
    );

    const productosTable = this.getProdObject(
      'DB_SCHEMA_TMP_IV00101_PROD',
      'DB_TABLE_TMP_IV00101_PROD',
      'pbx',
      'TMP_IV00101',
    );

    const rows = await this.prodDataSource.query(
      `
      SELECT
        CAST(SUM(CAST(ISNULL(p.Cajas, 0) AS DECIMAL(18, 6))) AS DECIMAL(18, 6)) AS CajasExactas,
        CEILING(SUM(CAST(ISNULL(p.Cajas, 0) AS DECIMAL(18, 6)))) AS CajasRedondeadas,
        CEILING(
          SUM(
            CAST(ISNULL(p.Cajas, 0) AS DECIMAL(18, 6)) *
            CAST(ISNULL(i.itmgedsc, 0) AS DECIMAL(18, 6))
          )
        ) AS UnidadesRedondeadas
      FROM ${proyeccionesTable} p
      INNER JOIN ${productosTable} i
        ON UPPER(LTRIM(RTRIM(i.ITEMNMBR))) = UPPER(LTRIM(RTRIM(p.sku)))
      WHERE p.mes = @0
        AND p.anio = @1
        AND (@2 = '' OR UPPER(LTRIM(RTRIM(p.sku))) = @2)
        AND (@3 = '' OR UPPER(LTRIM(RTRIM(p.Zona))) = @3)
        AND (@4 = '' OR UPPER(LTRIM(RTRIM(p.idVendedor))) = @4)
      `,
      [mes, anio, sku, zona, vendedor],
    );

    const row = rows?.[0];

    return {
      sku: sku || null,
      zona: zona || null,
      vendedor: vendedor || null,
      mes,
      anio,
      cajasExactas: Number(row?.CajasExactas ?? 0),
      cajasRedondeadas: Number(row?.CajasRedondeadas ?? 0),
      unidadesRedondeadas: Number(row?.UnidadesRedondeadas ?? 0),
    };
  }

  async getProductosEnPromocion(filtro?: string | null) {
    const filtroNormalizado = (filtro || '').trim().toLowerCase();

    const productoTable = this.getProdObject(
      'DB_SCHEMA_TMP_IV00101_PROD',
      'DB_TABLE_TMP_IV00101_PROD',
      'pbx',
      'TMP_IV00101',
    );

    let sql = `
      SELECT TOP 20
        LTRIM(RTRIM(ITEMNMBR)) AS sku,
        LTRIM(RTRIM(itemdesc)) AS nombre,
        LTRIM(RTRIM(itmclscd)) AS clase,
        LTRIM(RTRIM(Purchase_Item_Tax_Schedu)) AS taxSchedule
      FROM ${productoTable}
      WHERE active = 1
        AND (
          LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%promo%'
          OR LOWER(LTRIM(RTRIM(itemdesc))) LIKE '%prom%'
        )
    `;

    const params: any[] = [];

    if (filtroNormalizado) {
      sql += `
        AND (
          LOWER(LTRIM(RTRIM(itmclscd))) LIKE @0
          OR LOWER(LTRIM(RTRIM(Purchase_Item_Tax_Schedu))) LIKE @1
        )
      `;
      params.push(`%${filtroNormalizado}%`, `%${filtroNormalizado}%`);
    }

    sql += ` ORDER BY LTRIM(RTRIM(itemdesc))`;

    return this.prodDataSource.query(sql, params);
  }
}
