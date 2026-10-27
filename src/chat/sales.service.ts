import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SalesService {
  constructor(
    @InjectDataSource('prodConnection')
    private readonly dataSource: DataSource,
  ) {}

  // Usa la base configurada en prodConnection. El legacy apuntaba de forma
  // fija a DW_ISTMA, pero las tablas comerciales de esta instalacion estan
  // en la base CHATBOT.
  private readonly DW_DB = '[dbo]';

  private cleanString(value: any): string {
    return (value ?? '').toString().trim();
  }

  private normalizeText(value: string): string {
    return this.cleanString(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
            'ml',
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

  // ================================
  // CASO 1: Venta neta vendedor
  // ================================
  async getVentaNetaVendedorMes(params: {
    slprsnid: string;
    mes: number;
    anio: number;
  }) {
    const slprsnid = this.cleanString(params.slprsnid).toUpperCase();
    const mes = Number(params.mes);
    const anio = Number(params.anio);

    const rows = await this.dataSource.query(
      `
      SELECT TOP 1
        r.slprsnid AS SLPRSNID,
        r.sprsnsln AS Nombre,
        CAST(SUM(
          ISNULL(v.xtndprce,0)
          + ISNULL(v.IMPUESTO,0)
          - ISNULL(v.descuentoNormal,0)
          - ISNULL(v.descuentoEspecial,0)
        ) AS decimal(18,2)) AS VentaNeta
      FROM ${this.DW_DB}.[VentasCasaMarca] v
      LEFT JOIN ${this.DW_DB}.[RM00301] r
        ON RTRIM(r.slprsnid) = RTRIM(v.SLPRSNID)
      WHERE RTRIM(v.SLPRSNID) = RTRIM(@0)
        AND ISNULL(v.Mes, MONTH(v.DOCDATE)) = @1
        AND ISNULL(v.Anio, YEAR(v.DOCDATE)) = @2
      GROUP BY r.slprsnid, r.sprsnsln
      `,
      [slprsnid, mes, anio],
    );

    if (!rows?.length) return null;

    return {
      SLPRSNID: this.cleanString(rows[0].SLPRSNID).toUpperCase(),
      Nombre: this.cleanString(rows[0].Nombre),
      VentaNeta: Number(rows[0].VentaNeta ?? 0),
    };
  }

  // ================================
  // CASO 2: Venta neta producto
  // ================================
  async getVentaNetaProductoMesBySku(params: {
    sku: string;
    mes: number;
    anio: number;
  }) {
    const sku = this.cleanString(params.sku).toUpperCase();
    const mes = Number(params.mes);
    const anio = Number(params.anio);

    const rows = await this.dataSource.query(
      `
      SELECT TOP 1
        RTRIM(v.ITEMNMBR) AS SKU,
        RTRIM(i.ITEMDESC) AS NombreProducto,
        CAST(SUM(
          ISNULL(v.xtndprce,0)
          + ISNULL(v.IMPUESTO,0)
          - ISNULL(v.descuentoNormal,0)
          - ISNULL(v.descuentoEspecial,0)
        ) AS decimal(18,2)) AS VentaNeta
      FROM ${this.DW_DB}.[VentasCasaMarca] v
      LEFT JOIN ${this.DW_DB}.[IV00101] i
        ON RTRIM(i.ITEMNMBR) = RTRIM(v.ITEMNMBR)
      WHERE RTRIM(v.ITEMNMBR) = RTRIM(@0)
        AND ISNULL(v.Mes, MONTH(v.DOCDATE)) = @1
        AND ISNULL(v.Anio, YEAR(v.DOCDATE)) = @2
      GROUP BY v.ITEMNMBR, i.ITEMDESC
      `,
      [sku, mes, anio],
    );

    if (!rows?.length) return null;

    return {
      SKU: this.cleanString(rows[0].SKU).toUpperCase(),
      NombreProducto: this.cleanString(rows[0].NombreProducto),
      VentaNeta: Number(rows[0].VentaNeta ?? 0),
    };
  }

  // ================================
  // Buscar productos
  // ================================
  async findProductosByNombre(termRaw: string, top = 5) {
    const term = this.cleanString(termRaw);

    if (!term) return [];

    const tokens = this.buildSearchTokens(term);

    const exactLikeRows = await this.dataSource.query(
      `
      SELECT TOP (${top})
        RTRIM(ITEMNMBR) AS SKU,
        RTRIM(ITEMDESC) AS NombreProducto
      FROM ${this.DW_DB}.[IV00101]
      WHERE ITEMDESC LIKE '%' + @0 + '%'
        AND RTRIM(ITEMNMBR) LIKE '[A-Z]%'
      ORDER BY ITEMDESC
      `,
      [term],
    );

    const exactResults = (exactLikeRows ?? []).map((r: any) => ({
      SKU: this.cleanString(r.SKU).toUpperCase(),
      NombreProducto: this.cleanString(r.NombreProducto),
    }));

    if (exactResults.length > 0) {
      return exactResults;
    }

    const t1 = tokens[0] ?? null;
    const t2 = tokens[1] ?? null;
    const t3 = tokens[2] ?? null;

    if (!t1) return [];

    const rows = await this.dataSource.query(
      `
      SELECT TOP (${top * 3})
        RTRIM(ITEMNMBR) AS SKU,
        RTRIM(ITEMDESC) AS NombreProducto
      FROM ${this.DW_DB}.[IV00101]
      WHERE ITEMDESC LIKE '%' + @0 + '%'
        AND (@1 IS NULL OR ITEMDESC LIKE '%' + @1 + '%')
        AND (@2 IS NULL OR ITEMDESC LIKE '%' + @2 + '%')
        AND RTRIM(ITEMNMBR) LIKE '[A-Z]%'
      ORDER BY ITEMDESC
      `,
      [t1, t2, t3],
    );

    const mapped = (rows ?? []).map((r: any) => ({
      SKU: this.cleanString(r.SKU).toUpperCase(),
      NombreProducto: this.cleanString(r.NombreProducto),
    }));

    if (!mapped.length) return [];

    const normalizedTokens = tokens.map((t) => this.normalizeText(t));

    const ranked = mapped
      .map((item) => {
        const normalizedName = this.normalizeText(item.NombreProducto);

        const score = normalizedTokens.reduce((acc, token) => {
          return acc + (normalizedName.includes(token) ? 1 : 0);
        }, 0);

        return { ...item, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        return a.NombreProducto.localeCompare(b.NombreProducto);
      })
      .slice(0, top)
      .map(({ SKU, NombreProducto }) => ({
        SKU,
        NombreProducto,
      }));

    return ranked;
  }

  // ================================
  // Buscar vendedores
  // ================================
  async findVendedores(termRaw: string, top = 5) {
    const term = this.cleanString(termRaw);

    if (!term) return [];

    const termUpper = term.toUpperCase();

    const rows = await this.dataSource.query(
      `
      SELECT TOP (${top})
        RTRIM(slprsnid) AS SLPRSNID,
        RTRIM(sprsnsln) AS Nombre
      FROM ${this.DW_DB}.[RM00301]
      WHERE RTRIM(slprsnid) = RTRIM(@0)
         OR sprsnsln LIKE '%' + @1 + '%'
      ORDER BY sprsnsln
      `,
      [termUpper, term],
    );

    return (rows ?? []).map((r: any) => ({
      SLPRSNID: this.cleanString(r.SLPRSNID).toUpperCase(),
      Nombre: this.cleanString(r.Nombre),
    }));
  }

  // ================================
  // Proyección vendedor producto
  // ================================
  async getProyeccionVendedorProducto(params: {
    idVendedor: string;
    sku: string;
  }) {
    const idVendedor = this.cleanString(params.idVendedor).toUpperCase();
    const sku = this.cleanString(params.sku).toUpperCase();

    const rows = await this.dataSource.query(
      `
      SELECT
        RTRIM(r.sprsnsln) AS NombreVendedor,
        RTRIM(i.ITEMDESC) AS NombreProducto,
        CEILING(SUM(p.Cajas * CAST(i.itmgedsc AS decimal(18,6)))) AS TotalUnidades
      FROM ${this.DW_DB}.[proyecciones2026] p
      INNER JOIN ${this.DW_DB}.[IV00101] i
        ON RTRIM(i.ITEMNMBR) = RTRIM(p.sku)
      INNER JOIN ${this.DW_DB}.[RM00301] r
        ON RTRIM(r.slprsnid) = RTRIM(p.idVendedor)
      WHERE RTRIM(p.idVendedor) = RTRIM(@0)
        AND RTRIM(p.sku) = RTRIM(@1)
        AND p.mes = MONTH(GETDATE())
        AND p.anio = YEAR(GETDATE())
      GROUP BY
        RTRIM(r.sprsnsln),
        RTRIM(i.ITEMDESC)
      `,
      [idVendedor, sku],
    );

    if (!rows?.length) return null;

    return {
      NombreVendedor: this.cleanString(rows[0].NombreVendedor),
      NombreProducto: this.cleanString(rows[0].NombreProducto),
      TotalUnidades: Number(rows[0].TotalUnidades ?? 0),
    };
  }

  // ================================
  // Texto chatbot
  // ================================
  async getProyeccionVendedorProductoTexto(params: {
    idVendedor: string;
    sku: string;
  }) {
    const data = await this.getProyeccionVendedorProducto(params);

    if (!data) return null;

    const unidadTexto =
      data.TotalUnidades === 1 ? 'unidad' : 'unidades';

    return `${data.NombreVendedor} debe vender ${data.TotalUnidades.toLocaleString(
      'es-HN',
    )} ${unidadTexto} del producto ${data.NombreProducto}.`;
  }

  // ================================
  // Buscar categorías
  // ================================
  async buscarCategorias(termRaw: string, top = 10) {
    const term = this.cleanString(termRaw);

    if (!term) return [];

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT TOP (${top})
        RTRIM(itmclscd) AS Categoria
      FROM ${this.DW_DB}.[IV00101]
      WHERE itmclscd IS NOT NULL
        AND LTRIM(RTRIM(itmclscd)) <> ''
        AND UPPER(RTRIM(itmclscd)) LIKE '%' + UPPER(@0) + '%'
      ORDER BY RTRIM(itmclscd)
      `,
      [term],
    );

    return (rows ?? []).map((r: any) => ({
      Categoria: this.cleanString(r.Categoria),
    }));
  }

  // ================================
  // Ventas por categoría
  // ================================
  async getVentasPorCategoria(params: {
    categoria: string;
    mes?: number | null;
    anio?: number | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  }) {
    const categoria = this.cleanString(params.categoria);

    const mes = params.mes != null ? Number(params.mes) : null;

    const anio = params.anio != null ? Number(params.anio) : null;

    const fechaInicio = this.cleanString(params.fechaInicio);

    const fechaFin = this.cleanString(params.fechaFin);

    if (!categoria) return null;

    if (fechaInicio && fechaFin) {
      const rows = await this.dataSource.query(
        `
        SELECT
          RTRIM(I.itmclscd) AS Categoria,
          CAST(SUM(
            ISNULL(V.xtndprce, 0)
            + ISNULL(V.IMPUESTO, 0)
            - ISNULL(V.descuentoNormal, 0)
            - ISNULL(V.descuentoEspecial, 0)
          ) AS decimal(18,2)) AS VentaNeta
        FROM ${this.DW_DB}.[VentasCasaMarca] V
        INNER JOIN ${this.DW_DB}.[IV00101] I
          ON RTRIM(V.ITEMNMBR) = RTRIM(I.ITEMNMBR)
        WHERE I.itmclscd IS NOT NULL
          AND LTRIM(RTRIM(I.itmclscd)) <> ''
          AND UPPER(RTRIM(I.itmclscd)) = UPPER(@0)
          AND CAST(V.DOCDATE AS date) BETWEEN @1 AND @2
          AND I.active = 1
          AND RTRIM(V.ITEMNMBR) LIKE '[A-Z]%'
        GROUP BY RTRIM(I.itmclscd)
        `,
        [categoria, fechaInicio, fechaFin],
      );

      if (!rows?.length) return null;

      return {
        Categoria: this.cleanString(rows[0].Categoria),
        VentaNeta: Number(rows[0].VentaNeta ?? 0),
      };
    }

    if (mes && anio) {
      const rows = await this.dataSource.query(
        `
        SELECT
          RTRIM(I.itmclscd) AS Categoria,
          CAST(SUM(
            ISNULL(V.xtndprce, 0)
            + ISNULL(V.IMPUESTO, 0)
            - ISNULL(V.descuentoNormal, 0)
            - ISNULL(V.descuentoEspecial, 0)
          ) AS decimal(18,2)) AS VentaNeta
        FROM ${this.DW_DB}.[VentasCasaMarca] V
        INNER JOIN ${this.DW_DB}.[IV00101] I
          ON RTRIM(V.ITEMNMBR) = RTRIM(I.ITEMNMBR)
        WHERE I.itmclscd IS NOT NULL
          AND LTRIM(RTRIM(I.itmclscd)) <> ''
          AND UPPER(RTRIM(I.itmclscd)) = UPPER(@0)
          AND ISNULL(V.Mes, MONTH(V.DOCDATE)) = @1
          AND ISNULL(V.Anio, YEAR(V.DOCDATE)) = @2
          AND I.active = 1
          AND RTRIM(V.ITEMNMBR) LIKE '[A-Z]%'
        GROUP BY RTRIM(I.itmclscd)
        `,
        [categoria, mes, anio],
      );

      if (!rows?.length) return null;

      return {
        Categoria: this.cleanString(rows[0].Categoria),
        VentaNeta: Number(rows[0].VentaNeta ?? 0),
      };
    }

    return null;
  }

  // ================================
  // Ventas todas categorías
  // ================================
  async getVentasCategorias(params: {
    mes?: number | null;
    anio?: number | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  }) {
    const mes = params.mes != null ? Number(params.mes) : null;

    const anio = params.anio != null ? Number(params.anio) : null;

    const fechaInicio = this.cleanString(params.fechaInicio);

    const fechaFin = this.cleanString(params.fechaFin);

    if (fechaInicio && fechaFin) {
      const rows = await this.dataSource.query(
        `
        SELECT
          RTRIM(I.itmclscd) AS Categoria,
          CAST(SUM(
            ISNULL(V.xtndprce, 0)
            + ISNULL(V.IMPUESTO, 0)
            - ISNULL(V.descuentoNormal, 0)
            - ISNULL(V.descuentoEspecial, 0)
          ) AS decimal(18,2)) AS VentaNeta
        FROM ${this.DW_DB}.[VentasCasaMarca] V
        INNER JOIN ${this.DW_DB}.[IV00101] I
          ON RTRIM(V.ITEMNMBR) = RTRIM(I.ITEMNMBR)
        WHERE I.itmclscd IS NOT NULL
          AND LTRIM(RTRIM(I.itmclscd)) <> ''
          AND CAST(V.DOCDATE AS date) BETWEEN @0 AND @1
          AND I.active = 1
          AND RTRIM(V.ITEMNMBR) LIKE '[A-Z]%'
        GROUP BY RTRIM(I.itmclscd)
        ORDER BY VentaNeta DESC
        `,
        [fechaInicio, fechaFin],
      );

      return (rows ?? []).map((r: any) => ({
        Categoria: this.cleanString(r.Categoria),
        VentaNeta: Number(r.VentaNeta ?? 0),
      }));
    }

    if (mes && anio) {
      const rows = await this.dataSource.query(
        `
        SELECT
          RTRIM(I.itmclscd) AS Categoria,
          CAST(SUM(
            ISNULL(V.xtndprce, 0)
            + ISNULL(V.IMPUESTO, 0)
            - ISNULL(V.descuentoNormal, 0)
            - ISNULL(V.descuentoEspecial, 0)
          ) AS decimal(18,2)) AS VentaNeta
        FROM ${this.DW_DB}.[VentasCasaMarca] V
        INNER JOIN ${this.DW_DB}.[IV00101] I
          ON RTRIM(V.ITEMNMBR) = RTRIM(I.ITEMNMBR)
        WHERE I.itmclscd IS NOT NULL
          AND LTRIM(RTRIM(I.itmclscd)) <> ''
          AND ISNULL(V.Mes, MONTH(V.DOCDATE)) = @0
          AND ISNULL(V.Anio, YEAR(V.DOCDATE)) = @1
          AND I.active = 1
          AND RTRIM(V.ITEMNMBR) LIKE '[A-Z]%'
        GROUP BY RTRIM(I.itmclscd)
        ORDER BY VentaNeta DESC
        `,
        [mes, anio],
      );

      return (rows ?? []).map((r: any) => ({
        Categoria: this.cleanString(r.Categoria),
        VentaNeta: Number(r.VentaNeta ?? 0),
      }));
    }

    return [];
  }
}
