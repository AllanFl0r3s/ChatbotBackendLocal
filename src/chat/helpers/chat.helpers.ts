// src/chat/helpers/chat.helpers.ts

export type NextActionSource =
  | 'STOCK'
  | 'VENTAS'
  | 'PROYECCION'
  | 'VENTAS_CATEGORIA';

export type GuidedMenuType =
  | 'STOCK'
  | 'VENTAS'
  | 'VENTAS_CATEGORIA'
  | 'PROMOCION'
  | 'PRONOSTICO'
  | 'PEDIDO'
  | 'PERIODO';

export type ProductoLookupLike = {
  sku?: string | null;
  SKU?: string | null;
  CodigoS4?: string | null;
  codigoS4?: string | null;
  ITEMNMBR?: string | null;
  itemnmbr?: string | null;
  [key: string]: any;
};

export const extractProductoAmbiguoOption = (
  text: string,
): number | null => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = t.match(
    /^(?:opcion|opción|respuesta|elige|seleccion|selección)?\s*(\d+)\b/i,
  );

  if (!match) return null;

  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
};

export const startsWithLetterSku = (value?: string | null): boolean => {
  const v = (value ?? '').toString().trim().toUpperCase();
  return /^[A-Z]/.test(v);
};

export const getAnySkuValue = (item: any): string => {
  return (
    item?.sku ??
    item?.SKU ??
    item?.CodigoS4 ??
    item?.codigoS4 ??
    item?.ITEMNMBR ??
    item?.itemnmbr ??
    ''
  )
    .toString()
    .trim()
    .toUpperCase();
};

export const isAllowedSkuValue = (value?: string | null): boolean => {
  const v = (value ?? '').toString().trim().toUpperCase();
  if (!v) return false;
  return startsWithLetterSku(v);
};

export const filterItemsWithValidSku = <T extends Record<string, any>>(
  items: T[] = [],
): T[] => {
  return items.filter((item) => isAllowedSkuValue(getAnySkuValue(item)));
};

export const extractSkuFromText = (rawText: string): string | null => {
  const t = (rawText ?? '').toString().trim().toUpperCase();
  if (!t) return null;

  const m1 = t.match(/\bPRECIO\b[:\s-]*([A-Z0-9-]{3,30})\b/);
  if (m1?.[1] && isAllowedSkuValue(m1[1])) return m1[1];

  const matches = t.match(/\b[A-Z0-9-]{3,30}\b/g) ?? [];
  const candidates = matches
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => /[\d-]/.test(x))
    .filter((x) => isAllowedSkuValue(x));

  if (candidates.length === 0) return null;

  const withHyphen = candidates.find((x) => x.includes('-'));
  return withHyphen ?? candidates[0];
};

export const extractCodigoS4 = (text: string): string | null => {
  const t = (text ?? '').toString().toUpperCase();
  const m = t.match(/\b([A-Z][A-Z0-9-]{4,30})\b/);

  if (!m?.[1]) return null;

  const sku = m[1].trim().toUpperCase();

  if (!isAllowedSkuValue(sku)) return null;
  if (!/\d/.test(sku)) return null;

  return sku;
};

export const normalizePhone = (phone: unknown): string => {
  const raw = (phone ?? '').toString().trim();
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '');
};

export const clampChars = (s: string, max: number): string => {
  const t = (s ?? '').toString();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
};

export const parseMesAnioFromText = (
  raw: string,
): { mes: number | null; anio: number | null } => {
  const t = (raw ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const months: Record<string, number> = {
    enero: 1,
    ene: 1,
    febrero: 2,
    feb: 2,
    marzo: 3,
    mar: 3,
    abril: 4,
    abr: 4,
    mayo: 5,
    may: 5,
    junio: 6,
    jun: 6,
    julio: 7,
    jul: 7,
    agosto: 8,
    ago: 8,
    septiembre: 9,
    setiembre: 9,
    sep: 9,
    octubre: 10,
    oct: 10,
    noviembre: 11,
    nov: 11,
    diciembre: 12,
    dic: 12,
  };

  let mes: number | null = null;
  let anio: number | null = null;

  for (const k of Object.keys(months)) {
    if (new RegExp(`\\b${k}\\b`, 'i').test(t)) {
      mes = months[k];
      break;
    }
  }

  const y = t.match(/\b(20\d{2})\b/);
  if (y?.[1]) {
    anio = Number(y[1]);
  }

  if (mes && !anio) {
    anio = new Date().getFullYear();
  }

  return { mes, anio };
};

export const extractMonthRange = (raw: string): {
  fechaInicio: string;
  fechaFin: string;
  mesInicio: number;
  mesFin: number;
  anio: number;
} | null => {
  const t = (raw ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const months: Record<string, number> = {
    enero: 1,
    ene: 1,
    febrero: 2,
    feb: 2,
    marzo: 3,
    mar: 3,
    abril: 4,
    abr: 4,
    mayo: 5,
    may: 5,
    junio: 6,
    jun: 6,
    julio: 7,
    jul: 7,
    agosto: 8,
    ago: 8,
    septiembre: 9,
    setiembre: 9,
    sep: 9,
    octubre: 10,
    oct: 10,
    noviembre: 11,
    nov: 11,
    diciembre: 12,
    dic: 12,
  };

  const monthKeys = Object.keys(months).sort((a, b) => b.length - a.length);
  const monthRegex = monthKeys.join('|');

  const m = t.match(
    new RegExp(
      `(?:\\bde\\s+)?\\b(${monthRegex})\\b\\s*(?:a|al|hasta)\\s*\\b(${monthRegex})\\b(?:\\s+(20\\d{2}))?`,
      'i',
    ),
  );

  if (!m?.[1] || !m?.[2]) return null;

  const mesInicio = months[m[1]];
  const mesFin = months[m[2]];
  const anio = m[3] ? Number(m[3]) : new Date().getFullYear();

  if (!mesInicio || !mesFin) return null;

  const lastDay = new Date(anio, mesFin, 0).getDate();

  return {
    fechaInicio: `${anio}-${String(mesInicio).padStart(2, '0')}-01`,
    fechaFin: `${anio}-${String(mesFin).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    mesInicio,
    mesFin,
    anio,
  };
};

export const extractVendorCode = (raw: string): string | null => {
  const t = (raw ?? '').toString().trim().toUpperCase();

  const m = t.match(/\(([A-Z0-9.]{1,20})\)/);
  if (m?.[1]) return m[1];

  return null;
};

export const extractSku = (raw: string): string | null => {
  const t = (raw ?? '').toString().trim().toUpperCase();
  if (!t) return null;

  const tokens = t.match(/\b[A-Z0-9-]{3,30}\b/g) ?? [];

  const banned = new Set([
    '1GAL',
    '2GAL',
    '3GAL',
    '4GAL',
    '5GAL',
    '355ML',
    '375ML',
    '500ML',
    '700ML',
    '750ML',
    '1000ML',
    '1LT',
    '2LT',
    '1L',
    '2L',
  ]);

  const candidates = tokens.filter((x) => {
    if (banned.has(x)) return false;
    if (!startsWithLetterSku(x)) return false;
    if (!/\d/.test(x)) return false;

    const looksLikeCodigo = /^[A-Z][A-Z0-9]{2,29}$/.test(x);
    const looksLikeSkuWithHyphen = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(x);

    return looksLikeCodigo || looksLikeSkuWithHyphen;
  });

  return candidates[0] ?? null;
};

export const formatLps = (n: any): string => {
  const num = Number(n ?? 0);
  return `L ${num.toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const getNombreMes = (mes: number): string => {
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return meses[mes - 1] ?? `mes ${mes}`;
};

export const isGlobalBreakCommand = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return [
    'menu',
    'inicio',
    'ayuda',
    'necesito ayuda',
    'quiero ayuda',
    'soporte',
    'hola',
    'holi',
    'buenas',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'cancelar',
    'salir',
  ].includes(t);
};

export const isPoliteClosing = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return [
    'gracias',
    'muchas gracias',
    'mil gracias',
    'ok gracias',
    'adios',
    'adiós',
    'bye',
    'hasta luego',
    'hasta pronto',
    'nos vemos',
  ].includes(t);
};

export const isNextPage = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return [
    'siguiente',
    'siguientes',
    'mas',
    'más',
    'hay mas',
    'hay más',
    'ver mas',
    'ver más',
    'continuar',
  ].includes(t);
};

export const isProductoAmbiguoOptionInput = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    [
      '1',
      '2',
      '3',
      '4',
      'stock',
      'existencia',
      'ventas',
      'venta',
      'pronostico',
      'proyeccion',
      'proyección',
      'sku',
      'codigo',
      'código',
    ].includes(t)
  ) {
    return true;
  }

  return extractProductoAmbiguoOption(t) !== null;
};

export const extractStockOption = (text: string): number | null => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = t.match(
    /(?:stock\s+de\s+la\s+opcion|stock\s+de\s+la\s+opción|stock\s+de\s+la|donde\s+esta\s+el\s+stock\s+de\s+la\s+opcion|donde\s+esta\s+el\s+stock\s+de\s+la\s+opción|donde\s+esta\s+el\s+stock\s+de\s+la|donde\s+esta\s+la\s+opcion|donde\s+esta\s+la\s+opción|donde\s+esta\s+la|opcion|opción|la|producto)?\s*(\d+)\b/i,
  );

  if (!match) return null;

  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const extractPromotionOption = (text: string): number | null => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = t.match(
    /(?:cuanto\s+hay\s+de\s+la\s+promocion|cuanto\s+hay\s+de\s+la\s+promoción|cuanto\s+hay\s+de\s+la\s+promo|stock\s+de\s+la\s+promocion|stock\s+de\s+la\s+promoción|stock\s+de\s+la\s+promo|promocion|promoción|promo|opcion|opción|la)?\s*(\d+)\b/i,
  );

  if (!match) return null;

  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const isStrongOtherIntent = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!t) return false;

  if (
    t.includes('detalle del pedido') ||
    t.includes('detalles del pedido') ||
    t.includes('detalle pedido')
  ) {
    return true;
  }

  if (t.includes('stock')) return true;
  if (t.includes('promo') || t.includes('promocion') || t.includes('promociones')) {
    return true;
  }
  if (t.includes('nota de credito') || t.includes('notas de credito')) {
    return true;
  }
  if (t.includes('venta') || t.includes('vendio') || t.includes('vendedor')) {
    return true;
  }

  return isGlobalBreakCommand(t);
};

export const isStrongIntentName = (intentName?: string | null): boolean => {
  return [
    'menu',
    'stock',
    'promocion',
    'notas_credito_clientes',
    'notas_credito_cliente',
    'siguientes',
    'sku_por_nombre',
    'pedido_erp_detalle',
    'pedido_iniciar',
    'ventas_vendedor_mes',
    'ventas_producto_mes',
    'pronostico_venta',
    'ayuda',
  ].includes((intentName ?? '').trim());
};

export const looksLikePronosticoInput = (text: string): boolean => {
  const t = (text ?? '').toString().trim();
  if (!t) return false;

  const normalized = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (isStrongOtherIntent(t)) return false;
  if (extractCodigoS4(t)) return true;
  if (extractZona(t)) return true;

  if (
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  if (/\b20\d{2}\b/.test(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !normalized.includes('pedido')) return true;

  return false;
};

export const looksLikeBareProductName = (text: string): boolean => {
  const t = (text ?? '').toString().trim();
  if (!t) return false;

  const normalized = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (isGlobalBreakCommand(t)) return false;
  if (isStrongOtherIntent(t)) return false;
  if (isNextPage(t)) return false;

  const intentWords = [
    'stock',
    'existencia',
    'precio',
    'venta',
    'vendio',
    'pronostico',
    'proyeccion',
    'proyección',
    'sku',
    'codigo',
    'código',
    'pedido',
    'detalle',
    'menu',
    'inicio',
    'ayuda',
    'soporte',
    'promo',
    'promocion',
    'promoción',
    'promociones',
    'nota de credito',
    'notas de credito',
    'cliente',
  ];

  const blockedSingles = [
    'si',
    'no',
    'ok',
    'hola',
    'gracias',
    'adios',
    'adiós',
    'menu',
    'inicio',
    'ayuda',
    'siguientes',
    'siguiente',
    'mas',
    'más',
    '1',
    '2',
    '3',
    '4',
  ];

  if (intentWords.some((w) => normalized.includes(w))) return false;
  if (blockedSingles.includes(normalized)) return false;
  if (extractCodigoS4(t)) return false;
  if (/^\d{1,15}$/.test(normalized)) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length >= 1;
};

export const extractZona = (text: string): string | null => {
  const t = (text ?? '').toString().toUpperCase();
  const m = t.match(/\b(TGU|SPS|CBA)\b/);
  return m?.[1] ?? null;
};

export const extractMes = (text: string): number | null => {
  const t = (text ?? '').toString().toLowerCase();

  const n = t.match(/\bmes\s*(\d{1,2})\b/);
  if (n?.[1]) {
    const m = Number(n[1]);
    if (m >= 1 && m <= 12) return m;
  }

  const months: Record<string, number> = {
    enero: 1,
    feb: 2,
    febrero: 2,
    mar: 3,
    marzo: 3,
    abr: 4,
    abril: 4,
    may: 5,
    mayo: 5,
    jun: 6,
    junio: 6,
    jul: 7,
    julio: 7,
    ago: 8,
    agosto: 8,
    sep: 9,
    setiembre: 9,
    septiembre: 9,
    oct: 10,
    octubre: 10,
    nov: 11,
    noviembre: 11,
    dic: 12,
    diciembre: 12,
  };

  for (const k of Object.keys(months)) {
    const re = new RegExp(`\\b${k}\\b`, 'i');
    if (re.test(t)) return months[k];
  }

  return null;
};

export const extractAnio = (text: string): number | null => {
  const t = (text ?? '').toString();
  const m = t.match(/\b(20\d{2})\b/);
  return m?.[1] ? Number(m[1]) : null;
};

export const roundCajas = (cajas: any): number => {
  const n = Number(cajas ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.ceil(n);
};

export const capitalize = (s: string): string => {
  const t = (s ?? '').toString().trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const extractVendedorNombreProyeccion = (
  text: string,
): string | null => {
  const raw = (text ?? '').toString().trim();
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /debe vender\s+(.+?)\s+de\s+[a-z]{2,5}\d{5,20}\b/i,
    /debe vender\s+(.+?)\s+en\s+(?:tgu|sps|cba|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|\d{4})\b/i,
    /debe vender\s+(.+?)$/i,
    /vendedor\s+([a-z0-9 ._-]{2,60})/i,
  ];

  for (const p of patterns) {
    const m = normalized.match(p);
    if (m?.[1]) {
      const value = m[1]
        .replace(
          /\b(cuantas|cuantas cajas|cajas|de|en|del|la|el|los|las|se|deben|vender)\b/gi,
          ' ',
        )
        .replace(/\s+/g, ' ')
        .trim();

      if (value && !extractCodigoS4(value) && !extractZona(value)) {
        return value;
      }
    }
  }

  return null;
};

export const extractVendedorSku = (
  text: string,
): { idVendedor: string; sku: string } | null => {
  const raw = (text ?? '').toString().trim();

  const match = raw.match(
    /cu[aá]nto\s+debe\s+vender(?:\s+el\s+vendedor)?\s+([a-zA-Z0-9\-]+)\s+(?:de|del\s+producto)\s+([a-zA-Z0-9\-]+)/i,
  );

  if (!match) return null;

  return {
    idVendedor: match[1].trim(),
    sku: match[2].trim(),
  };
};

export const extractProyeccionVendedorProducto = (
  text: string,
): { vendedorTerm: string; productoTerm: string } | null => {
  const raw = (text ?? '').toString().trim();

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = normalized.match(
    /^cuanto\s+debe\s+vender(?:\s+el\s+vendedor)?\s+(.+?)\s+de\s+(.+)$/i,
  );

  if (!match) return null;

  const vendedorTerm = (match[1] ?? '').trim();
  const productoTerm = (match[2] ?? '').trim();

  if (!vendedorTerm || !productoTerm) return null;

  return {
    vendedorTerm,
    productoTerm,
  };
};

export const looksLikeSku = (value: string): boolean => {
  const v = (value ?? '').toString().trim().toUpperCase();
  if (!v) return false;

  return /^[A-Z][A-Z0-9-]{4,24}$/.test(v);
};

export const looksLikeStockOptionReference = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    /^\d+\b/.test(t) ||
    /^opcion\s+\d+\b/.test(t) ||
    /^opción\s+\d+\b/.test(t) ||
    /^la\s+\d+\b/.test(t) ||
    /^producto\s+\d+\b/.test(t) ||
    /^stock\s+de\s+la\s+opcion\s+\d+\b/.test(t) ||
    /^stock\s+de\s+la\s+opción\s+\d+\b/.test(t) ||
    /^stock\s+de\s+la\s+\d+\b/.test(t) ||
    /^donde\s+esta\s+el\s+stock\s+de\s+la\s+opcion\s+\d+\b/.test(t) ||
    /^donde\s+esta\s+el\s+stock\s+de\s+la\s+opción\s+\d+\b/.test(t) ||
    /^donde\s+esta\s+el\s+stock\s+de\s+la\s+\d+\b/.test(t) ||
    /^donde\s+esta\s+la\s+opcion\s+\d+\b/.test(t) ||
    /^donde\s+esta\s+la\s+opción\s+\d+\b/.test(t) ||
    /^donde\s+esta\s+la\s+\d+\b/.test(t)
  );
};

export const looksLikePromoOptionReference = (text: string): boolean => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    /^promo\s+\d+\b/.test(t) ||
    /^promocion\s+\d+\b/.test(t) ||
    /^promoción\s+\d+\b/.test(t) ||
    /^opcion\s+\d+\b/.test(t) ||
    /^opción\s+\d+\b/.test(t) ||
    /^la\s+\d+\b/.test(t) ||
    /^cuanto\s+hay\s+de\s+la\s+promo\s+\d+\b/.test(t) ||
    /^cuanto\s+hay\s+de\s+la\s+promocion\s+\d+\b/.test(t) ||
    /^cuanto\s+hay\s+de\s+la\s+promoción\s+\d+\b/.test(t) ||
    /^stock\s+de\s+la\s+promo\s+\d+\b/.test(t) ||
    /^stock\s+de\s+la\s+promocion\s+\d+\b/.test(t) ||
    /^stock\s+de\s+la\s+promoción\s+\d+\b/.test(t)
  );
};

export const buildStockActionMenu = (): string => {
  return (
    '¿Qué deseas hacer ahora?\n' +
    '1) Ver ventas de este producto\n' +
    '2) Ver proyección de este producto\n' +
    '3) Buscar otro producto\n' +
    '4) Menú'
  );
};

export const buildNextActionMenu = (source: NextActionSource): string => {
  switch (source) {
    case 'STOCK':
      return (
        `¿Qué deseas hacer ahora?\n` +
        `1) Ver ventas de este producto\n` +
        `2) Ver proyección de este producto\n` +
        `3) Buscar otro producto\n` +
        `4) Menú`
      );

    case 'VENTAS':
      return (
        `¿Qué deseas hacer ahora?\n` +
        `1) Ver stock de este producto\n` +
        `2) Ver proyección de este producto\n` +
        `3) Buscar otro producto\n` +
        `4) Menú`
      );

    case 'PROYECCION':
      return (
        `¿Qué deseas hacer ahora?\n` +
        `1) Consultar otra zona\n` +
        `2) Ver stock de este producto\n` +
        `3) Ver ventas de este producto\n` +
        `4) Menú`
      );

    case 'VENTAS_CATEGORIA':
      return (
        `¿Qué deseas hacer ahora?\n` +
        `1) Consultar otra categoría\n` +
        `2) Cambiar período\n` +
        `3) Ver ventas por categoría\n` +
        `4) Menú`
      );

    default:
      return `¿Qué deseas hacer ahora?\n1) Buscar otro producto\n2) Menú`;
  }
};

export const formatStockDetail = (detail: any): string => {
  return `Stock del producto\n${formatStockDetailCore(detail, detail?.Nombre ?? '')}`;
};

export const formatStockDetailWithProductName = (
  detail: any,
  nombre: string,
): string => {
  return `Stock del producto\n${formatStockDetailCore(
    detail,
    nombre || (detail?.Nombre ?? ''),
  )}`;
};

export const formatStockDetailCore = (detail: any, nombre: string): string => {
  const totalStr = (detail?.StockTotal ?? 0).toString();

  const centros = (detail?.Centros ?? [])
    .filter((c: any) => Number(c.StockTotal ?? 0) !== 0)
    .slice(0, 10);

  const centrosLines = centros
    .map((c: any) => {
      const centroNom =
        c.CentroNom ?? c.CentroNomb ?? c.Centro_Nombre ?? c.Centro ?? 'Centro';
      const zona = c.Zona ?? '';
      return `- ${centroNom} (${zona}): ${(c.StockTotal ?? 0).toString()} Unids`;
    })
    .join('\n');

  const more =
    (detail?.Centros?.length ?? 0) > 10
      ? `\n…y ${detail.Centros.length - 10} centros más.`
      : '';

  return (
    `SKU: ${detail?.CodigoS4}\n` +
    `Nombre: ${nombre || detail?.Nombre}\n` +
    `Stock total: ${totalStr} Unidades\n\n` +
    `Detalle por centro:\n` +
    (centrosLines || '- (Sin existencias por centro)') +
    more
  );
};

export const extractSimpleMenuOption = (
  text: string,
  max: number,
): number | null => {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const m = t.match(/^(?:opcion|opción|elige|seleccion|selección)?\s*(\d+)\b/);
  if (!m?.[1]) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return n;
};

export const normalizeGuidedOption = (text: string): string => {
  return (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const buildGuidedMenu = (type: GuidedMenuType): string => {
  switch (type) {
    case 'STOCK':
      return (
        '¿Qué deseas hacer ahora?\n' +
        '1) Consultar otro stock\n' +
        '2) Ver ventas de este producto\n' +
        '3) Ver pronóstico\n' +
        '4) Menú'
      );

    case 'VENTAS':
      return (
        '¿Qué deseas hacer ahora?\n' +
        '1) Consultar otro producto\n' +
        '2) Cambiar período\n' +
        '3) Ver stock del producto\n' +
        '4) Menú'
      );

    case 'VENTAS_CATEGORIA':
      return (
        '¿Qué deseas hacer ahora?\n' +
        '1) Consultar otra categoría\n' +
        '2) Cambiar período\n' +
        '3) Ver top categorías\n' +
        '4) Menú'
      );

    case 'PROMOCION':
      return (
        '¿Qué deseas hacer ahora?\n' +
        '1) Ver otra promoción\n' +
        '2) Consultar stock de una promoción\n' +
        '3) Menú'
      );

    case 'PRONOSTICO':
      return (
        '¿Qué deseas hacer ahora?\n' +
        '1) Consultar otro producto\n' +
        '2) Cambiar período\n' +
        '3) Menú'
      );

    case 'PEDIDO':
      return (
        '¿Qué deseas hacer ahora?\n' +
        '1) Agregar otro producto\n' +
        '2) Ver pedido\n' +
        '3) Confirmar pedido\n' +
        '4) Cancelar pedido'
      );

    case 'PERIODO':
      return (
        'Indica el período:\n' +
        '1) Este mes\n' +
        '2) Mes pasado\n' +
        '3) Escribir mes y año\n' +
        '4) Escribir rango de fechas\n' +
        '5) Menú'
      );

    default:
      return '¿Qué deseas hacer ahora?\n1) Menú';
  }
};

export const nombreMes = (mes?: number | null): string => {
  const meses = [
    '',
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  if (!mes || mes < 1 || mes > 12) return '';
  return meses[mes];
};

export const cleanCategoriaTerm = (value?: string | null): string | null => {
  const v = (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^ventas?\s+de\s+/i, '')
    .replace(/^venta\s+de\s+/i, '')
    .replace(/^ventas?\s+por\s+categoria\s+de\s+/i, '')
    .replace(/^ventas?\s+por\s+categoria\s+/i, '')
    .replace(/^ventas?\s+categoria\s+/i, '')
    .replace(/^ventas?\s+/i, '')
    .replace(/^categoria\s+de\s+/i, '')
    .replace(/^categoria\s+/i, '')
    .replace(/\b(este mes|mes pasado)\b/gi, '')
    .replace(
      /\b(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|octubre|oct|noviembre|nov|diciembre|dic)\b.*$/i,
      '',
    )
    .replace(/\b(20\d{2})\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const invalid = new Set([
    '',
    'ventas',
    'venta',
    'categoria',
    'categorias',
    'ventas por categoria',
    'ventas por categorias',
    'por categoria',
    'en',
    'de',
    'del',
  ]);

  return invalid.has(v) ? null : v;
};

export const formatPeriodoTexto = (params: {
  mes?: number | null;
  anio?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}): string => {
  if (params.fechaInicio && params.fechaFin) {
    return `${params.fechaInicio} al ${params.fechaFin}`;
  }

  if (params.mes && params.anio) {
    return `${nombreMes(params.mes)} ${params.anio}`;
  }

  return 'período no especificado';
};

export const extractForecastProductTerm = (raw: string): string | null => {
  const cleaned = (raw ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^proyeccion(?:es)?\s+de\s+ventas?\s+de\s+/i, '')
    .replace(/^proyeccion(?:es)?\s+de\s+ventas?\s+/i, '')
    .replace(/^proyeccion(?:es)?\s+de\s+/i, '')
    .replace(/^proyeccion(?:es)?\s+/i, '')
    .replace(/^pronostico(?:s)?\s+de\s+ventas?\s+de\s+/i, '')
    .replace(/^pronostico(?:s)?\s+de\s+ventas?\s+/i, '')
    .replace(/^pronostico(?:s)?\s+de\s+/i, '')
    .replace(/^pronostico(?:s)?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;
  if (isReservedForecastTerm(cleaned)) return null;

  return cleaned;
};

export const isReservedForecastTerm = (value?: string | null): boolean => {
  const v = (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  return [
    'proyeccion',
    'proyecciones',
    'proyeccion de venta',
    'proyeccion de ventas',
    'pronostico',
    'pronosticos',
    'pronostico de venta',
    'pronostico de ventas',
    'venta',
    'ventas',
    'producto',
    'productos',
    'zona',
    'vendedor',
  ].includes(v);
};

export function extractPromoMessageOption(raw: string): number | null {
  const text = (raw ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = text.match(/^(mensaje|texto|cliente|copiar)\s+(\d{1,2})$/);

  if (!match) return null;

  const n = Number(match[2]);
  return Number.isInteger(n) && n > 0 ? n : null;
}
