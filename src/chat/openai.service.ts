// src/chat/openai.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

type IntentResult = {
  intent:
    | 'menu'
    | 'catalogo'
    | 'precio'
    | 'stock'
    | 'promocion'
    | 'sku_por_nombre'
    | 'pedido_erp_detalle'
    | 'pedido_iniciar'
    | 'pedido_ver'
    | 'pedido_confirmar'
    | 'pedido_cancelar'
    | 'notas_credito_clientes'
    | 'notas_credito_cliente'
    | 'siguientes'
    | 'ventas_vendedor_mes'
    | 'ventas_producto_mes'
    | 'pronostico_venta'
    | 'ventas_categoria'
    | 'ayuda'
    | 'out_of_domain';
  codigoS4?: string | null;
  sku?: string | null;
  idPedido?: string | null;
  termNombre?: string | null;
  idVendedor?: string | null;
  promoFiltro?: string | null;
  clienteNombre?: string | null;
  categoria?: string | null;
  mes?: number | null;
  anio?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
};

@Injectable()
export class OpenAiService {
  private client: OpenAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('Falta OPENAI_API_KEY en variables de entorno');

    this.client = new OpenAI({ apiKey });
  }

  async classifyIntent(userText: string): Promise<IntentResult> {
    const text = (userText ?? '').toString().trim();

    if (!text) {
      return this.emptyIntent('ayuda');
    }

    // ============================
    // ATAJOS POR REGLAS
    // ============================
    const menuIntent = this.detectMenuIntent(text);
    if (menuIntent) return menuIntent;

    const nextIntent = this.detectNextIntent(text);
    if (nextIntent) return nextIntent;

    const promoIntent = this.detectPromoIntent(text);
    if (promoIntent) {
      return {
        ...this.baseIntent('promocion'),
        promoFiltro: promoIntent.promoFiltro ?? null,
      };
    }

    const notasIntent = this.detectNotasCreditoIntent(text);
    if (notasIntent) return notasIntent;

    const pedidoDetalleIntent = this.detectPedidoDetalleIntent(text);
    if (pedidoDetalleIntent) return pedidoDetalleIntent;

    const pedidoIntent = this.detectPedidoIntent(text);
    if (pedidoIntent) return pedidoIntent;

    const skuIntent = this.detectSkuPorNombreIntent(text);
    if (skuIntent) return skuIntent;

    const stockIntent = this.detectStockIntent(text);
    if (stockIntent) return stockIntent;

    const pronosticoIntent = this.detectPronosticoIntent(text);
    if (pronosticoIntent) return pronosticoIntent;

    const ventasVendedorIntent = this.detectVentasVendedorIntent(text);
    if (ventasVendedorIntent) return ventasVendedorIntent;

    const ventasProductoIntent = this.detectVentasProductoIntent(text);
    if (ventasProductoIntent) return ventasProductoIntent;

    const ventasCategoriaIntent = this.detectVentasCategoriaIntent(text);
    if (ventasCategoriaIntent) return ventasCategoriaIntent;

    // ============================
    // OPENAI STRUCTURED OUTPUT
    // ============================
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        intent: {
          type: 'string',
          enum: [
            'menu',
            'catalogo',
            'precio',
            'stock',
            'promocion',
            'sku_por_nombre',
            'pedido_erp_detalle',
            'pedido_iniciar',
            'pedido_ver',
            'pedido_confirmar',
            'pedido_cancelar',
            'notas_credito_clientes',
            'notas_credito_cliente',
            'siguientes',
            'ventas_vendedor_mes',
            'ventas_producto_mes',
            'pronostico_venta',
            'ventas_categoria',
            'ayuda',
            'out_of_domain',
          ],
        },
        codigoS4: { type: ['string', 'null'] },
        sku: { type: ['string', 'null'] },
        idPedido: { type: ['string', 'null'] },
        termNombre: { type: ['string', 'null'] },
        idVendedor: { type: ['string', 'null'] },
        mes: { type: ['number', 'null'] },
        anio: { type: ['number', 'null'] },
        promoFiltro: { type: ['string', 'null'] },
        clienteNombre: { type: ['string', 'null'] },
        categoria: { type: ['string', 'null'] },
        fechaInicio: { type: ['string', 'null'] },
        fechaFin: { type: ['string', 'null'] },
      },
      required: [
        'intent',
        'codigoS4',
        'sku',
        'idPedido',
        'termNombre',
        'idVendedor',
        'mes',
        'anio',
        'promoFiltro',
        'clienteNombre',
        'categoria',
        'fechaInicio',
        'fechaFin',
      ],
    } as const;

    const system =
      `Eres un clasificador de intención para un chatbot de una distribuidora.\n` +
      `Devuelve SOLO JSON válido que cumpla exactamente el schema.\n\n` +
      `Dominio permitido:\n` +
      `- menu/inicio/hola/ayuda\n` +
      `- catalogo/categorias\n` +
      `- precio por SKU\n` +
      `- stock por codigo S4 (ej PT001022005) o por nombre\n` +
      `- promociones: productos en promoción, promo, prom\n` +
      `- consulta de SKU por nombre de producto\n` +
      `- detalle de pedido ERP por idPedido (ej 001008854)\n` +
      `- pedido (carrito): iniciar/agregar/ver/confirmar/cancelar\n` +
      `- notas de crédito:\n` +
      `   * notas_credito_clientes: preguntas generales como "que clientes tienen nota de credito"\n` +
      `   * notas_credito_cliente: preguntas como "notas de credito de diapa"\n` +
      `- paginación: "siguientes", "más", "otra página"\n` +
      `- ventas casa marca:\n` +
      `   * ventas_vendedor_mes: cuanto vendió un vendedor en un mes\n` +
      `   * ventas_producto_mes: cuanto se vendió de un producto (SKU o nombre) en un mes\n` +
      `   * ventas_categoria: cuanto se vendió de una categoría, ventas por categoría, top categorías\n` +
      `- pronóstico de venta por producto\n\n` +
      `Reglas de extracción:\n` +
      `- codigoS4: 2-5 letras + 6-20 dígitos aprox, también puede ser alfanumérico largo con prefijo de letras.\n` +
      `- idPedido: 6-15 dígitos.\n` +
      `- sku: letras/números/guiones.\n` +
      `- idVendedor: código del vendedor (ej "C93"), suele venir como "(C93)" o "C93".\n` +
      `- mes: número 1-12 si el usuario menciona un mes.\n` +
      `- anio: 4 dígitos (20xx) si el usuario lo menciona.\n` +
      `- fechaInicio y fechaFin: úsalas cuando el usuario indique un rango de fechas. Deben ir en formato YYYY-MM-DD.\n` +
      `- promoFiltro: filtro libre solo para promoción.\n` +
      `- termNombre: nombre o fragmento del producto/vendedor/consulta.\n` +
      `- clienteNombre: úsalo solo cuando la intención sea notas_credito_cliente.\n` +
      `- categoria: úsala solo cuando la intención sea ventas_categoria.\n\n` +
      `Heurísticas:\n` +
      `- Si preguntan "cuanto vendio" + vendedor => ventas_vendedor_mes.\n` +
      `- Si preguntan "cuanto se vendio" + producto => ventas_producto_mes.\n` +
      `- Si preguntan "cuanto se vendio de la categoria", "ventas por categoria", "top categorias" o "ventas de licores/cervezas/vinos/aguardientes" => ventas_categoria.\n` +
      `- Si preguntan "que sku es" o "sku de" + producto => sku_por_nombre.\n` +
      `- Si preguntan promoción/promo/promociones => promocion.\n` +
      `- Si preguntan stock/existencia => stock.\n` +
      `- Si preguntan pronóstico/proyección => pronostico_venta.\n` +
      `- Si el usuario dice "este mes", devuelve el mes y año actuales.\n` +
      `- Si el usuario dice "mes pasado", devuelve el mes y año anteriores.\n` +
      `- Si piden ventas por categoría sin indicar una categoría específica, deja categoria=null.\n` +
      `- Si faltan datos, usa null.\n` +
      `- Si es fuera de dominio, intent=out_of_domain.\n`;

    const res = await this.client.responses.create({
      model: this.config.get<string>('OPENAI_INTENT_MODEL') || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'intent_router',
          strict: true,
          schema,
        },
      },
      temperature: 0,
      max_output_tokens: 300,
    });

    const rawOut = (res as any).output_text ?? '';

    try {
      const parsed = JSON.parse(rawOut);

      const normIdVendedor =
        parsed.idVendedor != null
          ? String(parsed.idVendedor).trim().toUpperCase()
          : null;

      const normMes =
        parsed.mes == null
          ? null
          : Number.isFinite(Number(parsed.mes))
            ? Number(parsed.mes)
            : null;

      const normAnio =
        parsed.anio == null
          ? null
          : Number.isFinite(Number(parsed.anio))
            ? Number(parsed.anio)
            : null;

      const normCodigoS4 =
        parsed.codigoS4 != null
          ? String(parsed.codigoS4).trim().toUpperCase().replace(/\s+/g, '')
          : null;

      const normSku =
        parsed.sku != null ? String(parsed.sku).trim().toUpperCase() : null;

      const normIdPedido =
        parsed.idPedido != null ? String(parsed.idPedido).trim() : null;

      const normTermNombre =
        parsed.termNombre != null ? String(parsed.termNombre).trim() : null;

      const normPromoFiltro =
        parsed.promoFiltro != null
          ? String(parsed.promoFiltro).trim().toLowerCase()
          : null;

      const normClienteNombre =
        parsed.clienteNombre != null
          ? String(parsed.clienteNombre).trim()
          : null;

      const normCategoria =
        parsed.categoria != null ? String(parsed.categoria).trim() : null;

      const normFechaInicio = this.normalizeDateString(parsed.fechaInicio);
      const normFechaFin = this.normalizeDateString(parsed.fechaFin);

      return {
        intent: parsed.intent ?? 'ayuda',
        codigoS4: normCodigoS4,
        sku: normSku,
        idPedido: normIdPedido,
        termNombre: normTermNombre,
        idVendedor: normIdVendedor,
        mes: normMes,
        anio: normAnio,
        promoFiltro: normPromoFiltro,
        clienteNombre: normClienteNombre,
        categoria: normCategoria,
        fechaInicio: normFechaInicio,
        fechaFin: normFechaFin,
      } as IntentResult;
    } catch {
      return this.emptyIntent('ayuda');
    }
  }

  async generateReply(params: {
    system: string;
    user: string;
    maxOutputTokens?: number;
  }) {
    const res = await this.client.responses.create({
      model: this.config.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_output_tokens: params.maxOutputTokens ?? 180,
      temperature: 0.7,
    });

    const text = (res as any).output_text ?? '';
    return (text ?? '').toString();
  }

  // ============================
  // HELPERS BASE
  // ============================
  private baseIntent(intent: IntentResult['intent']): IntentResult {
    return {
      intent,
      codigoS4: null,
      sku: null,
      idPedido: null,
      termNombre: null,
      idVendedor: null,
      mes: null,
      anio: null,
      promoFiltro: null,
      clienteNombre: null,
      categoria: null,
      fechaInicio: null,
      fechaFin: null,
    };
  }

  private emptyIntent(intent: IntentResult['intent']): IntentResult {
    return this.baseIntent(intent);
  }

  private normalize(text: string): string {
    return (text ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getTodayParts(): { year: number; month: number; day: number } {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }

  private pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  private toYmd(year: number, month: number, day: number): string {
    return `${year}-${this.pad2(month)}-${this.pad2(day)}`;
  }

  private lastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  private normalizeDateString(value: unknown): string | null {
    if (value == null) return null;
    const v = String(value).trim();
    if (!v) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return v;
    }

    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return this.toYmd(year, month, day);
      }
    }

    return null;
  }

  private parseMesAnioFromText(
    raw: string,
  ): { mes: number | null; anio: number | null } {
    const t = this.normalize(raw);

    let mes: number | null = null;
    let anio: number | null = null;

    const today = this.getTodayParts();

    if (t.includes('este mes')) {
      return { mes: today.month, anio: today.year };
    }

    if (t.includes('mes pasado') || t.includes('el mes pasado')) {
      if (today.month === 1) {
        return { mes: 12, anio: today.year - 1 };
      }
      return { mes: today.month - 1, anio: today.year };
    }

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

    for (const k of Object.keys(months)) {
      if (t.includes(k)) {
        mes = months[k];
        break;
      }
    }

    const y = t.match(/\b(20\d{2})\b/);
    if (y?.[1]) {
      anio = Number(y[1]);
    } else if (mes != null) {
      anio = today.year;
    }

    return { mes, anio };
  }

  private parseDateRangeFromText(
    raw: string,
  ): { fechaInicio: string | null; fechaFin: string | null } {
    const text = (raw ?? '').toString().trim();
    const t = this.normalize(text);
    const today = this.getTodayParts();

    const isoDates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map(
      (m) => m[1],
    );

    if (isoDates.length >= 2) {
      return {
        fechaInicio: isoDates[0],
        fechaFin: isoDates[1],
      };
    }

    const esDates = [
      ...text.matchAll(/\b(\d{1,2}\/\d{1,2}\/20\d{2})\b/g),
    ].map((m) => this.normalizeDateString(m[1]));

    if (esDates.length >= 2) {
      return {
        fechaInicio: esDates[0] ?? null,
        fechaFin: esDates[1] ?? null,
      };
    }

    if (t.includes('hoy')) {
      const ymd = this.toYmd(today.year, today.month, today.day);
      return { fechaInicio: ymd, fechaFin: ymd };
    }

    if (t.includes('ayer')) {
      const d = new Date(today.year, today.month - 1, today.day);
      d.setDate(d.getDate() - 1);
      const ymd = this.toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return { fechaInicio: ymd, fechaFin: ymd };
    }

    const between = t.match(
      /\b(?:del|desde|entre)\s+(\d{1,2})\s+(?:al|a|y|hasta)\s+(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(20\d{2}))?\b/i,
    );

    if (between?.[1] && between?.[2] && between?.[3]) {
      const day1 = Number(between[1]);
      const day2 = Number(between[2]);
      const month = this.parseMonthName(between[3]);
      const year = between[4] ? Number(between[4]) : today.year;

      if (month) {
        return {
          fechaInicio: this.toYmd(year, month, day1),
          fechaFin: this.toYmd(year, month, day2),
        };
      }
    }

    const fullMonth = this.parseMesAnioFromText(text);
    if (
      (t.includes('entre') || t.includes('del') || t.includes('desde')) &&
      fullMonth.mes &&
      fullMonth.anio
    ) {
      const last = this.lastDayOfMonth(fullMonth.anio, fullMonth.mes);
      return {
        fechaInicio: this.toYmd(fullMonth.anio, fullMonth.mes, 1),
        fechaFin: this.toYmd(fullMonth.anio, fullMonth.mes, last),
      };
    }

    return { fechaInicio: null, fechaFin: null };
  }

  private parseMonthName(value: string): number | null {
    const v = this.normalize(value);
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

    return months[v] ?? null;
  }

  private extractVendorCode(raw: string): string | null {
    const t = (raw ?? '').toString().trim().toUpperCase();

    const m1 = t.match(/\(([A-Z0-9.]{1,20})\)/);
    if (m1?.[1]) return m1[1];

    const m2 = t.match(/\b([A-Z]\d{1,10})\b/);
    if (m2?.[1]) return m2[1];

    return null;
  }

  private startsWithLetterSku(value?: string | null): boolean {
    const v = (value ?? '').toString().trim().toUpperCase();
    return /^[A-Z]/.test(v);
  }

  private isAllowedSkuValue(value?: string | null): boolean {
    const v = (value ?? '').toString().trim().toUpperCase();
    if (!v) return false;
    return this.startsWithLetterSku(v);
  }

  private extractCodigoS4(text: string): string | null {
    const t = (text ?? '').toString().toUpperCase();
    const m = t.match(/\b([A-Z]{1,10}[A-Z0-9-]{2,30})\b/);

    if (!m?.[1]) return null;

    const sku = m[1].trim().toUpperCase().replace(/\s+/g, '');
    return this.isAllowedSkuValue(sku) ? sku : null;
  }

  private extractCategoriaFromText(raw: string): string | null {
    const original = (raw ?? '').toString().trim();
    const t = this.normalize(original);

    const knownCategories = [
      'licores',
      'licor',
      'cervezas',
      'cerveza',
      'vinos',
      'vino',
      'aguardientes',
      'aguardiente',
      'ron',
      'rones',
      'vodka',
      'whisky',
      'tequila',
      'ginebra',
      'gin',
      'brandy',
    ];

    for (const cat of knownCategories) {
      if (t.includes(cat)) {
        return cat.toUpperCase();
      }
    }

    const patterns = [
      /categoria\s+(.+?)(?:\s+en|\s+del|\s+de\s+el|\s+entre|\s+desde|\s+hasta|\s+este mes|\s+mes pasado|\s*$)/i,
      /categor[ií]a\s+(.+?)(?:\s+en|\s+del|\s+de\s+el|\s+entre|\s+desde|\s+hasta|\s+este mes|\s+mes pasado|\s*$)/i,
      /de la categoria\s+(.+?)(?:\s+en|\s+del|\s+entre|\s+desde|\s+hasta|\s+este mes|\s+mes pasado|\s*$)/i,
      /de la categor[ií]a\s+(.+?)(?:\s+en|\s+del|\s+entre|\s+desde|\s+hasta|\s+este mes|\s+mes pasado|\s*$)/i,
      /ventas de\s+(.+?)(?:\s+en|\s+del|\s+entre|\s+desde|\s+hasta|\s+este mes|\s+mes pasado|\s*$)/i,
      /cu[aá]nto se vendi[oó] de\s+(.+?)(?:\s+en|\s+del|\s+entre|\s+desde|\s+hasta|\s+este mes|\s+mes pasado|\s*$)/i,
    ];

    for (const p of patterns) {
      const m = original.match(p);
      const candidate = m?.[1]?.trim();
      if (!candidate) continue;

      const candidateNorm = this.normalize(candidate);

      if (
        candidateNorm.includes('producto') ||
        candidateNorm.includes('sku') ||
        /^[A-Z]{1,10}[A-Z0-9-]{2,30}$/i.test(candidate.trim())
      ) {
        return null;
      }

      if (
        candidateNorm === 'categoria' ||
        candidateNorm === 'categorias' ||
        candidateNorm === 'categoría' ||
        candidateNorm === 'categorías'
      ) {
        return null;
      }

      return candidate.trim().toUpperCase();
    }

    return null;
  }

  // ============================
  // DETECTORES POR REGLAS
  // ============================
  private detectMenuIntent(text: string): IntentResult | null {
    const t = this.normalize(text);

    if (
      [
        'menu',
        'menú',
        'inicio',
        'hola',
        'ayuda',
        'help',
        'soporte',
        'buenas',
        'buenos dias',
        'buenas tardes',
        'buenas noches',
      ].includes(t)
    ) {
      return this.baseIntent('menu');
    }

    if (
      t === 'catalogo' ||
      t === 'catálogo' ||
      t === 'categorias' ||
      t === 'categorías'
    ) {
      return this.baseIntent('catalogo');
    }

    return null;
  }

  private detectNextIntent(text: string): IntentResult | null {
    const t = this.normalize(text);

    if (
      [
        'siguiente',
        'siguientes',
        'mas',
        'más',
        'ver mas',
        'ver más',
        'continuar',
        'otra pagina',
        'otra página',
      ].includes(t)
    ) {
      return this.baseIntent('siguientes');
    }

    return null;
  }

  private detectPromoIntent(
    text: string,
  ): { intent: 'promocion'; promoFiltro?: string | null } | null {
    const t = (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const hablaDePromo =
      t.includes('promocion') ||
      t.includes('promociones') ||
      t.includes('promo') ||
      t.includes('promos') ||
      t.includes('prom');

    if (!hablaDePromo) return null;

    const stopWords = new Set([
      'producto',
      'productos',
      'promo',
      'promos',
      'prom',
      'promocion',
      'promociones',
      'en',
      'de',
      'del',
      'la',
      'el',
      'los',
      'las',
      'hay',
      'ver',
      'mostrar',
      'muestrame',
      'dame',
      'cuales',
      'cuáles',
      'que',
      'qué',
      'estan',
      'están',
    ]);

    const palabras = t
      .split(' ')
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => !stopWords.has(x));

    const promoFiltro = palabras.length ? palabras.join(' ') : null;

    return { intent: 'promocion', promoFiltro };
  }

  private detectNotasCreditoIntent(text: string): IntentResult | null {
    const t = this.normalize(text);

    if (!t.includes('nota de credito') && !t.includes('notas de credito')) {
      return null;
    }

    if (
      t.includes('que clientes tienen') ||
      t.includes('clientes con') ||
      t.includes('quien tiene') ||
      t === 'notas de credito' ||
      t === 'nota de credito'
    ) {
      return this.baseIntent('notas_credito_clientes');
    }

    const m =
      t.match(/notas de credito de\s+(.+)$/i) ||
      t.match(/nota de credito de\s+(.+)$/i) ||
      t.match(/nota de credito del cliente\s+(.+)$/i) ||
      t.match(/notas de credito del cliente\s+(.+)$/i) ||
      t.match(/muestrame las notas de credito de\s+(.+)$/i);

    if (m?.[1]) {
      return {
        ...this.baseIntent('notas_credito_cliente'),
        clienteNombre: m[1].trim(),
      };
    }

    return this.baseIntent('notas_credito_clientes');
  }

  private detectPedidoDetalleIntent(text: string): IntentResult | null {
    const t = this.normalize(text);
    if (
      !t.includes('detalle del pedido') &&
      !t.includes('detalle pedido') &&
      !t.includes('pedido ')
    ) {
      return null;
    }

    const idMatch = text.match(/\b(\d{6,15})\b/);
    if (
      idMatch?.[1] &&
      (t.includes('detalle del pedido') ||
        t.includes('detalle pedido') ||
        t.includes('pedido erp'))
    ) {
      return {
        ...this.baseIntent('pedido_erp_detalle'),
        idPedido: idMatch[1],
      };
    }

    return null;
  }

  private detectPedidoIntent(text: string): IntentResult | null {
    const t = this.normalize(text);

    if (
      t === 'pedido' ||
      t === 'iniciar pedido' ||
      t === 'hacer pedido' ||
      t === 'crear pedido' ||
      t === 'quiero hacer un pedido'
    ) {
      return this.baseIntent('pedido_iniciar');
    }

    if (t === 'ver pedido' || t === 'mi pedido') {
      return this.baseIntent('pedido_ver');
    }

    if (t === 'confirmar pedido') {
      return this.baseIntent('pedido_confirmar');
    }

    if (t === 'cancelar pedido') {
      return this.baseIntent('pedido_cancelar');
    }

    return null;
  }

  private detectSkuPorNombreIntent(text: string): IntentResult | null {
    const raw = (text ?? '').toString().trim();
    const t = this.normalize(text);

    const patterns = [
      /que sku es\s+(.+)$/i,
      /cual es el sku de\s+(.+)$/i,
      /sku de\s+(.+)$/i,
      /codigo de\s+(.+)$/i,
      /codigo del producto\s+(.+)$/i,
      /código de\s+(.+)$/i,
      /código del producto\s+(.+)$/i,
    ];

    for (const p of patterns) {
      const m = raw.match(p);
      if (m?.[1]) {
        return {
          ...this.baseIntent('sku_por_nombre'),
          termNombre: m[1].trim(),
        };
      }
    }

    if (
      (t.includes('sku') || t.includes('codigo') || t.includes('código')) &&
      !this.extractCodigoS4(raw)
    ) {
      const cleaned = raw
        .replace(/que sku es/i, '')
        .replace(/cual es el sku de/i, '')
        .replace(/sku de/i, '')
        .replace(/codigo de/i, '')
        .replace(/codigo del producto/i, '')
        .replace(/código de/i, '')
        .replace(/código del producto/i, '')
        .trim();

      if (cleaned) {
        return {
          ...this.baseIntent('sku_por_nombre'),
          termNombre: cleaned,
        };
      }
    }

    return null;
  }

  private detectStockIntent(text: string): IntentResult | null {
    const raw = (text ?? '').toString().trim();
    const t = this.normalize(text);

    if (!t.includes('stock') && !t.includes('existencia')) return null;

    const codigoS4 = this.extractCodigoS4(raw);

    let termNombre: string | null = null;
    if (!codigoS4) {
      termNombre =
        raw
          .replace(/\bstock\b/gi, '')
          .replace(/\bexistencia\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim() || null;
    }

    return {
      ...this.baseIntent('stock'),
      codigoS4,
      termNombre,
    };
  }

  private detectPronosticoIntent(text: string): IntentResult | null {
    const raw = (text ?? '').toString().trim();
    const t = this.normalize(text);

    if (
      !t.includes('pronostico') &&
      !t.includes('pronóstico') &&
      !t.includes('proyeccion') &&
      !t.includes('proyección') &&
      !t.includes('debe vender')
    ) {
      return null;
    }

    const { mes, anio } = this.parseMesAnioFromText(raw);
    const codigoS4 = this.extractCodigoS4(raw);
    const idVendedor = this.extractVendorCode(raw);

    let termNombre: string | null = null;

    if (!codigoS4) {
      termNombre =
        raw
          .replace(/pronostico/gi, '')
          .replace(/pronóstico/gi, '')
          .replace(/proyeccion/gi, '')
          .replace(/proyección/gi, '')
          .replace(/de este mes/gi, '')
          .replace(/este mes/gi, '')
          .replace(/del producto/gi, '')
          .replace(/\s+/g, ' ')
          .trim() || null;
    }

    return {
      ...this.baseIntent('pronostico_venta'),
      codigoS4,
      termNombre,
      idVendedor,
      mes,
      anio,
    };
  }

  private detectVentasVendedorIntent(text: string): IntentResult | null {
    const raw = (text ?? '').toString().trim();
    const t = this.normalize(text);

    const speaksVentas =
      t.includes('cuanto vendio') ||
      t.includes('cuanto vendió') ||
      t.includes('ventas del vendedor') ||
      t.includes('vendio ') ||
      t.includes('vendió ');

    if (!speaksVentas) return null;

    if (t.includes('producto') || t.includes('se vendio de')) return null;

    const { mes, anio } = this.parseMesAnioFromText(raw);
    const idVendedor = this.extractVendorCode(raw);

    let termNombre: string | null = null;

    const m1 = raw.match(
      /cu[aá]nto\s+vendi[oó]\s+(.+?)(?:\s+en|\s+este mes|\s*$)/i,
    );
    if (m1?.[1]) {
      termNombre = m1[1].replace(/\([A-Z0-9.]{1,20}\)/gi, '').trim();
    }

    if (!termNombre && t.includes('vendedor')) {
      const m2 = raw.match(/vendedor\s+(.+?)(?:\s+en|\s+este mes|\s*$)/i);
      if (m2?.[1]) {
        termNombre = m2[1].replace(/\([A-Z0-9.]{1,20}\)/gi, '').trim();
      }
    }

    return {
      ...this.baseIntent('ventas_vendedor_mes'),
      idVendedor,
      termNombre,
      mes,
      anio,
    };
  }

  private detectVentasProductoIntent(text: string): IntentResult | null {
    const raw = (text ?? '').toString().trim();
    const t = this.normalize(text);

    const speaksVentasProducto =
      t.includes('cuanto se vendio de') ||
      t.includes('cuanto se vendió de') ||
      t.includes('ventas del producto') ||
      t.includes('se vendio de') ||
      t.includes('se vendió de');

    if (!speaksVentasProducto) return null;

    if (t.includes('categoria') || t.includes('categoría')) return null;

    const { mes, anio } = this.parseMesAnioFromText(raw);
    const codigoS4 = this.extractCodigoS4(raw);

    let termNombre: string | null = null;

    if (!codigoS4) {
      const m1 = raw.match(
        /cu[aá]nto\s+se\s+vendi[oó]\s+de\s+(.+?)(?:\s+en|\s+este mes|\s*$)/i,
      );

      if (m1?.[1]) {
        termNombre = m1[1].trim();
      }
    }

    return {
      ...this.baseIntent('ventas_producto_mes'),
      sku: codigoS4,
      termNombre,
      mes,
      anio,
    };
  }

  private detectVentasCategoriaIntent(text: string): IntentResult | null {
    const raw = (text ?? '').toString().trim();
    const t = this.normalize(raw);

    const hablaCategoria =
      t.includes('ventas por categoria') ||
      t.includes('ventas por categorías') ||
      t.includes('ventas por categorías') ||
      t.includes('ventas por categoria') ||
      t.includes('ventas categoria') ||
      t.includes('ventas categorías') ||
      t.includes('ventas de la categoria') ||
      t.includes('ventas de la categoría') ||
      t.includes('cuanto se vendio de la categoria') ||
      t.includes('cuanto se vendió de la categoria') ||
      t.includes('cuanto se vendio de la categoría') ||
      t.includes('cuanto se vendió de la categoría') ||
      t.includes('top categorias') ||
      t.includes('top categorías') ||
      t.includes('categoria') ||
      t.includes('categoría');

    const categoryByWord =
      /\b(licores|licor|cervezas|cerveza|vinos|vino|aguardientes|aguardiente|ron|rones|vodka|whisky|tequila|ginebra|gin|brandy)\b/i.test(
        raw,
      );

    if (!hablaCategoria && !categoryByWord) {
      return null;
    }

    if (this.extractCodigoS4(raw)) {
      return null;
    }

    const { mes, anio } = this.parseMesAnioFromText(raw);
    const { fechaInicio, fechaFin } = this.parseDateRangeFromText(raw);
    const categoria = this.extractCategoriaFromText(raw);

    return {
      ...this.baseIntent('ventas_categoria'),
      categoria,
      mes: fechaInicio && fechaFin ? null : mes,
      anio: fechaInicio && fechaFin ? null : anio,
      fechaInicio,
      fechaFin,
    };
  }
}