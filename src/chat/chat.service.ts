import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncomingMessageDto } from './dto/incoming-message.dto';

import { Sesion } from './entities/sesion.entity';
import { Mensaje } from './entities/mensaje.entity';
import { OpenAiService } from './openai.service';
import { ModerationService } from './moderation.service';
import { InventoryService } from './inventory.service';
import { SalesService } from './sales.service';
import { NotasCreditoService } from './notas-credito.service';

import {
  buildGuidedMenu,
  buildNextActionMenu,
  buildStockActionMenu,
  capitalize,
  clampChars,
  cleanCategoriaTerm,
  extractCodigoS4,
  extractForecastProductTerm,
  extractMonthRange,
  extractProductoAmbiguoOption,
  extractPromotionOption,
  extractProyeccionVendedorProducto,
  extractSimpleMenuOption,
  extractSku,
  extractStockOption,
  extractVendorCode,
  extractVendedorNombreProyeccion,
  extractZona,
  filterItemsWithValidSku,
  formatLps,
  formatPeriodoTexto,
  formatStockDetail,
  formatStockDetailCore,
  formatStockDetailWithProductName,
  getNombreMes,
  isAllowedSkuValue,
  isGlobalBreakCommand,
  isNextPage,
  isPoliteClosing,
  isReservedForecastTerm,
  looksLikeBareProductName,
  looksLikePromoOptionReference,
  looksLikeSku,
  normalizeGuidedOption,
  normalizePhone,
  parseMesAnioFromText,
  getAnySkuValue,
  extractPromoMessageOption,
} from './helpers/chat.helpers';

type PromoSearchItem = {
  sku: string;
  nombre: string;
};

type PromoSearchCtx = {
  term?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
  items?: PromoSearchItem[];
};

// ============================
// VENTAS CATEGORIA
// ============================
type VentasCategoriaCtx = {
  mode?: 'VENTAS_CATEGORIA_FLOW';
  step?:
    | 'ASK_OPTION'
    | 'ASK_CATEGORY'
    | 'ASK_PERIOD'
    | 'ASK_MONTH_YEAR'
    | 'ASK_DATE_RANGE';
  categoria?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  mes?: number | null;
  anio?: number | null;
  topMode?: boolean | null;
};

  type VentasMenuCtx = {
  mode?: 'VENTAS_MENU';
  step?: 'ASK_OPTION' | 'ASK_PRODUCT' | 'ASK_VENDOR';
};

type VentasProductoCtx = {
  mode?: 'VENTAS_PRODUCTO_FLOW';
  step?: 'ASK_PERIOD' | 'ASK_MONTH_YEAR';
  sku?: string | null;
  nombre?: string | null;
  mes?: number | null;
  anio?: number | null;
};
// ============================
// PROYECCIÓN CONTEXTO
// ============================
type PronosticoCtx = {
  mode?: 'PRONOSTICO';
  step?:
    | 'ASK_OPTION'
    | 'ASK_PRODUCT'
    | 'ASK_ZONE'
    | 'ASK_VENDOR'
    | 'ASK_MONTH_YEAR';
  codigoS4?: string | null;
  termNombre?: string | null;
  mes?: number | null;
  anio?: number | null;
  zona?: string | null;
  vendedor?: string | null;
  vendedorNombre?: string | null;
  tipoConsulta?: 'PRODUCTO' | 'VENDEDOR_PRODUCTO' | 'ZONA_PRODUCTO' | null;
};

// ============================
// PREGUNTAS AMBIGUAS
// ============================
type ProductoAmbiguoCtx = {
  mode?: 'PRODUCTO_AMBIGUO';
  step?: 'ASK_ACTION';
  sku?: string | null;
  nombre?: string | null;
};

type ProductoLookupItem = {
  sku: string;
  nombre: string;
};

type ProductoLookupCtx = {
  mode?: 'PRODUCTO_LOOKUP';
  step?: 'ASK_SELECT';
  source?: 'STOCK' | 'VENTAS' | 'PROYECCION' | 'SKU' | null;
  term?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
  items?: ProductoLookupItem[];
};

type VendedorAmbiguoItem = {
  codigo: string;
  nombre: string;
};

type VendedorAmbiguoCtx = {
  mode?: 'VENDEDOR_AMBIGUO';
  step?: 'ASK_VENDOR';
  vendedorTerm?: string | null;
  productoTerm?: string | null;
  sku?: string | null;
  mes?: number | null;
  anio?: number | null;
  zona?: string | null;
  items?: VendedorAmbiguoItem[];
};

type CategoriaAmbiguaCtx = {
  mode?: 'CATEGORIA_AMBIGUA';
  step?: 'ASK_OPTION';
  categoriaBuscada?: string | null;
  opciones?: string[];
  mes?: number | null;
  anio?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
};

// ============================
// STOCK SEARCH CONTEXTO (paginación)
// ============================
type StockSearchItem = {
  sku: string;
  nombre: string;
};

type StockSearchCtx = {
  term?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  items?: StockSearchItem[];
};

// ============================
// NOTAS DE CRÉDITO CONTEXTO
// ============================
type NotasCreditoCtx = {
  mode?: 'NOTAS_CREDITO_MENU' | 'CLIENTES' | 'DETALLE_CLIENTE';
  step?: 'ASK_OPTION' | 'ASK_CLIENTE';
  term?: string | null;
  clienteNombre?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
};


// ============================
// FOLLOW UP CONTEXTO
// ============================
type FollowUpCtx = {
  mode?: 'FOLLOW_UP';
  source?: 'STOCK' | 'VENTAS' | 'PROYECCION' | 'VENTAS_CATEGORIA';
  sku?: string | null;
  nombre?: string | null;
  mes?: number | null;
  anio?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
};

type NavigationCtx = {
  mode?: 'NAVIGATION';
  source?:
    | 'MENU'
    | 'STOCK'
    | 'VENTAS'
    | 'VENTAS_CATEGORIA'
    | 'PROMOCION'
    | 'PRONOSTICO'
    | 'NOTAS_CREDITO'
    | null;
  step?:
    | 'IDLE'
    | 'AWAITING_NEXT_ACTION'
    | 'AWAITING_PERIOD'
    | 'AWAITING_PRODUCT'
    | 'AWAITING_CATEGORY'
    | 'AWAITING_VENDOR'
    | 'AWAITING_DATE_RANGE'
    | 'AWAITING_MONTH_YEAR'
    | null;
  payload?: Record<string, any> | null;
};

type ProductoNombreRow = {
  SKU: string;
  NombreProducto: string;
};

type VendedorRow = {
  SLPRSNID: string;
  Nombre: string;
};

type StockRow = {
  CodigoS4: string;
  Nombre: string;
  StockTotal?: number;
  IdProducto?: number;
  Precio?: number;
};

type MenuPaso = {
  id: number;
  tipoPaso: string;
  respuestaBot: string;
};

@Injectable()
export class ChatService {
  private readonly MENU_PRINCIPAL =
    'Hola, bienvenido.\n' +
    'Escribe lo que deseas consultar\n' +
    'Puedo ayudarte con informacion sobre:\n' +
    '1) Stock disponibles\n' +
    '2) Detalles de un pedido\n' +
    '3) Ventas\n' +
    '4) Proyecciones de venta\n' +
    '5) Notas de crédito\n' +
    '6) Promociones';

    private readonly MENU_OPCIONES =
  'Escribe lo que deseas consultar\n' +
  'Puedo ayudarte con informacion sobre:\n' +
  '1) Stock disponibles\n' +
  '2) Detalles de un pedido\n' +
  '3) Ventas\n' +
  '4) Proyecciones de venta\n' +
  '5) Notas de crédito\n' +
  '6) Promociones';

  constructor(
    @InjectRepository(Sesion) private readonly sesionRepo: Repository<Sesion>,
    @InjectRepository(Mensaje) private readonly mensajeRepo: Repository<Mensaje>,
    private readonly openAi: OpenAiService,
    private readonly moderation: ModerationService,
    private readonly inventoryService: InventoryService,
    private readonly salesService: SalesService,
    private readonly notasCreditoService: NotasCreditoService,
  ) {}

  private politeReplies = [
    'Con gusto. Estoy para servirte.',
    'Para servirte. Si necesitas algo más escríbeme.',
    'Con mucho gusto. Aquí estoy si necesitas algo más.',
  ];

  // ==========================================
  // Entrada desde WEB
  // ==========================================
  async handleWebMessage(userId: number, text: string) {
    const texto = (text ?? '').toString().trim();

    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('userId inválido');
    }

    if (!texto) {
      throw new BadRequestException('mensaje es requerido');
    }

    const sesion = await this.findOrCreateSesionByUsuario(userId);

    await this.saveMensaje({
      idSesion: sesion.id,
      idUsuario: userId,
      remitente: 'USUARIO',
      contenido: texto,
    });

    const { reply, followUp } = await this.resolveReplyFromDb(
      sesion,
      texto,
    );

    await this.saveMensaje({
      idSesion: sesion.id,
      idUsuario: userId,
      remitente: 'BOT',
      contenido: reply,
    });

    if (followUp) {
      await this.saveMensaje({
        idSesion: sesion.id,
        idUsuario: userId,
        remitente: 'BOT',
        contenido: followUp,
      });
    }

    sesion.ultimaActividad = new Date();
    await this.sesionRepo.save(sesion);

    return { reply, followUp };
  }

  private async findOrCreateSesionByUsuario(userId: number): Promise<Sesion> {
  const last = await this.sesionRepo.findOne({
    where: { idUsuario: userId, canal: 'WEB' } as any,
    order: { id: 'DESC' },
  });

  if (last) return last;

  const now = new Date();

  const nueva = this.sesionRepo.create();

  nueva.idUsuario = userId;
  nueva.fechaInicio = now;
  nueva.ultimaActividad = now;
  nueva.contexto = null;
  nueva.canal = 'WEB';
  nueva.canalRef = String(userId);

  return await this.sesionRepo.save(nueva);
}

  // ============================
  // ENTRADA MENSAJES (WhatsApp u otros)
  // ============================
  async handleIncoming(dto: IncomingMessageDto) {
    const telefono = normalizePhone(dto?.telefono);
    const texto = (dto?.mensaje ?? '').toString().trim();

    if (!telefono) throw new BadRequestException('telefono es requerido');
    if (!texto) throw new BadRequestException('mensaje es requerido');

    const sesion = await this.findOrCreateSesionByCanal('WHATSAPP', telefono);

    const uid = (sesion as any).idUsuario ?? null;

    await this.saveMensaje({
      idSesion: sesion.id,
      idUsuario: uid,
      remitente: 'USUARIO',
      contenido: texto,
    });

    const { reply, followUp } = await this.resolveReplyFromDb(
      sesion,
      texto,
    );

    await this.saveMensaje({
      idSesion: sesion.id,
      idUsuario: uid,
      remitente: 'BOT',
      contenido: reply,
    });

    if (followUp) {
      await this.saveMensaje({
        idSesion: sesion.id,
        idUsuario: uid,
        remitente: 'BOT',
        contenido: followUp,
      });
    }

    sesion.ultimaActividad = new Date();
    await this.sesionRepo.save(sesion);

    return { reply, followUp };
  }

  // =========================================================
  // CORE: Router por intención (OpenAI) — cerrado por contexto
  // =========================================================
  private async resolveReplyFromDb(
    sesion: Sesion,
    text: string,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
    const raw = (text ?? '').toString().trim();

    if (!raw) {
      const menu = await this.getMenuPaso();
      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

    const pasoActual = await this.getMenuPaso();

    // 1) Mensajes de despedida
    if (isPoliteClosing(raw)) {
      const reply =
        this.politeReplies[Math.floor(Math.random() * this.politeReplies.length)];

      return {
        reply,
        nextFlowId: pasoActual.id,
      };
    }

    // 2) Comandos globales -> limpiar contexto y volver al menú
    if (isGlobalBreakCommand(raw)) {
      await this.clearAllContexts(sesion);

      const menu = await this.getMenuPaso();
      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

    // 3) Flujo bloqueado: si hay contexto activo, NO reclasificar todavía
    const lockedFlow = this.getActiveLockedFlow(sesion);

if (lockedFlow === 'PRODUCTO_AMBIGUO') {
  return await this.handleProductoAmbiguoFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'PRODUCTO_LOOKUP') {
  return await this.handleProductoLookupFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'VENDEDOR_AMBIGUO') {
  return await this.handleVendedorAmbiguoFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'CATEGORIA_AMBIGUA') {
  return await this.handleCategoriaAmbiguaFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'VENTAS_MENU') {
  return await this.handleVentasMenuFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'VENTAS_PRODUCTO_FLOW') {
  return await this.handleVentasProductoFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'VENTAS_CATEGORIA_FLOW') {
  return await this.handleVentasCategoriaFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'PRONOSTICO') {
  return await this.handlePronosticoFlow(sesion, pasoActual, raw);
}


if (
  lockedFlow === 'NOTAS_CREDITO_MENU' ||
  lockedFlow === 'CLIENTES' ||
  lockedFlow === 'DETALLE_CLIENTE'
) {
  return await this.handleNotasCreditoFlow(sesion, pasoActual, raw);
}

if (lockedFlow === 'FOLLOW_UP') {
  return await this.handleFollowUpFlow(sesion, pasoActual, raw);
}

    // 4) PAGINACIÓN POR CONTEXTO (ANTES DE CLASIFICAR)
    if (isNextPage(raw)) {
      const pagination = await this.handleContextPagination(sesion, pasoActual);
      if (pagination) return pagination;
    }

    // 5) Stock listado + selección
    
    const stockCtx = this.readStockSearchCtx(sesion);
const selectedStockIndex = extractStockOption(raw);

if (selectedStockIndex && stockCtx?.items?.length) {
  const selected = stockCtx.items[selectedStockIndex - 1];

  if (!selected) {
    return {
      reply:
        `No encontré esa opción. Escribe un número válido del 1 al ${stockCtx.items.length}.`,
      nextFlowId: pasoActual.id,
    };
  }

  if (!isAllowedSkuValue(selected.sku)) {
    return {
      reply:
        'La opción seleccionada tiene un SKU no válido. Solo se permiten SKU que empiecen con letra.',
      nextFlowId: pasoActual.id,
    };
  }

  const detail = await this.inventoryService.findStockDetalleByCodigoS4(
    selected.sku,
  );

  if (!detail) {
    return {
      reply:
        `Encontré el producto seleccionado:\n` +
        `Producto: ${selected.nombre}\n` +
        `SKU: ${selected.sku}\n\n` +
        `Pero no encontré existencias para ese SKU.`,
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeFollowUpCtx(sesion, {
    mode: 'FOLLOW_UP',
    source: 'STOCK',
    sku: selected.sku,
    nombre: selected.nombre,
  });

  await this.writeNavigationCtx(sesion, {
    mode: 'NAVIGATION',
    source: 'STOCK',
    step: 'AWAITING_NEXT_ACTION',
    payload: {
      sku: selected.sku,
      nombre: selected.nombre,
    },
  });

  return {
  reply: formatStockDetailWithProductName(detail, selected.nombre),
  followUp: buildStockActionMenu(),
  nextFlowId: pasoActual.id,
};
  }

    // 6) Promo listada + selección
    // 6) Promo listada + selección
const promoCtx = this.readPromoSearchCtx(sesion);
const selectedPromoIndex = extractPromotionOption(raw);
const selectedPromoMessageIndex = extractPromoMessageOption(raw);

if (selectedPromoMessageIndex && promoCtx?.items?.length) {
  const selected = promoCtx.items[selectedPromoMessageIndex - 1];

  if (!selected) {
    return {
      reply:
        'No encontré esa promoción. Escribe por ejemplo: "mensaje 1".',
      nextFlowId: pasoActual.id,
    };
  }

  return {
    reply:
      `🎉 Promoción disponible\n\n` +
      `Estimado cliente, tenemos disponible la siguiente promoción:\n\n` +
      `${selected.nombre}\n\n` +
      `Consulte disponibilidad con su vendedor.`,
    nextFlowId: pasoActual.id,
  };
}

    if (selectedPromoIndex && promoCtx?.items?.length) {
      const page = promoCtx.page ?? 0;
const pageSize = promoCtx.pageSize ?? promoCtx.items.length;

const firstNumber = page * pageSize + 1;
const lastNumber = firstNumber + promoCtx.items.length - 1;

const localIndex =
  selectedPromoIndex >= firstNumber && selectedPromoIndex <= lastNumber
    ? selectedPromoIndex - firstNumber
    : selectedPromoIndex >= 1 && selectedPromoIndex <= promoCtx.items.length
      ? selectedPromoIndex - 1
      : -1;

const selected = promoCtx.items[localIndex];

      if (!selected) {
        return {
          reply:
            'No encontré esa opción de promoción. Escribe un número válido de la lista.',
          nextFlowId: pasoActual.id,
        };
      }

      if (!isAllowedSkuValue(selected.sku)) {
        return {
          reply:
            'La promoción seleccionada tiene un SKU no válido. Solo se permiten SKU que empiecen con letra.',
          nextFlowId: pasoActual.id,
        };
      }

      const detail = await this.inventoryService.findStockDetalleByCodigoS4(
        selected.sku,
      );

      if (!detail) {
        return {
          reply:
            `Encontré la promoción seleccionada:\n` +
            `Producto: ${selected.nombre}\n` +
            `SKU: ${selected.sku}\n\n` +
            `Pero no encontré existencias para ese SKU.`,
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'STOCK',
        sku: selected.sku,
        nombre: selected.nombre,
      });

      return {
      reply:
      `Stock de la promoción\n` +
      formatStockDetailCore(detail, selected.nombre),
      followUp: buildStockActionMenu(),
      nextFlowId: pasoActual.id,
      };
    }
const nav = this.readNavigationCtx(sesion);

    // 7) Si escribió solo un nombre de producto, ofrecer menú corto
const onlyDigits = /^\d+$/.test(raw);
const ventasProductoActiva = this.isVentasProductoActivo(sesion);
const ventasCategoriaActiva = this.isVentasCategoriaActiva(sesion);
const pronosticoActivo = this.isPronosticoActivo(sesion);

if (
  !onlyDigits &&
  !ventasProductoActiva &&
  !ventasCategoriaActiva &&
  !pronosticoActivo &&
  looksLikeBareProductName(raw)
) {

  const allHits = filterItemsWithValidSku<ProductoNombreRow>(
  (await this.salesService.findProductosByNombre(raw, 100)) as ProductoNombreRow[],
);

const totalHits = allHits.length;
const pageSize = 5;
const page = 0;

const hits = allHits.slice(0, pageSize);

  const ventasMenuCtx = this.readVentasMenuCtx(sesion);
  const isVentasProductFlowOrigin =
    ventasMenuCtx?.mode === 'VENTAS_MENU' && ventasMenuCtx?.step === 'ASK_PRODUCT';

  if (hits.length === 1) {
    if (!isVentasProductFlowOrigin) {
      await this.clearQueryContexts(sesion);
    }

    if (isVentasProductFlowOrigin) {
      await this.writeVentasMenuCtx(sesion, {});
      await this.writeVentasProductoCtx(sesion, {
        mode: 'VENTAS_PRODUCTO_FLOW',
        step: 'ASK_PERIOD',
        sku: hits[0].SKU,
        nombre: hits[0].NombreProducto,
        mes: null,
        anio: null,
      });

      return {
        reply:
          `Producto seleccionado:\n` +
          `Producto: ${hits[0].NombreProducto}\n` +
          `SKU: ${hits[0].SKU}\n\n` +
          buildGuidedMenu('PERIODO'),
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeProductoAmbiguoCtx(sesion, {
      mode: 'PRODUCTO_AMBIGUO',
      step: 'ASK_ACTION',
      sku: hits[0].SKU,
      nombre: hits[0].NombreProducto,
    });

    return {
      reply:
        `Encontré el producto:\n` +
        `Producto: ${hits[0].NombreProducto}\n` +
        `SKU: ${hits[0].SKU}\n\n` +
        `¿Qué deseas consultar?\n` +
        `1) Stock\n` +
        `2) Ventas\n` +
        `3) Proyección\n` +
        `4) SKU`,
      nextFlowId: pasoActual.id,
    };
  }

  if (hits.length > 1) {
    if (!isVentasProductFlowOrigin) {
      await this.clearQueryContexts(sesion);
    }
    if (isVentasProductFlowOrigin) {
      await this.writeVentasMenuCtx(sesion, {});
    }
    await this.writeProductoLookupCtx(sesion, {
      mode: 'PRODUCTO_LOOKUP',
      step: 'ASK_SELECT',
      source: isVentasProductFlowOrigin ? 'VENTAS' : 'STOCK',
      term: raw,
      page,
      pageSize,
      total: totalHits,
      items: allHits.map((p) => ({
        sku: p.SKU,
        nombre: p.NombreProducto,
      })),
    });

    const list = hits
      .map(
        (p: any, i: number) =>
          `${i + 1}) ${p.NombreProducto} (SKU: ${p.SKU})`,
      )
      .join('\n');

    return {
      reply:
        `Encontré ${totalHits} productos parecidos a "${raw}".\n` +
        `Mostrando ${page * pageSize + 1}-${page * pageSize + hits.length}:\n\n` +
        `${list}\n\n` +
        (totalHits > hits.length
          ? `Escribe el número de la opción, el SKU exacto o "siguientes" para ver más.`
          : `Escribe el número de la opción o el SKU exacto.`),
      nextFlowId: pasoActual.id,
    };
  }
}

    // 8) Proyección por vendedor + producto
    const proyVp = extractProyeccionVendedorProducto(raw);

    if (proyVp) {
      await this.clearAllContexts(sesion);

      const vendedorTerm = proyVp.vendedorTerm.trim();
      const productoTerm = proyVp.productoTerm.trim();

      let vendedorId: string | null = null;
      let nombreVendedor = vendedorTerm;

      const vendedorCode = extractVendorCode(vendedorTerm);
      if (vendedorCode) {
        vendedorId = vendedorCode.toUpperCase();
      } else {
        const vendedores = await this.salesService.findVendedores(vendedorTerm, 5);

        if (!vendedores.length) {
          return {
            reply: `No encontré el vendedor "${vendedorTerm}".`,
            nextFlowId: pasoActual.id,
          };
        }

        if (vendedores.length === 1) {
          vendedorId = vendedores[0].SLPRSNID;
          nombreVendedor = vendedores[0].Nombre;
        } else {
          const normalizeText = (value: string) =>
            (value ?? '')
              .toString()
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^\w\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();

          const vendedorTermNorm = normalizeText(vendedorTerm);

          const exact = vendedores.find((v: any) => {
            const nombre = normalizeText(v?.Nombre ?? '');
            return nombre === vendedorTermNorm;
          });

          if (exact) {
            vendedorId = exact.SLPRSNID;
            nombreVendedor = exact.Nombre;
          } else {
            await this.writeVendedorAmbiguoCtx(sesion, {
              mode: 'VENDEDOR_AMBIGUO',
              step: 'ASK_VENDOR',
              vendedorTerm,
              productoTerm,
              sku: null,
              mes: null,
              anio: null,
              zona: null,
              items: vendedores.map((v: any) => ({
                codigo: String(v.SLPRSNID ?? '').trim(),
                nombre: String(v.Nombre ?? '').trim(),
              })),
            });

            const list = vendedores
              .map(
                (v: any, i: number) =>
                  `${i + 1}) ${v.Nombre} (${v.SLPRSNID})`,
              )
              .join('\n');

            return {
              reply:
                `Encontré varios vendedores parecidos a "${vendedorTerm}":\n\n` +
                `${list}\n\n` +
                `Escribe el número o el código exacto del vendedor.`,
              nextFlowId: pasoActual.id,
            };
          }
        }
      }

      let sku: string | null = null;
      let nombreProducto = productoTerm;

      if (looksLikeSku(productoTerm)) {
        const candidateSku = productoTerm.toUpperCase();
        if (isAllowedSkuValue(candidateSku)) {
          sku = candidateSku;
        }
      } else {
        const productos = filterItemsWithValidSku(
          await this.salesService.findProductosByNombre(productoTerm, 5),
        );

        if (!productos.length) {
          return {
            reply: `No encontré el producto "${productoTerm}".`,
            nextFlowId: pasoActual.id,
          };
        }

        if (productos.length === 1) {
          sku = productos[0].SKU;
          nombreProducto = productos[0].NombreProducto;
        } else {
          const normalizedTerm = productoTerm
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

          const exact = productos.find((p: any) =>
            (p.NombreProducto ?? '')
              .toString()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .includes(normalizedTerm),
          );

          if (exact) {
            sku = exact.SKU;
            nombreProducto = exact.NombreProducto;
          } else {
            const list = productos
              .map(
                (p: any, i: number) =>
                  `${i + 1}) ${p.NombreProducto} (SKU: ${p.SKU})`,
              )
              .join('\n');

            return {
              reply:
                `Encontré varios productos parecidos a "${productoTerm}":\n\n` +
                `${list}\n\n` +
                `Escribe nuevamente la consulta completa con el SKU exacto.\n` +
                `Ejemplo:\n` +
                `"cuanto debe vender ${vendedorId ?? vendedorTerm} de ${productos[0].SKU}"`,
              nextFlowId: pasoActual.id,
            };
          }
        }
      }

      if (!sku || !isAllowedSkuValue(sku)) {
        return {
          reply:
            'No encontré un SKU válido para ese producto. Solo se permiten SKU que empiecen con letra.',
          nextFlowId: pasoActual.id,
        };
      }

      const data = await this.salesService.getProyeccionVendedorProducto({
        idVendedor: vendedorId!,
        sku,
      });

      if (!data) {
        return {
          reply:
            `No encontré proyección mensual para ${nombreVendedor} del producto ${nombreProducto}.`,
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'PROYECCION',
        sku,
        nombre: data.NombreProducto ?? nombreProducto,
      });

      const totalUnidades = Number(data.TotalUnidades ?? 0);
      const unidadTexto = totalUnidades === 1 ? 'unidad' : 'unidades';

      return {
        reply:
          `${data.NombreVendedor} debe vender ` +
          `${totalUnidades.toLocaleString('es-HN')} ${unidadTexto} ` +
          `del producto ${data.NombreProducto}.`,
        followUp: buildNextActionMenu('PROYECCION'),
        nextFlowId: pasoActual.id,
      };
    }

    // 9) Flujo guiado por navegación (ANTES de clasificar intención)
    const navigationReply = await this.handleNavigationFlow(
      sesion,
      pasoActual,
      raw,
    );
    if (navigationReply) {
      return navigationReply;
    }

  // 10) Opciones directas antes de OpenAI
  const rawMenu = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let intent: any;

if (
  rawMenu === '6' ||
  rawMenu === 'promocion' ||
  rawMenu === 'promociones' ||
  rawMenu === 'promo' ||
  rawMenu === 'promos'
) {
  intent = {
    intent: 'promocion',
    promoFiltro: null,
  };
} else {
  intent = (await this.openAi.classifyIntent(raw)) as any;
}

const rawVentasMenu = normalizeGuidedOption(raw);


const onlyVentas =
  rawVentasMenu === 'ventas' ||
  rawVentasMenu === 'venta' ||
  rawVentasMenu === 'ver ventas';

if (onlyVentas) {
  await this.clearQueryContexts(sesion);
  await this.writeVentasMenuCtx(sesion, {
    mode: 'VENTAS_MENU',
    step: 'ASK_OPTION',
  });

  return {
    reply:
      '¿Qué deseas consultar de ventas?\n' +
      '1) Ventas por producto\n' +
      '2) Ventas por vendedor\n' +
      '3) Ventas por categoría\n' +
      '4) Menú',
    nextFlowId: pasoActual.id,
  };
}

    const globalMenuOption = extractSimpleMenuOption(raw, 6);

if (globalMenuOption) {
  switch (globalMenuOption) {
    case 1:
      return this.resolveReplyFromDb(sesion, 'stock');

    case 2:
    return {
    reply:
      'Para consultar detalle de pedido, escribe el número de pedido.\n\n' +
      'Ejemplo: detalle del pedido 001008854',
    nextFlowId: pasoActual.id,
    };

    case 3:
      return this.resolveReplyFromDb(sesion, 'ventas');

    case 4:
      return this.resolveReplyFromDb(sesion, 'proyeccion');

    case 5:
      return this.resolveReplyFromDb(sesion, 'notas de credito');

    case 6:
    intent.intent = 'promocion';
    intent.promoFiltro = null;
    break;

    default:
      break;
  }
}
    // Corrección local para notas de crédito por cliente
const rawNc = (raw ?? '')
  .toString()
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const looksLikeNotasCliente =
  (rawNc.includes('nota de credito') || rawNc.includes('notas de credito')) &&
  (
    rawNc.includes(' de ') ||
    rawNc.includes(' del ') ||
    rawNc.includes(' tiene ') ||
    rawNc.includes(' tiene el cliente ') ||
    rawNc.includes('cuantas ')
  );

if (looksLikeNotasCliente) {
  const cleanedCliente = raw
    .replace(/notas?\s+de\s+credito/gi, '')
    .replace(/cuantas?/gi, '')
    .replace(/cuántas?/gi, '')
    .replace(/\btiene\b/gi, '')
    .replace(/\bel cliente\b/gi, '')
    .replace(/^\s*(de|del|la|el)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedCliente) {
    intent.intent = 'notas_credito_cliente';
    intent.clienteNombre = cleanedCliente;
  }
}
    // 10) Fuera de dominio
    if (intent?.intent === 'out_of_domain') {
  await this.clearAllContexts(sesion);

  return {
    reply:
      'No logré identificar una opción válida.\n\n' +
      this.MENU_OPCIONES,
    nextFlowId: pasoActual.id,
  };
}

    // 11) Router por intención
    switch (intent?.intent) {
      case 'menu':
      case 'ayuda': {
        await this.clearAllContexts(sesion);

        const menu = await this.getMenuPaso();
        return {
          reply: menu.respuestaBot ?? 'Menú Principal',
          nextFlowId: menu.id,
        };
      }

  case 'stock': {
  await this.clearQueryContexts(sesion);

  const normalizedRaw = raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const blockedFakeSkus = new Set([
    'STOCK',
    'EXISTENCIA',
    'EXISTENCIAS',
    'PRODUCTO',
    'PRODUCTOS',
    'PROMO',
    'PROMOS',
    'PROMOCION',
    'PROMOCIONES',
    'OFERTA',
    'OFERTAS',
    'BONO',
    'BONOS',
  ]);

  const intentCodigo = String(intent.codigoS4 ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const extractedCode = (
    extractSku(raw) ??
    extractCodigoS4(raw) ??
    ''
  )
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const rawCodigo =
    intentCodigo && !blockedFakeSkus.has(intentCodigo)
      ? intentCodigo
      : extractedCode && !blockedFakeSkus.has(extractedCode)
        ? extractedCode
        : '';

  if (rawCodigo) {
    await this.writeStockSearchCtx(sesion, {});
    const code = rawCodigo;

    if (!isAllowedSkuValue(code)) {
      return {
        reply:
          'El SKU indicado no es válido. Solo se permiten SKU que empiecen con letra.',
        nextFlowId: pasoActual.id,
      };
    }

    const detail = await this.inventoryService.findStockDetalleByCodigoS4(code);

    if (!detail) {
      return {
        reply: `No encontré el producto con SKU ${code}.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'STOCK',
      sku: code,
      nombre: detail?.Nombre ?? code,
    });

    await this.writeNavigationCtx(sesion, {
      mode: 'NAVIGATION',
      source: 'STOCK',
      step: 'AWAITING_NEXT_ACTION',
      payload: {
        sku: code,
        nombre: detail?.Nombre ?? code,
      },
    });

    return {
      reply: formatStockDetail(detail),
      followUp: buildStockActionMenu(),
      nextFlowId: pasoActual.id,
    };
  }

  const selectedIdx = extractStockOption(raw);
  const stockCtxCase = this.readStockSearchCtx(sesion);

  if (selectedIdx && stockCtxCase?.items?.length) {
    const selected = stockCtxCase.items[selectedIdx - 1];

    if (!selected) {
      return {
        reply: 'No encontré esa opción. Escribe un número válido de la lista.',
        nextFlowId: pasoActual.id,
      };
    }

    if (!isAllowedSkuValue(selected.sku)) {
      return {
        reply:
          'La opción seleccionada tiene un SKU no válido. Solo se permiten SKU que empiecen con letra.',
        nextFlowId: pasoActual.id,
      };
    }

    const detail = await this.inventoryService.findStockDetalleByCodigoS4(
      selected.sku,
    );

    if (!detail) {
      return {
        reply:
          `Encontré el producto seleccionado:\n` +
          `Producto: ${selected.nombre}\n` +
          `SKU: ${selected.sku}\n\n` +
          `Pero no encontré existencias para ese SKU.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'STOCK',
      sku: selected.sku,
      nombre: selected.nombre,
    });

    return {
      reply: formatStockDetailWithProductName(detail, selected.nombre),
      followUp: buildStockActionMenu(),
      nextFlowId: pasoActual.id,
    };
  }

  const term =
    (intent.termNombre ?? '').toString().trim() ||
    raw
      .replace(/\bstock\b/gi, '')
      .replace(/\bexistencia\b/gi, '')
      .replace(/\bexistencias\b/gi, '')
      .replace(/^\s*(de|del|la|el)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

  if (!term) {
    await this.writeNavigationCtx(sesion, {
      mode: 'NAVIGATION',
      source: 'STOCK',
      step: 'AWAITING_PRODUCT',
      payload: null,
    });

    return {
      reply:
        'Para consultar stock, escribe el SKU o el nombre del producto.\n\n' +
        'Formato sugerido:\n' +
        'Nombre + presentación + envase\n\n' +
        'Ejemplos:\n' +
        '- Plata Lite 750ml vidrio\n' +
        '- PT001022005',
      nextFlowId: pasoActual.id,
    };
  }

  const pageSize = 5;
  const page = 0;

  const rows = filterItemsWithValidSku(
    await this.inventoryService.findStockByNamePaged(term, page, pageSize),
  );

  const total = await this.inventoryService.countStockByName(term);

  if (!rows.length) {
    await this.writeStockSearchCtx(sesion, {});
    return {
      reply: `No encontré el producto "${term}".`,
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeStockSearchCtx(sesion, {
    term,
    page,
    pageSize,
    total,
    items: rows
      .filter((r: any) => isAllowedSkuValue(r.CodigoS4 ?? r.SKU))
      .map((r: any) => ({
        sku: String(r.CodigoS4 ?? r.SKU ?? '').trim(),
        nombre: String(r.Nombre ?? '').trim(),
      })),
  });

  const start = 1;
  const end = rows.length;
  const hasMore = end < total;

  const list = rows
    .map((r: any, i: number) => {
      const sku = r.CodigoS4 ?? r.SKU;
      return `${start + i}) ${sku} - ${r.Nombre} (Stock: ${(r.StockTotal ?? '0').toString()})`;
    })
    .join('\n');

  return {
    reply:
      `Resultados ${start}-${end} de ${total} para "${term}":\n\n${list}\n\n` +
      `Escribe el número de la opción para ver el detalle de stock.\n` +
      (hasMore
        ? `También puedes escribir "siguientes" para ver más.`
        : `No hay más resultados.`),
    nextFlowId: pasoActual.id,
  };
}

  case 'promocion': {

  const promoCtxCase = this.readPromoSearchCtx(sesion);
  const selectedPromoIdx = extractPromotionOption(raw);

  if (selectedPromoIdx && promoCtxCase?.items?.length) {
    const selected = promoCtxCase.items[selectedPromoIdx - 1];

    if (!selected) {
      return {
        reply:
          'No encontré esa opción de promoción. Escribe un número válido de la lista.',
        nextFlowId: pasoActual.id,
      };
    }

    if (!isAllowedSkuValue(selected.sku)) {
      return {
        reply:
          'La promoción seleccionada tiene un SKU no válido. Solo se permiten SKU que empiecen con letra.',
        nextFlowId: pasoActual.id,
      };
    }

    const detail = await this.inventoryService.findStockDetalleByCodigoS4(
      selected.sku,
    );

    if (!detail) {
      return {
        reply:
          `Encontré la promoción seleccionada:\n` +
          `Producto: ${selected.nombre}\n` +
          `SKU: ${selected.sku}\n\n` +
          `Pero no encontré existencias para ese SKU.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'STOCK',
      sku: selected.sku,
      nombre: selected.nombre,
    });

    return {
      reply:
        `Stock de la promoción\n` +
        formatStockDetailCore(detail, selected.nombre),
      followUp: buildStockActionMenu(),
      nextFlowId: pasoActual.id,
    };
  }

  const normalizePromoText = (value: string): string =>
    (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const rawFiltro = (intent.promoFiltro ?? '').trim();

  const genericPromoTerms = [
    'promocion',
    'promociones',
    'promo',
    'promos',
    'disponible',
    'disponibles',
    'todas',
    'todos',
    'ver',
    'mostrar',
    'lista',
    'listado',
  ];

  let filtro: string | null = rawFiltro || null;

  if (filtro) {
    const normalizedFiltro = normalizePromoText(filtro);

    const onlyGenericWords = normalizedFiltro
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => genericPromoTerms.includes(word));

    if (onlyGenericWords) {
      filtro = null;
    }
  }

  const pageSize = 5;
  const page = 0;

  const productos = filterItemsWithValidSku(
    await this.inventoryService.findProductosEnPromocionPaged(
      filtro,
      page,
      pageSize,
    ),
  );

  const total = await this.inventoryService.countProductosEnPromocion(filtro);

  if (!productos?.length) {
    await this.writePromoSearchCtx(sesion, {});
    return {
      reply: filtro
        ? `No encontré productos en promoción para "${filtro}".`
        : 'No encontré productos en promoción.',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writePromoSearchCtx(sesion, {
    term: filtro,
    page,
    pageSize,
    total,
    items: productos.map((p: any) => ({
      sku: String(p.sku ?? '').trim(),
      nombre: String(p.nombre ?? '').trim(),
    })),
  });

  const start = 1;
  const end = start + productos.length - 1;
  const hasMore = end < total;

  const list = productos
    .map((p: any, i: number) => `${start + i}) ${p.nombre} (SKU: ${p.sku})`)
    .join('\n');

  return {
  reply:
    (filtro
      ? `Encontré ${total} promociones para "${filtro}".\n`
      : `Encontré ${total} promociones disponibles.\n`) +
    `Mostrando ${start}-${end}:\n\n` +
    `${list}\n\n` +
    `Escribe el número de la opción para consultar stock.\n` +
    `Escribe "mensaje ${start}" para generar texto listo para cliente.\n` +
    (hasMore
      ? `Escribe "siguientes" para ver más promociones.`
      : `No hay más promociones.`),
  nextFlowId: pasoActual.id,
};
}

      case 'notas_credito_clientes': {
  await this.clearQueryContexts(sesion);

  const rawNorm = (raw ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const onlyGeneralNotas =
    rawNorm === '5' ||
    rawNorm === 'notas de credito' ||
    rawNorm === 'nota de credito' ||
    rawNorm === 'notas credito' ||
    rawNorm === 'nota credito';

  if (onlyGeneralNotas) {
    await this.writeNotasCreditoCtx(sesion, {
      mode: 'NOTAS_CREDITO_MENU',
      step: 'ASK_OPTION',
      term: null,
      clienteNombre: null,
      page: 1,
      pageSize: 10,
      total: 0,
    });

    return {
      reply:
        '¿Qué deseas consultar sobre notas de crédito?\n' +
        '1) Ver clientes con notas de crédito\n' +
        '2) Buscar notas de un cliente\n' +
        '3) Menú',
      nextFlowId: pasoActual.id,
    };
  }

  const page = 1;
  const pageSize = 10;
  const result = await this.notasCreditoService.getClientesConNotasCredito(
    page,
    pageSize,
  );

  if (!result?.data?.length) {
    await this.writeNotasCreditoCtx(sesion, {});
    return {
      reply: 'No encontré clientes con notas de crédito.',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeNotasCreditoCtx(sesion, {
    mode: 'CLIENTES',
    step: undefined,
    term: null,
    clienteNombre: null,
    page,
    pageSize,
    total: result.total ?? 0,
  });

  return {
    reply: this.formatClientesNotasCredito(result),
    nextFlowId: pasoActual.id,
  };
 }

  case 'notas_credito_cliente': {
  await this.clearQueryContexts(sesion);

  const cliente = (intent.clienteNombre ?? '').trim();

  const normalizedCliente = cliente
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    !cliente ||
    normalizedCliente === 'notas de credito' ||
    normalizedCliente === 'nota de credito' ||
    normalizedCliente === 'notas credito' ||
    normalizedCliente === 'nota credito'
  ) {
    await this.writeNotasCreditoCtx(sesion, {
      mode: 'NOTAS_CREDITO_MENU',
      step: 'ASK_OPTION',
      term: null,
      clienteNombre: null,
      page: 1,
      pageSize: 10,
      total: 0,
    });

    return {
      reply:
        '¿Qué deseas consultar sobre notas de crédito?\n' +
        '1) Ver clientes con notas de crédito\n' +
        '2) Buscar notas de un cliente\n' +
        '3) Menú',
      nextFlowId: pasoActual.id,
    };
  }

  const rows = await this.notasCreditoService.getNotasPorCliente(cliente);

  await this.writeNotasCreditoCtx(sesion, {
    mode: 'DETALLE_CLIENTE',
    step: undefined,
    term: cliente,
    clienteNombre: cliente,
    page: 1,
    pageSize: 10,
    total: rows.length ?? 0,
  });

  return {
    reply: this.formatNotasCreditoClientePage(rows, cliente, 1, 10),
    nextFlowId: pasoActual.id,
  };
}

  case 'ventas_categoria': {
  await this.clearQueryContexts(sesion);
  const categoriaInicial = cleanCategoriaTerm(
    raw.replace(/^ventas?\s+por\s+categoria\s*/i, ''),
  );

  const monthRange = extractMonthRange(raw);
  const parsedMesAnio = parseMesAnioFromText(raw);

  const tienePeriodo =
    !!(monthRange?.fechaInicio && monthRange?.fechaFin) ||
    (!!parsedMesAnio.mes && !!parsedMesAnio.anio);

  // Si el usuario solo dijo "ventas por categoria" o "ventas categoria"
  if (!categoriaInicial && !tienePeriodo) {
    await this.writeVentasCategoriaCtx(sesion, {
      mode: 'VENTAS_CATEGORIA_FLOW',
      step: 'ASK_OPTION',
      categoria: null,
      fechaInicio: null,
      fechaFin: null,
      mes: null,
      anio: null,
      topMode: null,
    });

    return {
      reply:
        '¿Qué deseas consultar?\n' +
        '1) Una categoría específica\n' +
        '2) Ver top categorías\n' +
        '3) Menú',
      nextFlowId: pasoActual.id,
    };
  }

  const categoriaExtraidaDesdeTexto = raw
    .replace(/^ventas?\s+de\s+/i, '')
    .replace(/^venta\s+de\s+/i, '')
    .replace(/^ventas?\s+por\s+categoria\s+de\s+/i, '')
    .replace(/^ventas?\s+categoria\s+/i, '')
    .replace(
      /\b(de|del)\s+(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|octubre|oct|noviembre|nov|diciembre|dic)\b.*$/i,
      '',
    )
    .replace(
      /\b(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|octubre|oct|noviembre|nov|diciembre|dic)\b.*$/i,
      '',
    )
    .replace(/\b(20\d{2})\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const categoriaDetectada =
  categoriaExtraidaDesdeTexto ||
  (intent?.categoria ?? '').trim() ||
  null;

  const categoriaNormalizada = (categoriaDetectada ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const categoriasInvalidas = new Set([
    '',
    'ventas',
    'venta',
    'categoria',
    'categorias',
    'ventas por categoria',
    'ventas por categorias',
    'por categoria',
  ]);

  const categoriaFinal = categoriasInvalidas.has(categoriaNormalizada)
    ? null
    : categoriaDetectada;

  const fechaInicio =
    monthRange?.fechaInicio ??
    ((intent?.fechaInicio ?? '').trim() || null);

  const fechaFin =
    monthRange?.fechaFin ??
    ((intent?.fechaFin ?? '').trim() || null);

  const mesFinal =
    fechaInicio && fechaFin
      ? null
      : Number(intent?.mes ?? 0) || null;

  const anioFinal =
    fechaInicio && fechaFin
      ? null
      : Number(intent?.anio ?? 0) || new Date().getFullYear();

  if ((!mesFinal || !anioFinal) && !(fechaInicio && fechaFin)) {
    await this.writeNavigationCtx(sesion, {
      mode: 'NAVIGATION',
      source: 'VENTAS_CATEGORIA',
      step: 'AWAITING_PERIOD',
      payload: {
        categoria: categoriaFinal,
      },
    });

    return {
      reply:
        `Necesito el período para consultar las ventas` +
        `${categoriaFinal ? ` de ${categoriaFinal}` : ''}.\n\n` +
        buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  if (categoriaFinal) {
    const data = await this.salesService.getVentasPorCategoria({
      categoria: categoriaFinal,
      mes: mesFinal,
      anio: anioFinal,
      fechaInicio,
      fechaFin,
    });

    if (!data) {
      const sugerencias = await this.salesService.buscarCategorias(
        categoriaFinal,
        5,
      );

      if (sugerencias?.length) {
        const opciones = sugerencias
          .map((x: any) => String(x.Categoria ?? '').trim())
          .filter(Boolean);

        await this.writeCategoriaAmbiguaCtx(sesion, {
          mode: 'CATEGORIA_AMBIGUA',
          step: 'ASK_OPTION',
          categoriaBuscada: categoriaFinal,
          opciones,
          mes: mesFinal,
          anio: anioFinal,
          fechaInicio,
          fechaFin,
        });

        const list = opciones
          .map((x: string, i: number) => `${i + 1}) ${x}`)
          .join('\n');

        return {
          reply:
            `No encontré ventas para la categoría "${categoriaFinal}" en ${formatPeriodoTexto({
              mes: mesFinal,
              anio: anioFinal,
              fechaInicio,
              fechaFin,
            })}.\n\n` +
            `Quizá quisiste decir:\n${list}`,
          nextFlowId: pasoActual.id,
        };
      }

      return {
        reply:
          `No encontré ventas para la categoría "${categoriaFinal}" en ${formatPeriodoTexto({
            mes: mesFinal,
            anio: anioFinal,
            fechaInicio,
            fechaFin,
          })}.`,
        nextFlowId: pasoActual.id,
      };
    }

    const venta = formatLps(data.VentaNeta);

    await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'VENTAS_CATEGORIA',
      nombre: data.Categoria || categoriaFinal,
      mes: mesFinal,
      anio: anioFinal,
      fechaInicio: fechaInicio ?? null,
      fechaFin: fechaFin ?? null,
    });

    return {
      reply:
        `Ventas por categoría\n` +
        `Categoría: ${data.Categoria || categoriaFinal}\n` +
        `Período: ${formatPeriodoTexto({
          mes: mesFinal,
          anio: anioFinal,
          fechaInicio,
          fechaFin,
        })}\n\n` +
        `Total vendido: ${venta}.`,
      followUp: buildNextActionMenu('VENTAS_CATEGORIA'),
      nextFlowId: pasoActual.id,
    };
  }

  const rows = await this.salesService.getVentasCategorias({
    mes: mesFinal,
    anio: anioFinal,
    fechaInicio,
    fechaFin,
  });

  if (!rows?.length) {
    return {
      reply:
        `No encontré ventas por categoría en ${formatPeriodoTexto({
          mes: mesFinal,
          anio: anioFinal,
          fechaInicio,
          fechaFin,
        })}.`,
      nextFlowId: pasoActual.id,
    };
  }

  const top = rows.slice(0, 10);

  const list = top
    .map(
      (r: any, i: number) =>
        `${i + 1}) ${r.Categoria} — ${formatLps(r.VentaNeta)}`,
    )
    .join('\n');

  const extra =
    rows.length > 10
      ? `\n\nMostrando 10 de ${rows.length} categorías.`
      : '';

  return {
    reply:
      `Ventas por categoría\n` +
      `Período: ${formatPeriodoTexto({
        mes: mesFinal,
        anio: anioFinal,
        fechaInicio,
        fechaFin,
      })}\n\n` +
      `${list}${extra}`,
    nextFlowId: pasoActual.id,
  };
}

      case 'siguientes': {
        const paginated = await this.handleContextPagination(sesion, pasoActual);
        if (paginated) return paginated;

        return {
          reply:
            'No tengo una búsqueda activa. Escribe por ejemplo: "Stock tatascan 750", "Promociones" o "Qué clientes tienen nota de crédito".',
          nextFlowId: pasoActual.id,
        };
      }

      case 'sku_por_nombre': {
        await this.clearQueryContexts(sesion);

        const term = (intent?.termNombre ?? '').trim();

        if (!term) {
          return {
            reply: 'Dime el nombre del producto para buscar su SKU.',
            nextFlowId: pasoActual.id,
          };
        }

        const hits = filterItemsWithValidSku(
          await this.salesService.findProductosByNombre(term, 5),
        );

        if (!hits.length) {
          return {
            reply: `No encontré un producto llamado "${term}".`,
            nextFlowId: pasoActual.id,
          };
        }

        if (hits.length === 1) {
          return {
            reply:
              `El SKU del producto es:\n\n` +
              `Producto: ${hits[0].NombreProducto}\n` +
              `SKU: ${hits[0].SKU}`,
            nextFlowId: pasoActual.id,
          };
        }

        const list = hits
          .map((p: any, i: number) => `${i + 1}) ${p.NombreProducto} (SKU: ${p.SKU})`)
          .join('\n');

      const ventasMenuCtx = this.readVentasMenuCtx(sesion);

  const lookupSource: 'STOCK' | 'VENTAS' =
  ventasMenuCtx?.mode === 'VENTAS_MENU' ? 'VENTAS' : 'STOCK';

  await this.writeProductoLookupCtx(sesion, {
  mode: 'PRODUCTO_LOOKUP',
  step: 'ASK_SELECT',
  source: lookupSource,
  term: raw,
  items: hits.map((p) => ({
    sku: p.SKU,
    nombre: p.NombreProducto,
    })),
  });

      return {
      reply:
        `Encontré varios productos parecidos:\n\n${list}\n\n` +
        `Escribe el número de la opción o el SKU exacto.`,
        nextFlowId: pasoActual.id,
       };
      }

      case 'pedido_erp_detalle': {
        await this.clearQueryContexts(sesion);

        const idPedido = (intent.idPedido ?? '').trim();
        if (!idPedido) {
          return {
            reply: 'Escribe por ejemplo: "Detalle del pedido 001008854".',
            nextFlowId: pasoActual.id,
          };
        }

        const rows = await this.inventoryService.findPedidoDetalleById(idPedido);
        if (!rows.length) {
          return {
            reply: `No encontré el pedido ${idPedido}.`,
            nextFlowId: pasoActual.id,
          };
        }

        const lines = rows
          .slice(0, 20)
          .map((r, i) => {
            const unidades = (r.Unidades ?? 0).toString();
            const und = (r.UndMedida ?? '').toString().trim();
            const nombre = (r.NombreMaterial ?? '(Sin nombre)').toString().trim();
            return `${i + 1}) ${r.Material} — ${nombre} — ${unidades} ${und}`.trim();
          })
          .join('\n');

        const totalsByUnit = rows.reduce((acc: Record<string, number>, r: any) => {
        const und = (r.UndMedida ?? 'SIN UNIDAD').toString().trim() || 'SIN UNIDAD';
          acc[und] = (acc[und] ?? 0) + Number(r.Unidades ?? 0);
        return acc;
        }, {});

const totalLines = Object.entries(totalsByUnit)
  .map(([und, total]) => `${Number(total.toFixed(2)).toLocaleString('es-HN')} ${und}`)
  .join('\n');

        return {
          reply:
            `Detalle del pedido ${idPedido}\n\n${lines}\n\n Totales por unidad:\n${totalLines}\n` +
            (rows.length > 20 ? `Mostrando 20 de ${rows.length} líneas.\n` : '') +
            `Escribe otro ID de pedido si quieres consultar.`,
          nextFlowId: pasoActual.id,
        };
      }
      case 'pedido_iniciar':
      case 'pedido_ver':
      case 'pedido_confirmar':
      case 'pedido_cancelar': {
        await this.clearQueryContexts(sesion);
        return {
          reply:
            'La opción de crear pedidos en el chatbot no está disponible actualmente.\n' +
            'Sí puedo ayudarte con detalle de pedido ERP, stock, promociones, ventas, notas de crédito y proyección.',
          nextFlowId: pasoActual.id,
        };
      }

      case 'pronostico_venta': {
  await this.clearQueryContexts(sesion);

  const intentCodigoRaw = String(intent?.codigoS4 ?? '')
  .trim()
  .toUpperCase();

const skuExtraido = (
  extractSku(raw) ??
  ''
)
  .trim()
  .toUpperCase();

const codigoRaw =
  (intentCodigoRaw && !isReservedForecastTerm(intentCodigoRaw)
    ? intentCodigoRaw
    : '') ||
  (skuExtraido && !isReservedForecastTerm(skuExtraido)
    ? skuExtraido
    : '');

const codigo = isAllowedSkuValue(codigoRaw) ? codigoRaw : '';

  const zona = extractZona(raw);
  const { mes: mesFinal, anio: anioFinal } = parseMesAnioFromText(raw);
  const vendedor = extractVendorCode(raw);
  const vendedorNombre = extractVendedorNombreProyeccion(raw);

  let termNombre = codigo ? null : extractForecastProductTerm(raw);

if (isReservedForecastTerm(termNombre)) {
  termNombre = null;
}

  const hasProduct = !!codigo || !!termNombre;
  const hasVendor = !!vendedor || !!vendedorNombre;
  const hasZone = !!zona;

  if (!hasProduct && !hasVendor && !hasZone) {
  await this.writePronosticoCtx(sesion, {});

  await this.writePronosticoCtx(sesion, {
    mode: 'PRONOSTICO',
    step: 'ASK_OPTION',
    codigoS4: null,
    termNombre: null,
    mes: null,
    anio: null,
    zona: null,
    vendedor: null,
    vendedorNombre: null,
    tipoConsulta: null,
  } as any);

  return {
    reply:
      '¿Qué tipo de proyección deseas consultar?\n' +
      '1) Por producto\n' +
      '2) Por vendedor y producto\n' +
      '3) Por zona y producto\n' +
      '4) Menú principal',
    nextFlowId: pasoActual.id,
  };
}

  if (hasVendor && !hasProduct) {
    await this.writePronosticoCtx(sesion, {
      mode: 'PRONOSTICO',
      step: 'ASK_PRODUCT',
      codigoS4: null,
      termNombre: null,
      mes: mesFinal,
      anio: anioFinal,
      zona: zona ?? null,
      vendedor: vendedor ?? null,
      vendedorNombre: vendedorNombre ?? null,
      tipoConsulta: 'VENDEDOR_PRODUCTO',
    } as any);

    return {
      reply: 'Ahora dime el SKU o nombre del producto.',
      nextFlowId: pasoActual.id,
    };
  }

  if (hasZone && !hasProduct) {
    await this.writePronosticoCtx(sesion, {
      mode: 'PRONOSTICO',
      step: 'ASK_PRODUCT',
      codigoS4: null,
      termNombre: null,
      mes: mesFinal,
      anio: anioFinal,
      zona: zona ?? null,
      vendedor: vendedor ?? null,
      vendedorNombre: vendedorNombre ?? null,
      tipoConsulta: 'ZONA_PRODUCTO',
    } as any);

    return {
      reply: 'Ahora dime el SKU o nombre del producto.',
      nextFlowId: pasoActual.id,
    };
  }

  if (hasProduct && (!mesFinal || !anioFinal)) {
    await this.writePronosticoCtx(sesion, {
      mode: 'PRONOSTICO',
      step: 'ASK_MONTH_YEAR',
      codigoS4: codigo || null,
      termNombre,
      mes: null,
      anio: null,
      zona: zona ?? null,
      vendedor: vendedor ?? null,
      vendedorNombre: vendedorNombre ?? null,
      tipoConsulta: hasVendor
        ? 'VENDEDOR_PRODUCTO'
        : hasZone
          ? 'ZONA_PRODUCTO'
          : 'PRODUCTO',
    } as any);

    return {
      reply:
        'Necesito el mes y año de la proyección.\n' +
        'Ejemplo: abril 2026',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writePronosticoCtx(sesion, {
    mode: 'PRONOSTICO',
    step: 'ASK_MONTH_YEAR',
    codigoS4: codigo || null,
    termNombre,
    mes: mesFinal,
    anio: anioFinal,
    zona: zona ?? null,
    vendedor: vendedor ?? null,
    vendedorNombre: vendedorNombre ?? null,
    tipoConsulta: hasVendor
      ? 'VENDEDOR_PRODUCTO'
      : hasZone
        ? 'ZONA_PRODUCTO'
        : 'PRODUCTO',
  } as any);

  return await this.handlePronosticoFlow(sesion, pasoActual, raw);
}
      

      case 'ventas_vendedor_mes': {
  await this.clearQueryContexts(sesion);

  const parsedPeriodo = parseMesAnioFromText(raw);
  const now = new Date();
  const mesSeguro = parsedPeriodo.mes ?? now.getMonth() + 1;
  const anioSeguro = parsedPeriodo.anio ?? now.getFullYear();

  const slprsnid =
    extractVendorCode(raw) ?? (intent as any)?.idVendedor ?? null;
  const termVendedor = (intent?.termNombre ?? '').trim();

        let vendedorId = slprsnid;

        if (!vendedorId && termVendedor) {
          const hits = await this.salesService.findVendedores(termVendedor, 5);
          if (!hits.length) {
            return {
              reply: `No encontré el vendedor: "${termVendedor}".`,
              nextFlowId: pasoActual.id,
            };
          }

          if (hits.length === 1) {
            vendedorId = hits[0].SLPRSNID;
          } else {
            await this.writeVendedorAmbiguoCtx(sesion, {
            mode: 'VENDEDOR_AMBIGUO',
            step: 'ASK_VENDOR',
            vendedorTerm: termVendedor,
            productoTerm: null,
            sku: null,
            mes: mesSeguro,
            anio: anioSeguro,
            zona: null,
            items: hits.map((v: any) => ({
              codigo: String(v.SLPRSNID ?? '').trim(),
              nombre: String(v.Nombre ?? '').trim(),
            })),
          });

            const list = hits
              .map(
                (v: any, i: number) =>
                  `${i + 1}) ${v.Nombre} (${v.SLPRSNID})`,
              )
              .join('\n');

            return {
              reply:
                `Encontré varios vendedores parecidos a "${termVendedor}":\n\n` +
                `${list}\n\n` +
                `Escribe el número o el código exacto del vendedor.`,
              nextFlowId: pasoActual.id,
            };
          }
        }

        if (!vendedorId) {
          return {
            reply: 'Indícame el vendedor. Ej: "Julio" o "(C93)".',
            nextFlowId: pasoActual.id,
          };
        }

        const row = await this.salesService.getVentaNetaVendedorMes({
        slprsnid: vendedorId,
        mes: mesSeguro,
        anio: anioSeguro,
        });

        if (!row) {
          const nombreMes = getNombreMes(mesSeguro);
          const vend = await this.salesService.findVendedores(vendedorId, 1);
          const nombreCompleto = vend?.length
            ? `${vend[0].Nombre}`.trim()
            : vendedorId;

          return {
            reply: `No encontré ventas para ${nombreCompleto} en ${nombreMes} ${anioSeguro}.`,
            nextFlowId: pasoActual.id,
          };
        }

        const nombre = (row.Nombre ?? '').toString().trim() || vendedorId;
        const venta = formatLps(row.VentaNeta);

        return {
          reply: `Ventas del mes (Vendedor)\n${nombre} (${vendedorId}) vendió ${venta}.`,
          nextFlowId: pasoActual.id,
        };
      }

      case 'ventas_producto_mes': {
        await this.clearQueryContexts(sesion);

        const { mes, anio } = parseMesAnioFromText(raw);
        const now = new Date();
        const mesSeguro = mes ?? now.getMonth() + 1;
        const anioSeguro = anio ?? now.getFullYear();
        const termProducto = (intent?.termNombre ?? '').trim();

        const extractedSku = extractSku(raw);
        const sku = termProducto
          ? intent?.sku ?? null
          : extractedSku ?? intent?.sku ?? null;

        let finalSku = sku;
        let nombreDetectado = '';

        if (finalSku && !isAllowedSkuValue(finalSku)) {
          finalSku = null;
        }

        if (!finalSku && termProducto) {
          const hits = filterItemsWithValidSku(
            await this.salesService.findProductosByNombre(
              termProducto,
              5,
            ),
          );

          if (!hits.length) {
            return {
              reply:
                `No encontré el producto "${termProducto}". ` +
                `Intenta con el SKU o con un nombre más específico.`,
              nextFlowId: pasoActual.id,
            };
          }

          if (hits.length > 1) {
            const exactNormalized = termProducto
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();

            const exact = hits.find((p: any) =>
              (p.NombreProducto ?? '')
                .toString()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .includes(exactNormalized),
            );

            if (exact) {
              finalSku = exact.SKU;
              nombreDetectado = exact.NombreProducto;
            } else {
              const list = hits
                .map(
                  (p: any, i: number) =>
                    `${i + 1}) ${p.NombreProducto} (SKU: ${p.SKU})`,
                )
                .join('\n');

              return {
                reply:
                  `Encontré varios productos parecidos a "${termProducto}":\n\n` +
                  `${list}\n\n` +
                  `Escríbeme el SKU exacto para decirte cuánto se vendió.`,
                nextFlowId: pasoActual.id,
              };
            }
          } else {
            finalSku = hits[0].SKU;
            nombreDetectado = hits[0].NombreProducto;
          }
        }

        if (!finalSku) {
          return {
            reply:
              'Indícame el producto o SKU. Ej: "PT0000123" o "Cuánto se vendió de Catrachito 1000 ML".',
            nextFlowId: pasoActual.id,
          };
        }

        const nombreMes = getNombreMes(mesSeguro);
        const row = await this.salesService.getVentaNetaProductoMesBySku({
        sku: finalSku,
        mes: mesSeguro,
        anio: anioSeguro,
        });

        if (!row) {
          return {
            reply: `No encontré ventas para ${nombreDetectado || finalSku} en ${nombreMes} ${anioSeguro}.`,
            nextFlowId: pasoActual.id,
          };
        }

        const venta = formatLps(row.VentaNeta);
        const nombreProd = (row.NombreProducto ?? nombreDetectado ?? '')
          .toString()
          .trim();

       await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'VENTAS',
        sku: finalSku,
        nombre: nombreProd || finalSku,
        mes: mesSeguro,
        anio: anioSeguro,
      });

        return {
          reply:
            `Venta del mes (Producto)\n` +
            `Se vendieron ${venta} de ${nombreProd || 'este producto'}\n` +
            `SKU: ${finalSku}.`,
          followUp: buildNextActionMenu('VENTAS'),
          nextFlowId: pasoActual.id,
        };
      }

      default:
        break;
    }

    // 12) Fallback contextual
    const contextualReply = this.buildContextualInvalidInputReply(sesion);
    if (contextualReply) {
      return {
        reply: contextualReply,
        nextFlowId: pasoActual.id,
      };
    }

    // 13) Fallback dentro de dominio
    const allowed = await this.moderation.isAllowedText(raw);
    if (!allowed) {
      return {
        reply:
          'No puedo ayudar con ese contenido. Puedo ayudarte con: 1) Stock, 2) Detalles de un pedido, 3) Ventas,  4) Proyecciones de venta o 5) Notas de crédito.',
        nextFlowId: pasoActual.id,
      };
    }

    const safe = clampChars(
      'No logré identificar una opción válida.\n\n' +
        'Puedo ayudarte con:\n' +
        '1) Stock\n' +
        '2) Promociones\n' +
        '3) Ventas\n' +
        '4) Proyección\n' +
        '5) Detalle de pedido ERP\n' +
        '6) Notas de crédito\n\n' +
        'Escribe el número o el nombre de la opción.',
      500,
    );

    return { reply: safe, nextFlowId: pasoActual.id };
  }

  // ============================
  // PAGINACIÓN POR CONTEXTO
  // ============================
  private async handleContextPagination(
    sesion: Sesion,
    pasoActual: MenuPaso,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number } | null> {
    const ncCtx = this.readNotasCreditoCtx(sesion);

    if (ncCtx?.mode === 'DETALLE_CLIENTE' && ncCtx?.clienteNombre) {
      const pageSize = ncCtx.pageSize ?? 10;
      const nextPage = (ncCtx.page ?? 1) + 1;
      const rows = await this.notasCreditoService.getNotasPorCliente(
        ncCtx.clienteNombre,
      );

      const start = (nextPage - 1) * pageSize;
      const pageRows = rows.slice(start, start + pageSize);

      if (!pageRows.length) {
        await this.writeNotasCreditoCtx(sesion, {});
        return {
          reply: 'No hay más notas de crédito para ese cliente.',
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeNotasCreditoCtx(sesion, {
        mode: 'DETALLE_CLIENTE',
        term: ncCtx.term ?? ncCtx.clienteNombre,
        clienteNombre: ncCtx.clienteNombre,
        page: nextPage,
        pageSize,
        total: rows.length,
      });

      return {
        reply: this.formatNotasCreditoClientePage(
          rows,
          ncCtx.clienteNombre,
          nextPage,
          pageSize,
        ),
        nextFlowId: pasoActual.id,
      };
    }

    if (ncCtx?.mode === 'CLIENTES' && ncCtx?.pageSize != null) {
      const pageSize = ncCtx.pageSize ?? 10;
      const nextPage = (ncCtx.page ?? 1) + 1;

      const result = await this.notasCreditoService.getClientesConNotasCredito(
        nextPage,
        pageSize,
      );

      if (!result?.data?.length) {
        await this.writeNotasCreditoCtx(sesion, {});
        return {
          reply: 'No hay más clientes con notas de crédito.',
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeNotasCreditoCtx(sesion, {
        mode: 'CLIENTES',
        term: null,
        clienteNombre: null,
        page: nextPage,
        pageSize,
        total: result.total ?? ncCtx.total ?? 0,
      });

      return {
        reply: this.formatClientesNotasCredito(result),
        nextFlowId: pasoActual.id,
      };
    }

    const promoCtx = this.readPromoSearchCtx(sesion);
    if (promoCtx?.pageSize != null && promoCtx?.total != null) {
      const pageSize = promoCtx.pageSize ?? 5;
      const nextPage = (promoCtx.page ?? 0) + 1;
      const filtro = promoCtx.term ?? null;

      const rows = filterItemsWithValidSku(
        await this.inventoryService.findProductosEnPromocionPaged(
          filtro,
          nextPage,
          pageSize,
        ),
      );
      const total = promoCtx.total ?? 0;

      if (!rows.length) {
        await this.writePromoSearchCtx(sesion, {});
        return {
          reply: filtro
            ? `Ya no hay más promociones para "${filtro}".`
            : 'Ya no hay más promociones.',
          nextFlowId: pasoActual.id,
        };
      }

      await this.writePromoSearchCtx(sesion, {
        term: filtro,
        page: nextPage,
        pageSize,
        total,
        items: rows
          .filter((p: any) => isAllowedSkuValue(p.sku))
          .map((p: any) => ({
            sku: String(p.sku ?? '').trim(),
            nombre: String(p.nombre ?? '').trim(),
          })),
      });

      const start = nextPage * pageSize + 1;
      const end = start + rows.length - 1;
      const hasMore = end < total;

      const list = rows
        .map((p: any, i: number) => `${start + i}) ${p.nombre} (SKU: ${p.sku})`)
        .join('\n');

      return {
        reply:
          (filtro
            ? `Más promociones para "${filtro}" (${start}-${end} de ${total}):\n\n`
            : `Más promociones (${start}-${end} de ${total}):\n\n`) +
          `${list}\n\n` +
          (hasMore
            ? `Escribe "siguientes" para ver más promociones.`
            : `No hay más promociones.`),
        nextFlowId: pasoActual.id,
      };
    }

    const stockCtx = this.readStockSearchCtx(sesion);
    if (stockCtx?.term) {
      const pageSize = stockCtx.pageSize ?? 5;
      const nextPage = (stockCtx.page ?? 0) + 1;

      const rows = filterItemsWithValidSku(
        await this.inventoryService.findStockByNamePaged(
          stockCtx.term,
          nextPage,
          pageSize,
        ),
      );
      const total =
        stockCtx.total ?? (await this.inventoryService.countStockByName(stockCtx.term));

      if (!rows.length) {
        await this.writeStockSearchCtx(sesion, {});
        return {
          reply: `Ya no hay más resultados para "${stockCtx.term}".`,
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeStockSearchCtx(sesion, {
        term: stockCtx.term,
        page: nextPage,
        pageSize,
        total,
        items: rows
          .filter((r: any) => isAllowedSkuValue(r.CodigoS4))
          .map((r: any) => ({
            sku: String(r.CodigoS4 ?? '').trim(),
            nombre: String(r.Nombre ?? '').trim(),
          })),
      });

      const start = nextPage * pageSize + 1;
      const end = start + rows.length - 1;
      const hasMore = end < total;

      const list = rows
        .map(
          (r, i) =>
            `${start + i}) ${r.CodigoS4} - ${r.Nombre} (Stock: ${(r.StockTotal ?? '0').toString()})`,
        )
        .join('\n');

      return {
    reply:
    `Resultados ${start}-${end} de ${total} para "${stockCtx.term}":\n\n${list}\n\n` +
    `Escribe el número de la opción para ver el detalle de stock.\n` +
    (hasMore
      ? `También puedes escribir "siguientes" para ver más.`
      : `No hay más resultados.`),
    nextFlowId: pasoActual.id,
    };
    }

    return null;
  }

  private formatClientesNotasCredito(result: {
    data: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  }): string {
    if (!result.data?.length) {
      return 'No encontré clientes con notas de crédito.';
    }

    let msg = `Clientes con nota de crédito (página ${result.page} de ${result.totalPages}):\n\n`;

    for (const row of result.data) {
      msg += `- ${row.CLIENTE} (${row.COD_CLIENTE}) | Notas: ${row.cantidad_notas} | Total: L ${Number(
        row.total_notas ?? 0,
      ).toFixed(2)}\n`;
    }

    if (result.hasNext) {
      msg += `\nEscribe "siguientes" para ver más clientes.`;
    }

    return msg.trim();
  }

  private formatNotasCreditoCliente(rows: any[], clienteBuscado: string): string {
    return this.formatNotasCreditoClientePage(rows, clienteBuscado, 1, 10);
  }

  private formatNotasCreditoClientePage(
    rows: any[],
    clienteBuscado: string,
    page: number,
    pageSize: number,
  ): string {
    if (!rows?.length) {
      return `No encontré notas de crédito para "${clienteBuscado}".`;
    }

    const cliente = rows[0]?.CLIENTE ?? clienteBuscado;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    if (!pageRows.length) {
      return `No hay más notas de crédito para "${cliente}".`;
    }

    let msg = `Notas de crédito de ${cliente}:\n\n`;

    for (const row of pageRows) {
      const fecha = row.FECHA_DOCUMENTO
        ? new Date(row.FECHA_DOCUMENTO).toISOString().slice(0, 10)
        : 'N/D';

      msg += `- Fecha: ${fecha}\n`;
      msg += `  NOMBRE CTA: ${row.nombreCta ?? 'N/D'}\n`;
      msg += `  DESCRIPCION: ${row.DESCRIPCION ?? 'N/D'}\n`;
      msg += `  DOC SAP: ${row.DOC_SAP ?? 'N/D'}\n`;
      msg += `  TOTAL: L ${Number(row.TOTAL ?? 0).toFixed(2)}\n\n`;
    }

    const totalPages = Math.ceil(rows.length / pageSize);

    if (page < totalPages) {
      msg += `Mostrando ${start + 1}-${start + pageRows.length} de ${rows.length} notas.\n`;
      msg += `Escribe "siguientes" para ver más.`;
    } else if (rows.length > pageSize) {
      msg += `Mostrando ${start + 1}-${start + pageRows.length} de ${rows.length} notas.`;
    }

    return msg.trim();
  }
  // ============================
  // FLUJO VENTAS CATEGORIA
  // ============================
private async handleVentasMenuFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  raw: string,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  const ctx = this.readVentasMenuCtx(sesion);

  if (ctx?.mode !== 'VENTAS_MENU' || !ctx?.step) {
    return {
      reply: 'No hay un menú de ventas activo.',
      nextFlowId: pasoActual.id,
    };
  }

  const option = extractSimpleMenuOption(raw, 4);
  const t = normalizeGuidedOption(raw);

  if (ctx.step === 'ASK_PRODUCT') {
  const term = raw.trim();
  const optionProducto = extractSimpleMenuOption(raw, 5);
  const t = normalizeGuidedOption(raw);

  const skuDetectado = (
    extractSku(term) ??
    extractCodigoS4(term) ??
    ''
  )
    .trim()
    .toUpperCase();

  if (!term) {
    return {
      reply: 'Dime el SKU o nombre del producto.',
      nextFlowId: pasoActual.id,
    };
  }

  // Si el usuario escribe solo un número, no lo tomes como nombre de producto
  if (/^\d+$/.test(term)) {
    return {
      reply:
        'Estoy esperando el SKU o nombre del producto.\n\n' +
        'Ejemplos:\n' +
        '- PT001004003\n' +
        '- Catrachito 1000ml pet\n\n' +
        'También puedes escribir "menu" para salir.',
      nextFlowId: pasoActual.id,
    };
  }

  if (t === 'menu' || t === 'menú' || optionProducto === 5) {
    await this.clearAllContexts(sesion);
    const menu = await this.getMenuPaso();

    return {
      reply: menu.respuestaBot ?? 'Menú Principal',
      nextFlowId: menu.id,
    };
  }

  // Si escribió SKU exacto
  if (skuDetectado && isAllowedSkuValue(skuDetectado)) {
    const detail = await this.inventoryService.findStockDetalleByCodigoS4(
      skuDetectado,
    );

    if (!detail) {
      return {
        reply: `No encontré el producto con SKU ${skuDetectado}.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeVentasMenuCtx(sesion, {});
    await this.writeVentasProductoCtx(sesion, {
      mode: 'VENTAS_PRODUCTO_FLOW',
      step: 'ASK_PERIOD',
      sku: skuDetectado,
      nombre: detail?.Nombre ?? skuDetectado,
      mes: null,
      anio: null,
    });

    return {
      reply:
        `Producto seleccionado:\n` +
        `Producto: ${detail?.Nombre ?? skuDetectado}\n` +
        `SKU: ${skuDetectado}\n\n` +
        buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  const hits = filterItemsWithValidSku(
    await this.salesService.findProductosByNombre(term, 5),
  );

  if (!hits.length) {
    return {
      reply: `No encontré el producto "${term}".`,
      nextFlowId: pasoActual.id,
    };
  }

  if (hits.length === 1) {
    await this.writeVentasMenuCtx(sesion, {});
    await this.writeVentasProductoCtx(sesion, {
      mode: 'VENTAS_PRODUCTO_FLOW',
      step: 'ASK_PERIOD',
      sku: hits[0].SKU,
      nombre: hits[0].NombreProducto,
      mes: null,
      anio: null,
    });

    return {
      reply:
        `Producto seleccionado:\n` +
        `Producto: ${hits[0].NombreProducto}\n` +
        `SKU: ${hits[0].SKU}\n\n` +
        buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeProductoLookupCtx(sesion, {
    mode: 'PRODUCTO_LOOKUP',
    step: 'ASK_SELECT',
    source: 'VENTAS',
    term,
    items: hits.map((p) => ({
      sku: p.SKU,
      nombre: p.NombreProducto,
    })),
  });

  const list = hits
    .map((p: any, i: number) => `${i + 1}) ${p.NombreProducto} (SKU: ${p.SKU})`)
    .join('\n');

  return {
    reply:
      `Encontré varios productos parecidos a "${term}":\n\n` +
      `${list}\n\n` +
      `Escribe el número de la opción o el SKU exacto.`,
    nextFlowId: pasoActual.id,
  };
}

  if (ctx.step === 'ASK_OPTION') {
    if (option === 1 || t === 'producto' || t === 'ventas por producto') {
      await this.writeVentasMenuCtx(sesion, {
        mode: 'VENTAS_MENU',
        step: 'ASK_PRODUCT',
      });

      return {
        reply: 'Dime el SKU o nombre del producto.',
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 2 || t === 'vendedor' || t === 'ventas por vendedor') {
      await this.writeVentasMenuCtx(sesion, {
        mode: 'VENTAS_MENU',
        step: 'ASK_VENDOR',
      });
      return {
        reply: 'Dime el código o nombre del vendedor.',
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 3 || t === 'categoria' || t === 'ventas por categoria') {
      await this.writeVentasMenuCtx(sesion, {});
      await this.writeVentasCategoriaCtx(sesion, {
        mode: 'VENTAS_CATEGORIA_FLOW',
        step: 'ASK_OPTION',
        categoria: null,
        fechaInicio: null,
        fechaFin: null,
        mes: null,
        anio: null,
        topMode: null,
      });

      return {
        reply:
          '¿Qué deseas consultar?\n' +
          '1) Una categoría específica\n' +
          '2) Ver top categorías\n' +
          '3) Menú',
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 4 || t === 'menu') {
      await this.clearAllContexts(sesion);
      const menu = await this.getMenuPaso();

      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }
  }

  return {
    reply:
      '¿Qué deseas consultar de ventas?\n' +
      '1) Ventas por producto\n' +
      '2) Ventas por vendedor\n' +
      '3) Ventas por categoría\n' +
      '4) Menú',
    nextFlowId: pasoActual.id,
  };
}

private async handleVentasProductoFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  raw: string,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  const ctx = this.readVentasProductoCtx(sesion);

  if (ctx?.mode !== 'VENTAS_PRODUCTO_FLOW' || !ctx?.step || !ctx?.sku) {
    return {
      reply: 'No hay un flujo de ventas por producto activo.',
      nextFlowId: pasoActual.id,
    };
  }

  const t = normalizeGuidedOption(raw);

  if (ctx.step === 'ASK_PERIOD') {
    const now = new Date();
    const optionPeriodo = extractSimpleMenuOption(raw, 5);

    if (optionPeriodo === 1 || t === '1' || t === 'este mes') {
      return await this.runVentasProductoFlow(sesion, pasoActual, {
        ...ctx,
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
      });
    }

    if (optionPeriodo === 2 || t === '2' || t === 'mes pasado') {
      const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return await this.runVentasProductoFlow(sesion, pasoActual, {
        ...ctx,
        mes: ref.getMonth() + 1,
        anio: ref.getFullYear(),
      });
    }

    if (optionPeriodo === 3 || t === '3') {
      await this.writeVentasProductoCtx(sesion, {
        ...ctx,
        step: 'ASK_MONTH_YEAR',
      });

      return {
        reply: 'Escribe el mes y año. Ejemplo: enero 2026',
        nextFlowId: pasoActual.id,
      };
    }

    if (optionPeriodo === 4 || t === '4') {
      return {
        reply:
          'Para ventas por producto solo está habilitado mes y año por ahora.\n' +
          'Escribe:\n' +
          '1) Este mes\n' +
          '2) Mes pasado\n' +
          '3) Escribir mes y año\n' +
          '5) Menú',
        nextFlowId: pasoActual.id,
      };
    }

    if (optionPeriodo === 5 || t === '5' || t === 'menu' || t === 'menú') {
      await this.clearAllContexts(sesion);
      const menu = await this.getMenuPaso();
      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

    return {
      reply:
        'Estoy esperando una opción válida:\n\n' +
        '1) Este mes\n' +
        '2) Mes pasado\n' +
        '3) Escribir mes y año\n' +
        '4) Escribir rango de fechas\n' +
        '5) Menú',
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx.step === 'ASK_MONTH_YEAR') {
    const parsed = parseMesAnioFromText(raw);

    if (!parsed.mes || !parsed.anio) {
      return {
        reply: 'No pude identificar el mes y año. Ejemplo: enero 2026',
        nextFlowId: pasoActual.id,
      };
    }

    return await this.runVentasProductoFlow(sesion, pasoActual, {
      ...ctx,
      mes: parsed.mes,
      anio: parsed.anio,
    });
  }

  return {
    reply: 'No pude continuar el flujo de ventas por producto.',
    nextFlowId: pasoActual.id,
  };
}

private async runVentasProductoFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  ctx: VentasProductoCtx,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  await this.writeVentasProductoCtx(sesion, {});

  const row = await this.salesService.getVentaNetaProductoMesBySku({
    sku: ctx.sku!,
    mes: ctx.mes!,
    anio: ctx.anio!,
  });

  const nombreMes = getNombreMes(ctx.mes!);

  if (!row) {
    return {
      reply: `No encontré ventas para ${ctx.nombre ?? ctx.sku} en ${nombreMes} ${ctx.anio}.`,
      nextFlowId: pasoActual.id,
    };
  }

  const venta = formatLps(row.VentaNeta);
  const nombreProd = (row.NombreProducto ?? ctx.nombre ?? ctx.sku).toString().trim();

  await this.writeFollowUpCtx(sesion, {
    mode: 'FOLLOW_UP',
    source: 'VENTAS',
    sku: ctx.sku!,
    nombre: nombreProd,
    mes: ctx.mes!,
    anio: ctx.anio!,
  });

  return {
    reply:
      `Venta del mes (Producto)\n` +
      `Producto: ${nombreProd}\n` +
      `SKU: ${ctx.sku}\n` +
      `Período: ${nombreMes} ${ctx.anio}\n\n` +
      `Venta neta: ${venta}`,
    followUp: buildNextActionMenu('VENTAS'),
    nextFlowId: pasoActual.id,
  };
}

  private async handleVentasCategoriaFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  raw: string,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  const ctx = this.readVentasCategoriaCtx(sesion);

  if (ctx?.mode !== 'VENTAS_CATEGORIA_FLOW' || !ctx?.step) {
    return {
      reply: 'No hay un flujo de ventas por categoría activo.',
      nextFlowId: pasoActual.id,
    };
  }

  const t = normalizeGuidedOption(raw);

  if (ctx.step === 'ASK_OPTION') {
    if (t === '1') {
      await this.writeVentasCategoriaCtx(sesion, {
        ...ctx,
        step: 'ASK_CATEGORY',
        topMode: false,
      });

      return {
        reply: 'Dime la categoría.',
        nextFlowId: pasoActual.id,
      };
    }

    if (t === '2') {
      await this.writeVentasCategoriaCtx(sesion, {
        ...ctx,
        step: 'ASK_PERIOD',
        topMode: true,
      });

      return {
        reply: buildGuidedMenu('PERIODO'),
        nextFlowId: pasoActual.id,
      };
    }

    if (t === '3' || t === 'menu') {
      await this.clearAllContexts(sesion);
      const menu = await this.getMenuPaso();

      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

    return {
      reply:
        'Opción no válida.\n' +
        '1) Una categoría específica\n' +
        '2) Ver top categorías\n' +
        '3) Menú',
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx.step === 'ASK_CATEGORY') {
    const categoria = cleanCategoriaTerm(raw);

    if (!categoria) {
      return {
        reply: 'Dime una categoría válida. Ejemplo: vinos, cervezas, ron.',
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeVentasCategoriaCtx(sesion, {
      ...ctx,
      categoria,
      step: 'ASK_PERIOD',
    });

    return {
      reply:
        `Necesito el período para consultar las ventas de ${categoria}.\n\n` +
        buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx.step === 'ASK_PERIOD') {
    const now = new Date();

    if (t === '1' || t === 'este mes') {
      return await this.runVentasCategoriaFlow(sesion, pasoActual, {
        ...ctx,
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
      });
    }

    if (t === '2' || t === 'mes pasado') {
      const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      return await this.runVentasCategoriaFlow(sesion, pasoActual, {
        ...ctx,
        mes: ref.getMonth() + 1,
        anio: ref.getFullYear(),
      });
    }

    if (t === '3') {
      await this.writeVentasCategoriaCtx(sesion, {
        ...ctx,
        step: 'ASK_MONTH_YEAR',
      });

      return {
        reply: 'Escribe el mes y año. Ejemplo: marzo 2026',
        nextFlowId: pasoActual.id,
      };
    }

    if (t === '4') {
      await this.writeVentasCategoriaCtx(sesion, {
        ...ctx,
        step: 'ASK_DATE_RANGE',
      });

      return {
        reply:
          'Escribe el rango con este formato:\n' +
          'Ejemplo: 2026-01-01 al 2026-03-31',
        nextFlowId: pasoActual.id,
      };
    }

    if (t === '5' || t === 'menu') {
      await this.clearAllContexts(sesion);
      const menu = await this.getMenuPaso();

      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

    return {
      reply: buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx.step === 'ASK_MONTH_YEAR') {
    const parsed = parseMesAnioFromText(raw);

    if (!parsed.mes || !parsed.anio) {
      return {
        reply: 'No pude identificar el mes y año. Ejemplo: marzo 2026',
        nextFlowId: pasoActual.id,
      };
    }

    return await this.runVentasCategoriaFlow(sesion, pasoActual, {
      ...ctx,
      mes: parsed.mes,
      anio: parsed.anio,
    });
  }

  if (ctx.step === 'ASK_DATE_RANGE') {
    const range = extractMonthRange(raw);

    if (!range) {
      return {
        reply:
          'No pude identificar el rango.\n' +
          'Ejemplo: enero a marzo 2026',
        nextFlowId: pasoActual.id,
      };
    }

    return await this.runVentasCategoriaFlow(sesion, pasoActual, {
      ...ctx,
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin,
      mes: null,
      anio: null,
    });
  }

  return {
    reply: 'No pude continuar el flujo de ventas por categoría.',
    nextFlowId: pasoActual.id,
  };
}

private async runVentasCategoriaFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  ctx: VentasCategoriaCtx,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  await this.writeVentasCategoriaCtx(sesion, ctx);

  if (ctx.topMode) {
    const rows = await this.salesService.getVentasCategorias({
      mes: ctx.mes ?? null,
      anio: ctx.anio ?? null,
      fechaInicio: ctx.fechaInicio ?? null,
      fechaFin: ctx.fechaFin ?? null,
    });

    await this.writeVentasCategoriaCtx(sesion, {});

    if (!rows?.length) {
      return {
        reply:
          `No encontré ventas por categoría en ${formatPeriodoTexto({
            mes: ctx.mes,
            anio: ctx.anio,
            fechaInicio: ctx.fechaInicio,
            fechaFin: ctx.fechaFin,
          })}.`,
        nextFlowId: pasoActual.id,
      };
    }

    const top = rows.slice(0, 10);
    const list = top
      .map(
        (r: any, i: number) =>
          `${i + 1}) ${r.Categoria} — ${formatLps(r.VentaNeta)}`,
      )
      .join('\n');

    return {
      reply:
        `Ventas por categoría\n` +
        `Período: ${formatPeriodoTexto({
          mes: ctx.mes,
          anio: ctx.anio,
          fechaInicio: ctx.fechaInicio,
          fechaFin: ctx.fechaFin,
        })}\n\n` +
        `${list}`,
      nextFlowId: pasoActual.id,
    };
  }

  const categoria = ctx.categoria ?? null;
  if (!categoria) {
    return {
      reply: 'No tengo una categoría seleccionada.',
      nextFlowId: pasoActual.id,
    };
  }

  const data = await this.salesService.getVentasPorCategoria({
    categoria,
    mes: ctx.mes ?? null,
    anio: ctx.anio ?? null,
    fechaInicio: ctx.fechaInicio ?? null,
    fechaFin: ctx.fechaFin ?? null,
  });

  if (!data) {
    const sugerencias = await this.salesService.buscarCategorias(categoria, 5);

    if (sugerencias?.length) {
      const opciones = sugerencias
        .map((x: any) => String(x.Categoria ?? '').trim())
        .filter(Boolean);

      await this.writeCategoriaAmbiguaCtx(sesion, {
        mode: 'CATEGORIA_AMBIGUA',
        step: 'ASK_OPTION',
        categoriaBuscada: categoria,
        opciones,
        mes: ctx.mes ?? null,
        anio: ctx.anio ?? null,
        fechaInicio: ctx.fechaInicio ?? null,
        fechaFin: ctx.fechaFin ?? null,
      });

      await this.writeVentasCategoriaCtx(sesion, {});

      const list = opciones
        .map((x: string, i: number) => `${i + 1}) ${x}`)
        .join('\n');

      return {
        reply:
          `No encontré ventas para la categoría "${categoria}" en ${formatPeriodoTexto({
            mes: ctx.mes,
            anio: ctx.anio,
            fechaInicio: ctx.fechaInicio,
            fechaFin: ctx.fechaFin,
          })}.\n\n` +
          `Quizá quisiste decir:\n${list}`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeVentasCategoriaCtx(sesion, {});

    return {
      reply:
        `No encontré ventas para la categoría "${categoria}" en ${formatPeriodoTexto({
          mes: ctx.mes,
          anio: ctx.anio,
          fechaInicio: ctx.fechaInicio,
          fechaFin: ctx.fechaFin,
        })}.`,
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeVentasCategoriaCtx(sesion, {});
  await this.writeFollowUpCtx(sesion, {
    mode: 'FOLLOW_UP',
    source: 'VENTAS_CATEGORIA',
    nombre: data.Categoria || categoria,
    mes: ctx.mes ?? null,
    anio: ctx.anio ?? null,
    fechaInicio: ctx.fechaInicio ?? null,
    fechaFin: ctx.fechaFin ?? null,
  });

  return {
    reply:
      `Ventas por categoría\n` +
      `Categoría: ${data.Categoria || categoria}\n` +
      `Período: ${formatPeriodoTexto({
        mes: ctx.mes,
        anio: ctx.anio,
        fechaInicio: ctx.fechaInicio,
        fechaFin: ctx.fechaFin,
      })}\n\n` +
      `Total vendido: ${formatLps(data.VentaNeta)}.`,
    followUp: buildNextActionMenu('VENTAS_CATEGORIA'),
    nextFlowId: pasoActual.id,
  };
}
  // ============================
  // FLUJO PROYECCIÓN
  // ============================
  private async handlePronosticoFlow(
    sesion: Sesion,
    pasoActual: MenuPaso,
    raw: string,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
    const ctx = this.readPronosticoCtx(sesion);

    if (ctx?.mode !== 'PRONOSTICO') {
      return {
        reply: 'No hay un flujo de proyección activo.',
        nextFlowId: pasoActual.id,
      };
    }
    
    const rawNorm = (raw ?? '')
  .toString()
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

if (ctx.step === 'ASK_OPTION') {
  if (rawNorm === '1') {
    await this.writePronosticoCtx(sesion, {
      ...ctx,
      step: 'ASK_PRODUCT',
      tipoConsulta: 'PRODUCTO',
    });

    return {
      reply: 'Dime el SKU o nombre del producto.',
      nextFlowId: pasoActual.id,
    };
  }

  if (rawNorm === '2') {
    await this.writePronosticoCtx(sesion, {
      ...ctx,
      step: 'ASK_VENDOR',
      tipoConsulta: 'VENDEDOR_PRODUCTO',
    });

    return {
      reply: 'Dime el código o nombre del vendedor.',
      nextFlowId: pasoActual.id,
    };
  }

  if (rawNorm === '3') {
    await this.writePronosticoCtx(sesion, {
      ...ctx,
      step: 'ASK_ZONE',
      tipoConsulta: 'ZONA_PRODUCTO',
    });

    return {
      reply: 'Dime la zona.',
      nextFlowId: pasoActual.id,
    };
  }

  if (rawNorm === '4' || rawNorm === 'menu') {
    await this.clearAllContexts(sesion);
    const menu = await this.getMenuPaso();
    return {
      reply: menu.respuestaBot ?? 'Menú Principal',
      nextFlowId: menu.id,
    };
  }

  return {
    reply:
      'Opción no válida.\n' +
      '1) Por producto\n' +
      '2) Por vendedor y producto\n' +
      '3) Por zona y producto\n' +
      '4) Menú principal',
    nextFlowId: pasoActual.id,
  };
}

if (ctx.step === 'ASK_VENDOR') {
  await this.writePronosticoCtx(sesion, {
    ...ctx,
    vendedor: extractVendorCode(raw) ?? ctx.vendedor ?? null,
    vendedorNombre: extractVendorCode(raw)
      ? null
      : raw.trim(),
    step: 'ASK_PRODUCT',
  });

  return {
    reply: 'Ahora dime el SKU o nombre del producto.',
    nextFlowId: pasoActual.id,
  };
}

if (ctx.step === 'ASK_ZONE') {
  await this.writePronosticoCtx(sesion, {
    ...ctx,
    zona: raw.trim(),
    step: ctx.tipoConsulta === 'ZONA_PRODUCTO' ? 'ASK_PRODUCT' : 'ASK_MONTH_YEAR',
  });

  return {
    reply:
      ctx.tipoConsulta === 'ZONA_PRODUCTO'
        ? 'Ahora dime el SKU o nombre del producto.'
        : 'Ahora dime el mes y año. Ejemplo: abril 2026',
    nextFlowId: pasoActual.id,
  };
}

if (ctx.step === 'ASK_PRODUCT') {
  const skuExtraido = (
  extractSku(raw) ??
  ''
)
  .trim()
  .toUpperCase();

const codigo =
  skuExtraido &&
  isAllowedSkuValue(skuExtraido) &&
  /\d/.test(skuExtraido)
    ? skuExtraido
    : null;

const termNombre = codigo ? null : raw.trim();

  if (isReservedForecastTerm(termNombre)) {
    return {
      reply:
        'Todavía estoy esperando el SKU o nombre del producto.\n' +
        'Ejemplo: PT001004009 o Catrachito 250ml.\n' +
        'También puedes escribir "menu" para salir.',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writePronosticoCtx(sesion, {
  ...ctx,
  codigoS4: codigo,
  termNombre: codigo ? null : raw.trim(),
  step: 'ASK_MONTH_YEAR',
});

  return {
    reply: 'Ahora dime el mes y año. Ejemplo: abril 2026',
    nextFlowId: pasoActual.id,
  };
}

if (ctx.step === 'ASK_MONTH_YEAR') {
  const parsed = parseMesAnioFromText(raw);
  const mesFinalPaso = ctx.mes ?? parsed.mes;
  const anioFinalPaso = ctx.anio ?? parsed.anio;

  if (!mesFinalPaso || !anioFinalPaso) {
    return {
      reply:
        'No pude identificar el mes y año.\n' +
        'Escríbelo así: abril 2026',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writePronosticoCtx(sesion, {
    ...ctx,
    mes: mesFinalPaso,
    anio: anioFinalPaso,
  });
}

    const parsed = parseMesAnioFromText(raw);
    const mesFinal = ctx.mes ?? parsed.mes;
    const anioFinal = ctx.anio ?? parsed.anio;
    const zona = extractZona(raw) ?? ctx.zona ?? null;

    const vendedorCodigoDetectado =
  (ctx.step === 'ASK_MONTH_YEAR' ? null : extractVendorCode(raw)) ??
  ctx.vendedor ??
  null;

const vendedorNombreDetectado =
  (ctx.step === 'ASK_MONTH_YEAR'
    ? null
    : extractVendedorNombreProyeccion(raw)) ??
  ctx.vendedorNombre ??
  null;
    let vendedorFinal: string | null = vendedorCodigoDetectado;

    if (!vendedorFinal && vendedorNombreDetectado) {
      const vendedores = await this.salesService.findVendedores(
        vendedorNombreDetectado,
        5,
      );

      if (vendedores.length === 1) {
        vendedorFinal = vendedores[0].SLPRSNID;
      } else if (vendedores.length > 1) {
        await this.writeVendedorAmbiguoCtx(sesion, {
          mode: 'VENDEDOR_AMBIGUO',
          step: 'ASK_VENDOR',
          vendedorTerm: vendedorNombreDetectado,
          productoTerm: ctx.termNombre ?? null,
          sku:
            ctx.codigoS4 && isAllowedSkuValue(ctx.codigoS4)
              ? ctx.codigoS4
              : null,
          mes: mesFinal,
          anio: anioFinal,
          zona: zona ?? null,
          items: vendedores.map((v: any) => ({
            codigo: String(v.SLPRSNID ?? '').trim(),
            nombre: String(v.Nombre ?? '').trim(),
          })),
        });

        const list = vendedores
          .map((v: any, i: number) => `${i + 1}) ${v.Nombre} (${v.SLPRSNID})`)
          .join('\n');

        return {
          reply:
            `Encontré varios vendedores parecidos a "${vendedorNombreDetectado}":\n\n` +
            `${list}\n\n` +
            `Escribe el número o el código exacto del vendedor.`,
          nextFlowId: pasoActual.id,
        };
      }
    }

    const codigoDetectado = (
  ctx.codigoS4 ??
  (ctx.step === 'ASK_MONTH_YEAR' ? '' : extractCodigoS4(raw)) ??
  (ctx.step === 'ASK_MONTH_YEAR' ? '' : extractSku(raw)) ??
  ''
)
  .trim()
  .toUpperCase();

    let codigo: string | null = isAllowedSkuValue(codigoDetectado)
      ? codigoDetectado
      : null;
    let nombreProducto = '';

    if (!codigo && !ctx.termNombre) {
    return {
    reply:
      'Aún estoy esperando el SKU o nombre del producto.\n' +
      'Ejemplo: PT001004009 o Catrachito 250ml.\n' +
      'También puedes escribir "menu" para salir.',
    nextFlowId: pasoActual.id,
    };
    }

    if (codigo) {
      const prodRaw = await this.inventoryService.findStockByCodeOrName(codigo);
      const prod =
        !Array.isArray(prodRaw) && isAllowedSkuValue(prodRaw?.CodigoS4)
          ? prodRaw
          : null;

      if (prod?.CodigoS4) {
        codigo = prod.CodigoS4;
        nombreProducto = prod.Nombre ?? codigo;
      } else {
        nombreProducto = codigo;
      }
    } else {
      const termProducto = (ctx.termNombre ?? '').trim();

if (isReservedForecastTerm(termProducto)) {
  await this.writePronosticoCtx(sesion, {
    ...ctx,
    termNombre: null,
    codigoS4: null,
    step: 'ASK_PRODUCT',
  });

  return {
    reply:
      'Necesito el SKU o nombre real del producto para consultar la proyección.\n' +
      'Ejemplo: PT001004009 o Catrachito 250ml.',
    nextFlowId: pasoActual.id,
  };
}

      if (termProducto) {
        const prodRaw =
          await this.inventoryService.findStockByCodeOrName(termProducto);

        const prod = Array.isArray(prodRaw)
          ? filterItemsWithValidSku(prodRaw)
          : prodRaw && isAllowedSkuValue(prodRaw?.CodigoS4)
            ? prodRaw
            : null;

        if (!prod) {
          await this.writePronosticoCtx(sesion, {
            ...ctx,
            mes: mesFinal,
            anio: anioFinal,
            zona,
            vendedor: vendedorFinal,
          });

          return {
            reply:
              `No encontré el producto "${termProducto}".\n` +
              `Escribe un SKU válido o un nombre más específico.`,
            nextFlowId: pasoActual.id,
          };
        }

        if (Array.isArray(prod)) {
  if (prod.length === 1) {
    codigo = prod[0].CodigoS4;
    nombreProducto = prod[0].Nombre ?? prod[0].CodigoS4;
  } else {
    const opciones = prod.slice(0, 5);

    await this.writePronosticoCtx(sesion, {
      ...ctx,
      mes: mesFinal,
      anio: anioFinal,
      zona,
      vendedor: vendedorFinal,
      vendedorNombre: vendedorNombreDetectado,
      termNombre: termProducto,
      codigoS4: null,
      step: 'ASK_MONTH_YEAR',
    });

    await this.writeProductoLookupCtx(sesion, {
      mode: 'PRODUCTO_LOOKUP',
      step: 'ASK_SELECT',
      source: 'PROYECCION',
      term: termProducto,
      items: opciones.map((p: any) => ({
        sku: String(p.CodigoS4 ?? '').trim(),
        nombre: String(p.Nombre ?? '').trim(),
      })),
    });

    const list = opciones
      .map((p: any, i: number) => `${i + 1}) ${p.Nombre} (SKU: ${p.CodigoS4})`)
      .join('\n');

    return {
      reply:
        `Encontré varios productos parecidos a "${termProducto}":\n\n` +
        `${list}\n\n` +
        `Escribe el número de la opción o el SKU exacto.`,
      nextFlowId: pasoActual.id,
    };
  }
}else {
          codigo = prod.CodigoS4 ?? null;
          nombreProducto = prod.Nombre ?? prod.CodigoS4 ?? '';
        }
      }
    }

    const row = await this.inventoryService.findProyeccionGeneral({
      sku: codigo ?? null,
      zona: zona ?? null,
      vendedor: vendedorFinal ?? null,
      mes: mesFinal,
      anio: anioFinal,
    });

    await this.writePronosticoCtx(sesion, {});

    if (!mesFinal || !anioFinal) {
  return {
    reply:
      'Necesito el mes y año de la proyección.\n' +
      'Ejemplo: abril 2026',
    nextFlowId: pasoActual.id,
  };
}
    const fecha = `${capitalize(getNombreMes(mesFinal))} ${anioFinal}`;

    if (!row || Number(row.cajasRedondeadas ?? 0) <= 0) {
      const filtros: string[] = [];

      if (vendedorFinal) filtros.push(`vendedor ${vendedorFinal}`);
      if (zona) filtros.push(`zona ${zona}`);
      if (codigo) filtros.push(`producto ${nombreProducto || codigo}`);

      const detalle = filtros.length ? ` para ${filtros.join(', ')} ` : ' ';

      return {
        reply: `No encontré proyección${detalle}en ${fecha}.`,
        nextFlowId: pasoActual.id,
      };
    }

    const titulo = codigo
  ? '📈 Proyección de venta'
  : '📈 Proyección general de venta';

let vendedorTexto = '';

if (vendedorFinal) {
  const vend = await this.salesService.findVendedores(vendedorFinal, 1);
  const nombreVendedor =
    vend?.length && String(vend[0].Nombre ?? '').trim()
      ? String(vend[0].Nombre).trim()
      : '';

  vendedorTexto = nombreVendedor
    ? `${nombreVendedor} (${vendedorFinal})`
    : vendedorFinal;
}

let reply = `${titulo}\n`;
reply += `Periodo: ${fecha}\n`;

if (vendedorTexto) reply += `Vendedor: ${vendedorTexto}\n`;
if (zona) reply += `Zona: ${zona}\n`;
if (codigo) {
  reply += `Producto: ${nombreProducto || codigo}\n`;
  reply += `SKU: ${codigo}\n`;
}

reply += `\nCajas a vender: ${row.cajasRedondeadas}`;

    if (codigo) {
      await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'PROYECCION',
        sku: codigo,
        nombre: nombreProducto || codigo,
        mes: mesFinal,
        anio: anioFinal,
      });
    }

    return {
      reply,
      followUp: codigo ? buildNextActionMenu('PROYECCION') : undefined,
      nextFlowId: pasoActual.id,
    };
  }

  // ============================
  // FLUJO PRODUCTO AMBIGUO
  // ============================
  private async handleProductoAmbiguoFlow(
    sesion: Sesion,
    pasoActual: MenuPaso,
    raw: string,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
    const ctx = this.readProductoAmbiguoCtx(sesion);

    if (
      ctx?.mode !== 'PRODUCTO_AMBIGUO' ||
      ctx?.step !== 'ASK_ACTION' ||
      !ctx?.sku
    ) {
      return {
        reply: 'No hay un producto pendiente por consultar.',
        nextFlowId: pasoActual.id,
      };
    }

    const t = (raw ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const option = extractProductoAmbiguoOption(t);

    const clearAndReturn = async (reply: string, followUp?: string) => {
      await this.writeProductoAmbiguoCtx(sesion, {});
      return { reply, followUp, nextFlowId: pasoActual.id };
    };

    if (option === 1 || ['stock', 'existencia'].includes(t)) {
      if (!isAllowedSkuValue(ctx.sku)) {
        return await clearAndReturn(
          'El SKU del producto pendiente no es válido. Solo se permiten SKU que empiecen con letra.',
        );
      }

      const detail = await this.inventoryService.findStockDetalleByCodigoS4(
        ctx.sku,
      );

      if (!detail) {
        return await clearAndReturn(
          `No encontré stock para ${ctx.nombre ?? ctx.sku}.`,
        );
      }

      await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'STOCK',
        sku: ctx.sku,
        nombre: ctx.nombre ?? detail?.Nombre ?? ctx.sku,
      });

      return await clearAndReturn(
        formatStockDetailWithProductName(
          detail,
          ctx.nombre ?? detail?.Nombre ?? '',
        ),
        buildNextActionMenu('STOCK'),
      );
    }

    if (option === 2 || ['ventas', 'venta'].includes(t)) {
  await this.writeProductoAmbiguoCtx(sesion, {});
  const { mes, anio } = parseMesAnioFromText(raw);
  const now = new Date();
  const mesSeguro = mes ?? now.getMonth() + 1;
  const anioSeguro = anio ?? now.getFullYear();
  const nombreMes = getNombreMes(mesSeguro);

  if (!isAllowedSkuValue(ctx.sku)) {
    return {
      reply:
        'El SKU del producto pendiente no es válido. Solo se permiten SKU que empiecen con letra.',
      nextFlowId: pasoActual.id,
    };
  }

  const row = await this.salesService.getVentaNetaProductoMesBySku({
    sku: ctx.sku,
    mes: mesSeguro,
    anio: anioSeguro,
  });

  if (!row) {
    return {
      reply: `No encontré ventas para ${ctx.nombre ?? ctx.sku} en ${nombreMes} ${anioSeguro}.`,
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeFollowUpCtx(sesion, {
    mode: 'FOLLOW_UP',
    source: 'VENTAS',
    sku: ctx.sku,
    nombre: row.NombreProducto ?? ctx.nombre ?? ctx.sku,
    mes: mesSeguro,
    anio: anioSeguro,
  });

      const venta = formatLps(row.VentaNeta);
      return {
        reply:
          `Venta del mes (Producto)\n` +
          `Producto: ${row.NombreProducto ?? ctx.nombre ?? ''}\n` +
          `SKU: ${ctx.sku}\n` +
          `Venta neta: ${venta}`,
        followUp: buildNextActionMenu('VENTAS'),
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 3 || ['pronostico', 'proyeccion', 'proyección'].includes(t)) {
  await this.writeProductoAmbiguoCtx(sesion, {});
  const { mes, anio } = parseMesAnioFromText(raw);
  const now = new Date();
  const mesSeguro = mes ?? now.getMonth() + 1;
  const anioSeguro = anio ?? now.getFullYear();
  const fecha = `${capitalize(getNombreMes(mesSeguro))} ${anioSeguro}`;

  if (!isAllowedSkuValue(ctx.sku)) {
    return {
      reply:
        'El SKU del producto pendiente no es válido. Solo se permiten SKU que empiecen con letra.',
      nextFlowId: pasoActual.id,
    };
  }

  const row = await this.inventoryService.findProyeccionGeneral({
    sku: ctx.sku,
    mes: mesSeguro,
    anio: anioSeguro,
  });

      if (!row || Number(row.cajasRedondeadas ?? 0) <= 0) {
        return {
          reply: `No encontré proyección para ${ctx.nombre ?? ctx.sku} en ${fecha}.`,
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'PROYECCION',
      sku: ctx.sku,
      nombre: ctx.nombre ?? ctx.sku,
      mes: mesSeguro,
      anio: anioSeguro,
      });

      const cajas = Number(row.cajasRedondeadas ?? 0);
      const unidades = Number(row.unidadesRedondeadas ?? 0);

      return {
        reply:
          `📈 Proyección de venta\n` +
          `Periodo: ${fecha}\n` +
          `Producto: ${ctx.nombre ?? ''}\n` +
          `SKU: ${ctx.sku}\n\n` +
          `Cajas a vender: ${cajas.toLocaleString('es-HN')}\n` +
          `Unidades a vender: ${unidades.toLocaleString('es-HN')}`,
        followUp: buildNextActionMenu('PROYECCION'),
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 4 || ['sku', 'codigo', 'código'].includes(t)) {
      return await clearAndReturn(
        `Producto: ${ctx.nombre ?? '(Sin nombre)'}\nSKU: ${ctx.sku}`,
      );
    }

    return {
      reply:
        `Estoy esperando una opción válida para ${ctx.nombre ?? 'este producto'}:\n\n` +
        `1) Stock\n` +
        `2) Ventas\n` +
        `3) Proyección\n` +
        `4) SKU\n\n` +
        `También puedes escribir "menu" para salir.`,
      nextFlowId: pasoActual.id,
    };
  }

  // ============================
  // FLUJO LOOKUPFLOW
  // ============================

private async handleProductoLookupFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  raw: string,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  const ctx = this.readProductoLookupCtx(sesion);

  if (
    ctx?.mode !== 'PRODUCTO_LOOKUP' ||
    ctx?.step !== 'ASK_SELECT' ||
    !ctx?.items?.length
  ) {
    return {
      reply: 'No hay un producto pendiente por seleccionar.',
      nextFlowId: pasoActual.id,
    };
  }

const t = normalizeGuidedOption(raw);

if (t === 'menu' || t === 'menú') {
  await this.clearAllContexts(sesion);
  const menu = await this.getMenuPaso();

  return {
    reply: menu.respuestaBot ?? 'Menú Principal',
    nextFlowId: menu.id,
  };
}

if (t === 'ventas' || t === 'venta' || t === 'ver ventas') {
  await this.clearAllContexts(sesion);
  await this.writeVentasMenuCtx(sesion, {
    mode: 'VENTAS_MENU',
    step: 'ASK_OPTION',
  });

  return {
    reply:
      '¿Qué deseas consultar de ventas?\n' +
      '1) Ventas por producto\n' +
      '2) Ventas por vendedor\n' +
      '3) Ventas por categoría\n' +
      '4) Menú',
    nextFlowId: pasoActual.id,
  };
}

if (isNextPage(raw)) {
  const pageSize = ctx.pageSize ?? 5;
  const currentPage = ctx.page ?? 0;
  const nextPage = currentPage + 1;
  const total = ctx.total ?? ctx.items.length;
  const startIndex = nextPage * pageSize;
  const pageItems = ctx.items.slice(startIndex, startIndex + pageSize);

  if (!pageItems.length) {
    return {
      reply: 'No hay más resultados. Escribe el número de una opción mostrada, el SKU exacto o "menu" para salir.',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeProductoLookupCtx(sesion, {
    ...ctx,
    page: nextPage,
    pageSize,
    total,
  });

  const list = pageItems
    .map(
      (x, i) =>
        `${startIndex + i + 1}) ${x.nombre} (SKU: ${x.sku})`,
    )
    .join('\n');

  const shownEnd = startIndex + pageItems.length;
  const hasMore = shownEnd < total;

  return {
    reply:
      `Más resultados (${startIndex + 1}-${shownEnd} de ${total})` +
      `${ctx.term ? ` para "${ctx.term}"` : ''}:\n\n` +
      `${list}\n\n` +
      (hasMore
        ? `Escribe el número de la opción, el SKU exacto o "siguientes" para ver más.`
        : `No hay más resultados. Escribe el número de la opción o el SKU exacto.`),
    nextFlowId: pasoActual.id,
  };
}

  const rawSku = (extractSku(raw) ?? extractCodigoS4(raw) ?? '')
    .trim()
    .toUpperCase();

  let selected: ProductoLookupItem | undefined;

  if (rawSku) {
    selected = ctx.items.find(
      (x) => String(x.sku ?? '').trim().toUpperCase() === rawSku,
    );

    if (!selected) {
      return {
        reply: `El SKU ${rawSku} no corresponde a ninguna de las opciones mostradas.`,
        nextFlowId: pasoActual.id,
      };
    }
  } else {
    const option = extractSimpleMenuOption(raw, ctx.items.length);

    if (!option) {
      const pageSize = ctx.pageSize ?? 5;
      const currentPage = ctx.page ?? 0;
      const total = ctx.total ?? ctx.items.length;
      const startIndex = currentPage * pageSize;
      const pageItems = ctx.items.slice(startIndex, startIndex + pageSize);
      const list = pageItems
        .map((x, i) => `${startIndex + i + 1}) ${x.nombre} (SKU: ${x.sku})`)
        .join('\n');

      return {
        reply:
          `Estoy esperando el número de una opción válida.\n\n` +
          `${list}\n\n` +
          (startIndex + pageItems.length < total
            ? `También puedes escribir el SKU exacto, "siguientes" o "menu" para salir.`
            : `También puedes escribir el SKU exacto o "menu" para salir.`),
        nextFlowId: pasoActual.id,
      };
    }

    selected = ctx.items[option - 1];
  }

  if (!selected || !isAllowedSkuValue(selected.sku)) {
    return {
      reply: 'No encontré una opción válida.',
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeProductoLookupCtx(sesion, {});

  if (ctx.source === 'STOCK') {
    const detail = await this.inventoryService.findStockDetalleByCodigoS4(
      selected.sku,
    );

    if (!detail) {
      return {
        reply:
          `Encontré el producto seleccionado:\n` +
          `Producto: ${selected.nombre}\n` +
          `SKU: ${selected.sku}\n\n` +
          `Pero no encontré existencias para ese SKU.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'STOCK',
      sku: selected.sku,
      nombre: selected.nombre,
    });

    return {
      reply: formatStockDetailWithProductName(detail, selected.nombre),
      followUp: buildNextActionMenu('STOCK'),
      nextFlowId: pasoActual.id,
    };
  }

  if (!ctx.source) {
    const detail = await this.inventoryService.findStockDetalleByCodigoS4(
      selected.sku,
    );

    if (!detail) {
      return {
        reply:
          `Encontré el producto seleccionado:\n` +
          `Producto: ${selected.nombre}\n` +
          `SKU: ${selected.sku}\n\n` +
          `Pero no encontré existencias para ese SKU.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeFollowUpCtx(sesion, {
      mode: 'FOLLOW_UP',
      source: 'STOCK',
      sku: selected.sku,
      nombre: selected.nombre,
    });

    await this.writeNavigationCtx(sesion, {
      mode: 'NAVIGATION',
      source: 'STOCK',
      step: 'AWAITING_NEXT_ACTION',
      payload: {
        sku: selected.sku,
        nombre: selected.nombre,
      },
    });

    return {
      reply: formatStockDetailWithProductName(detail, selected.nombre),
      followUp: buildNextActionMenu('STOCK'),
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx.source === 'SKU') {
    return {
      reply:
        `Producto: ${selected.nombre}\n` +
        `SKU: ${selected.sku}`,
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx.source === 'PROYECCION') {
    const pronCtx = this.readPronosticoCtx(sesion);

    await this.writePronosticoCtx(sesion, {
      ...pronCtx,
      mode: 'PRONOSTICO',
      codigoS4: selected.sku,
      termNombre: selected.nombre,
      step: 'ASK_MONTH_YEAR',
    });

    return await this.handlePronosticoFlow(sesion, pasoActual, '');
  }

  if (ctx.source === 'VENTAS') {
    await this.writeVentasMenuCtx(sesion, {});
    await this.writeVentasProductoCtx(sesion, {
      mode: 'VENTAS_PRODUCTO_FLOW',
      step: 'ASK_PERIOD',
      sku: selected.sku,
      nombre: selected.nombre,
      mes: null,
      anio: null,
    });

    return {
      reply:
        `Producto seleccionado:\n` +
        `Producto: ${selected.nombre}\n` +
        `SKU: ${selected.sku}\n\n` +
        buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeProductoAmbiguoCtx(sesion, {
    mode: 'PRODUCTO_AMBIGUO',
    step: 'ASK_ACTION',
    sku: selected.sku,
    nombre: selected.nombre,
  });

  return {
    reply:
      `Encontré el producto:\n` +
      `Producto: ${selected.nombre}\n` +
      `SKU: ${selected.sku}\n\n` +
      `¿Qué deseas consultar?\n` +
      `1) Stock\n` +
      `2) Ventas\n` +
      `3) Proyección\n` +
      `4) SKU`,
    nextFlowId: pasoActual.id,
  };
}

  // ============================
  // FLUJO VENDEDOR AMBIGUO
  // ============================
  private async handleVendedorAmbiguoFlow(
    sesion: Sesion,
    pasoActual: MenuPaso,
    raw: string,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
    const vendCtx = this.readVendedorAmbiguoCtx(sesion);
    const t = (raw ?? '').toString().trim().toUpperCase();

    let vendedorSeleccionado: string | null = null;
    let nombreVendedorSeleccionado: string | null = null;

    if (/^\d+$/.test(t)) {
      const idx = Number(t);
      const item = vendCtx.items?.[idx - 1];
      if (item) {
        vendedorSeleccionado = item.codigo;
        nombreVendedorSeleccionado = item.nombre;
      }
    }

    if (!vendedorSeleccionado) {
      const exact = vendCtx.items?.find(
        (x) => String(x.codigo ?? '').trim().toUpperCase() === t,
      );
      if (exact) {
        vendedorSeleccionado = exact.codigo;
        nombreVendedorSeleccionado = exact.nombre;
      }
    }

    if (!vendedorSeleccionado) {
      const list = (vendCtx.items ?? [])
        .map((v, i) => `${i + 1}) ${v.nombre} (${v.codigo})`)
        .join('\n');

      return {
        reply:
          `Estoy esperando el número o el código exacto del vendedor.\n\n` +
          `${list}\n\n` +
          `Escribe una opción válida, o escribe "menu" para salir.`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeVendedorAmbiguoCtx(sesion, {});

    const mesFinal = vendCtx.mes ?? new Date().getMonth() + 1;
    const anioFinal = vendCtx.anio ?? new Date().getFullYear();

    if (vendCtx.productoTerm || (vendCtx.sku && isAllowedSkuValue(vendCtx.sku))) {
  let sku: string | null =
    vendCtx.sku && isAllowedSkuValue(vendCtx.sku) ? vendCtx.sku : null;

  let nombreProducto = vendCtx.productoTerm ?? vendCtx.sku ?? '';

  if (!sku && vendCtx.productoTerm) {
    if (looksLikeSku(vendCtx.productoTerm)) {
      const candidateSku = vendCtx.productoTerm.toUpperCase();
      if (isAllowedSkuValue(candidateSku)) {
        sku = candidateSku;
      }
    } else {
      const productos = filterItemsWithValidSku(
        await this.salesService.findProductosByNombre(vendCtx.productoTerm, 5),
      );

      if (!productos.length) {
        return {
          reply: `No encontré el producto "${vendCtx.productoTerm}".`,
          nextFlowId: pasoActual.id,
        };
      }

      if (productos.length === 1) {
        sku = productos[0].SKU;
        nombreProducto = productos[0].NombreProducto;
      } else {
        const list = productos
          .map(
            (p: any, i: number) =>
              `${i + 1}) ${p.NombreProducto} (SKU: ${p.SKU})`,
          )
          .join('\n');

        return {
          reply:
            `Encontré varios productos parecidos a "${vendCtx.productoTerm}":\n\n` +
            `${list}\n\n` +
            `Escribe nuevamente la consulta con el SKU exacto.`,
          nextFlowId: pasoActual.id,
        };
      }
    }
  }

  if (!sku || !isAllowedSkuValue(sku)) {
    return {
      reply:
        'No encontré un SKU válido para ese producto. Solo se permiten SKU que empiecen con letra.',
      nextFlowId: pasoActual.id,
    };
  }

  const data = await this.salesService.getProyeccionVendedorProducto({
    idVendedor: vendedorSeleccionado,
    sku,
  });

  if (!data) {
    return {
      reply:
        `No encontré proyección mensual para ${
          nombreVendedorSeleccionado ?? vendedorSeleccionado
        } del producto ${nombreProducto || sku}.`,
      nextFlowId: pasoActual.id,
    };
  }

  await this.writeFollowUpCtx(sesion, {
    mode: 'FOLLOW_UP',
    source: 'PROYECCION',
    sku,
    nombre: data.NombreProducto ?? nombreProducto ?? sku,
  });

  const nombreVendedorTexto =
    data.NombreVendedor ??
    nombreVendedorSeleccionado ??
    vendedorSeleccionado;

  return {
    reply:
      `📈 Proyección de venta\n` +
      `Vendedor: ${nombreVendedorTexto} (${vendedorSeleccionado})\n` +
      `Periodo: ${capitalize(getNombreMes(mesFinal))} ${anioFinal}\n` +
      `Producto: ${data.NombreProducto ?? nombreProducto ?? sku}\n` +
      `SKU: ${sku}\n\n` +
      `Cajas a vender: ${Number(data.TotalUnidades ?? 0).toLocaleString('es-HN')}`,
    followUp: buildNextActionMenu('PROYECCION'),
    nextFlowId: pasoActual.id,
  };
}

    const row = await this.inventoryService.findProyeccionGeneral({
      vendedor: vendedorSeleccionado,
      mes: mesFinal,
      anio: anioFinal,
      zona: vendCtx.zona ?? null,
      sku:
        vendCtx.sku && isAllowedSkuValue(vendCtx.sku)
          ? vendCtx.sku
          : null,
    });

    if (!mesFinal || !anioFinal) {
    return {
    reply:
      'Necesito el mes y año de la proyección.\n' +
      'Ejemplo: abril 2026',
    nextFlowId: pasoActual.id,
  };
}

  if (!mesFinal || !anioFinal) {
  return {
    reply:
      'Necesito el mes y año de la proyección.\n' +
      'Ejemplo: abril 2026',
    nextFlowId: pasoActual.id,
  };
  }

    const fecha = `${capitalize(getNombreMes(mesFinal))} ${anioFinal}`;

    if (!row || Number(row.cajasRedondeadas ?? 0) <= 0) {
      return {
        reply:
          `No encontré proyección para ${
            nombreVendedorSeleccionado ?? vendedorSeleccionado
          } en ${fecha}.`,
        nextFlowId: pasoActual.id,
      };
    }

    if (vendCtx.sku && isAllowedSkuValue(vendCtx.sku)) {
      await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'PROYECCION',
        sku: vendCtx.sku,
        nombre: vendCtx.productoTerm ?? vendCtx.sku,
        mes: mesFinal,
        anio: anioFinal,
      });
    }

    return {
      reply:
        `📈 Proyección de venta\n` +
        `Vendedor: ${nombreVendedorSeleccionado ?? vendedorSeleccionado} (${vendedorSeleccionado})\n` +
        `Periodo: ${fecha}\n\n` +
        `Cajas a vender: ${Number(row.cajasRedondeadas ?? 0).toLocaleString('es-HN')}`,
      followUp:
        vendCtx.sku && isAllowedSkuValue(vendCtx.sku)
          ? buildNextActionMenu('PROYECCION')
          : undefined,
      nextFlowId: pasoActual.id,
    };
  }

  private async handleCategoriaAmbiguaFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  raw: string,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  const ctx = this.readCategoriaAmbiguaCtx(sesion);

  if (
    ctx?.mode !== 'CATEGORIA_AMBIGUA' ||
    ctx?.step !== 'ASK_OPTION' ||
    !ctx?.opciones?.length
  ) {
    return {
      reply: 'No hay una categoría pendiente por seleccionar.',
      nextFlowId: pasoActual.id,
    };
  }

  const option = extractSimpleMenuOption(raw, ctx.opciones.length);
  if (!option) {
    const list = ctx.opciones
      .map((x, i) => `${i + 1}) ${x}`)
      .join('\n');

    return {
      reply:
        `Estoy esperando el número de la categoría.\n\n` +
        `${list}\n\n` +
        `Escribe una opción válida o "menu" para salir.`,
      nextFlowId: pasoActual.id,
    };
  }

  const categoriaSeleccionada = ctx.opciones[option - 1];
  await this.writeCategoriaAmbiguaCtx(sesion, {});

  const data = await this.salesService.getVentasPorCategoria({
    categoria: categoriaSeleccionada,
    mes: ctx.mes ?? null,
    anio: ctx.anio ?? null,
    fechaInicio: ctx.fechaInicio ?? null,
    fechaFin: ctx.fechaFin ?? null,
  });

  if (!data) {
    return {
      reply:
        `No encontré ventas para la categoría "${categoriaSeleccionada}" en ${formatPeriodoTexto({
          mes: ctx.mes,
          anio: ctx.anio,
          fechaInicio: ctx.fechaInicio,
          fechaFin: ctx.fechaFin,
        })}.`,
      nextFlowId: pasoActual.id,
    };
  }

  const venta = formatLps(data.VentaNeta);

  await this.writeFollowUpCtx(sesion, {
    mode: 'FOLLOW_UP',
    source: 'VENTAS_CATEGORIA',
    nombre: data.Categoria || categoriaSeleccionada,
    mes: ctx.mes ?? null,
    anio: ctx.anio ?? null,
    fechaInicio: ctx.fechaInicio ?? null,
    fechaFin: ctx.fechaFin ?? null,
  });

  return {
    reply:
      `Ventas por categoría\n` +
      `Categoría: ${data.Categoria || categoriaSeleccionada}\n` +
      `Período: ${formatPeriodoTexto({
        mes: ctx.mes,
        anio: ctx.anio,
        fechaInicio: ctx.fechaInicio,
        fechaFin: ctx.fechaFin,
      })}\n\n` +
      `Total vendido: ${venta}.`,
    followUp: buildNextActionMenu('VENTAS'),
    nextFlowId: pasoActual.id,
  };
}

  private async handleNotasCreditoFlow(
  sesion: Sesion,
  pasoActual: MenuPaso,
  raw: string,
): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
  const ctx = this.readNotasCreditoCtx(sesion);

  const t = (raw ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (ctx?.mode === 'NOTAS_CREDITO_MENU' && ctx.step === 'ASK_OPTION') {
    const option = extractSimpleMenuOption(raw, 3);

    if (option === 1) {
      const page = 1;
      const pageSize = 10;
      const result = await this.notasCreditoService.getClientesConNotasCredito(
        page,
        pageSize,
      );

      if (!result?.data?.length) {
        await this.writeNotasCreditoCtx(sesion, {});
        return {
          reply: 'No encontré clientes con notas de crédito.',
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeNotasCreditoCtx(sesion, {
        mode: 'CLIENTES',
        step: undefined,
        term: null,
        clienteNombre: null,
        page,
        pageSize,
        total: result.total ?? 0,
      });

      return {
        reply: this.formatClientesNotasCredito(result),
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 2) {
      await this.writeNotasCreditoCtx(sesion, {
        mode: 'DETALLE_CLIENTE',
        step: 'ASK_CLIENTE',
        term: null,
        clienteNombre: null,
        page: 1,
        pageSize: 10,
        total: 0,
      });

      return {
        reply: 'Escribe el nombre o código del cliente.',
        nextFlowId: pasoActual.id,
      };
    }

    if (option === 3 || t === 'menu') {
      await this.clearAllContexts(sesion);
      const menu = await this.getMenuPaso();

      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

    return {
      reply:
        'Opción no válida.\n' +
        '1) Ver clientes con notas de crédito\n' +
        '2) Buscar notas de un cliente\n' +
        '3) Menú',
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx?.mode === 'DETALLE_CLIENTE' && ctx.step === 'ASK_CLIENTE') {
    const cliente = raw
      .trim()
      .replace(/^\s*(de|del|la|el)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cliente) {
      return {
        reply: 'Escribe el nombre o código del cliente.',
        nextFlowId: pasoActual.id,
      };
    }

    const rows = await this.notasCreditoService.getNotasPorCliente(cliente);

    await this.writeNotasCreditoCtx(sesion, {
      mode: 'DETALLE_CLIENTE',
      step: undefined,
      term: cliente,
      clienteNombre: cliente,
      page: 1,
      pageSize: 10,
      total: rows.length ?? 0,
    });

    return {
      reply: this.formatNotasCreditoClientePage(rows, cliente, 1, 10),
      nextFlowId: pasoActual.id,
    };
  }

  if (ctx?.mode === 'CLIENTES' || ctx?.mode === 'DETALLE_CLIENTE') {
    if (isNextPage(raw)) {
      const paginated = await this.handleContextPagination(sesion, pasoActual);
      if (paginated) return paginated;
    }
  }

  await this.writeNotasCreditoCtx(sesion, {});
  return {
    reply:
      'Se reinició el flujo de notas de crédito.\n' +
      'Escribe "notas de credito" para comenzar de nuevo.',
    nextFlowId: pasoActual.id,
  };
}
  // ============================
  // FLUJO FOLLOW UP
  // ============================
  private async handleFollowUpFlow(
    sesion: Sesion,
    pasoActual: MenuPaso,
    raw: string,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number }> {
    const ctx = this.readFollowUpCtx(sesion);

  if (ctx?.mode !== 'FOLLOW_UP' || !ctx?.source) {
  return {
    reply: 'No hay una acción pendiente.',
    nextFlowId: pasoActual.id,
  };
}

if (ctx.source !== 'VENTAS_CATEGORIA' && !ctx?.sku) {
  return {
    reply: 'No hay una acción pendiente.',
    nextFlowId: pasoActual.id,
  };
}

    const normalized = (raw ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const option = extractSimpleMenuOption(normalized, 4);

    if (!option) {
      return {
        reply:
          `Estoy esperando una opción válida:\n` +
          buildNextActionMenu(ctx.source),
        nextFlowId: pasoActual.id,
      };
    }

    if (ctx.source === 'STOCK') {
    const sku = ctx.sku!;
      if (option === 1) {
        const now = new Date();
        const mesSeguro = ctx.mes ?? now.getMonth() + 1;
        const anioSeguro = ctx.anio ?? now.getFullYear();

const row = await this.salesService.getVentaNetaProductoMesBySku({
  sku,
  mes: mesSeguro,
  anio: anioSeguro,
});

if (!row) {
  return {
    reply: `No encontré ventas para ${ctx.nombre ?? sku} en ${getNombreMes(mesSeguro)} ${anioSeguro}.`,
    nextFlowId: pasoActual.id,
  };
}

        await this.writeFollowUpCtx(sesion, {
          mode: 'FOLLOW_UP',
          source: 'VENTAS',
          sku,
          nombre: row.NombreProducto ?? ctx.nombre ?? sku,
          mes: mesSeguro,
          anio: anioSeguro,
        });

        return {
          reply:
            `Venta del mes (Producto)\n` +
            `Producto: ${row.NombreProducto ?? ctx.nombre ?? ''}\n` +
            `SKU: ${sku}\n` +
            `Venta neta: ${formatLps(row.VentaNeta)}`,
          followUp: buildNextActionMenu('VENTAS'),
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 2) {
        await this.writeFollowUpCtx(sesion, {});
        await this.writePronosticoCtx(sesion, {
          mode: 'PRONOSTICO',
          step: 'ASK_ZONE',
          codigoS4: sku,
          termNombre: ctx.nombre ?? null,
          mes: null,
          anio: null,
          zona: null,
          vendedor: null,
          vendedorNombre: null,
        });

        return await this.handlePronosticoFlow(sesion, pasoActual, sku);
      }

      if (option === 3) {
        await this.writeFollowUpCtx(sesion, {});
        await this.writeNavigationCtx(sesion, {
          mode: 'NAVIGATION',
          source: 'STOCK',
          step: 'AWAITING_PRODUCT',
          payload: null,
        });
        return {
          reply: 'Indícame el SKU o nombre del producto que deseas buscar.',
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 4) {
        await this.clearAllContexts(sesion);
        const menu = await this.getMenuPaso();
        return {
          reply: menu.respuestaBot ?? 'Menú Principal',
          nextFlowId: menu.id,
        };
      }
    }

    if (ctx.source === 'VENTAS') {
      const sku = ctx.sku!;
      if (option === 1) {
        const detail = await this.inventoryService.findStockDetalleByCodigoS4(sku);

        if (!detail) {
          return {
            reply: `No encontré stock para ${ctx.nombre ?? sku}.`,
            nextFlowId: pasoActual.id,
          };
        }

        await this.writeFollowUpCtx(sesion, {
          mode: 'FOLLOW_UP',
          source: 'STOCK',
          sku,
          nombre: ctx.nombre ?? detail?.Nombre ?? sku,
        });

        return {
          reply: formatStockDetailWithProductName(
            detail,
            ctx.nombre ?? detail?.Nombre ?? sku,
          ),
          followUp: buildNextActionMenu('STOCK'),
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 2) {
        await this.writeFollowUpCtx(sesion, {});
        await this.writePronosticoCtx(sesion, {
          mode: 'PRONOSTICO',
          step: 'ASK_ZONE',
          codigoS4: sku,
          termNombre: ctx.nombre ?? null,
          mes: ctx.mes ?? null,
          anio: ctx.anio ?? null,
          zona: null,
          vendedor: null,
          vendedorNombre: null,
        });

        return await this.handlePronosticoFlow(sesion, pasoActual, sku);
      }

      if (option === 3) {
        await this.writeFollowUpCtx(sesion, {});
        await this.writeVentasProductoCtx(sesion, {});
        await this.writeVentasMenuCtx(sesion, {
          mode: 'VENTAS_MENU',
          step: 'ASK_PRODUCT',
        });
        return {
          reply: 'Indícame el SKU o nombre del producto que deseas buscar.',
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 4) {
        await this.clearAllContexts(sesion);
        const menu = await this.getMenuPaso();
        return {
          reply: menu.respuestaBot ?? 'Menú Principal',
          nextFlowId: menu.id,
        };
      }
    }

    if (ctx.source === 'PROYECCION') {
      const sku = ctx.sku!;
      if (option === 1) {
        await this.writeFollowUpCtx(sesion, {});
        await this.writePronosticoCtx(sesion, {
          mode: 'PRONOSTICO',
          step: 'ASK_ZONE',
          codigoS4: sku,
          termNombre: ctx.nombre ?? null,
          mes: ctx.mes ?? null,
          anio: ctx.anio ?? null,
          zona: null,
          vendedor: null,
          vendedorNombre: null,
        });

        return {
          reply:
            'Indica la zona para consultar la proyección de este producto.\n' +
            'Opciones: TGU, SPS o CBA.',
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 2) {
        const detail = await this.inventoryService.findStockDetalleByCodigoS4(sku);

        if (!detail) {
          return {
            reply: `No encontré stock para ${ctx.nombre ?? sku}.`,
            nextFlowId: pasoActual.id,
          };
        }

        await this.writeFollowUpCtx(sesion, {
          mode: 'FOLLOW_UP',
          source: 'STOCK',
          sku,
          nombre: ctx.nombre ?? detail?.Nombre ?? sku,
        });

        return {
          reply: formatStockDetailWithProductName(
            detail,
            ctx.nombre ?? detail?.Nombre ?? sku,
          ),
          followUp: buildNextActionMenu('STOCK'),
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 3) {
        const mes = ctx.mes ?? new Date().getMonth() + 1;
        const anio = ctx.anio ?? new Date().getFullYear();

        const row = await this.salesService.getVentaNetaProductoMesBySku({
          sku,
          mes,
          anio,
        });

        if (!row) {
          return {
            reply: `No encontré ventas para ${ctx.nombre ?? sku} en ${getNombreMes(mes)} ${anio}.`,
            nextFlowId: pasoActual.id,
          };
        }

        await this.writeFollowUpCtx(sesion, {
          mode: 'FOLLOW_UP',
          source: 'VENTAS',
          sku,
          nombre: row.NombreProducto ?? ctx.nombre ?? sku,
          mes,
          anio,
        });

        return {
          reply:
            `Venta del mes (Producto)\n` +
            `Producto: ${row.NombreProducto ?? ctx.nombre ?? ''}\n` +
            `SKU: ${sku}\n` +
            `Venta neta: ${formatLps(row.VentaNeta)}`,
          followUp: buildNextActionMenu('VENTAS'),
          nextFlowId: pasoActual.id,
        };
      }

      if (option === 4) {
        await this.clearAllContexts(sesion);
        const menu = await this.getMenuPaso();
        return {
          reply: menu.respuestaBot ?? 'Menú Principal',
          nextFlowId: menu.id,
        };
      }
    }

if (ctx.source === 'VENTAS_CATEGORIA') {
  if (option === 1) {
    await this.writeFollowUpCtx(sesion, {});
    await this.writeVentasCategoriaCtx(sesion, {
      mode: 'VENTAS_CATEGORIA_FLOW',
      step: 'ASK_CATEGORY',
      categoria: null,
      fechaInicio: null,
      fechaFin: null,
      mes: ctx.mes ?? null,
      anio: ctx.anio ?? null,
      topMode: false,
    });

    return {
      reply: 'Dime la categoría.',
      nextFlowId: pasoActual.id,
    };
  }

  if (option === 2) {
    await this.writeFollowUpCtx(sesion, {});
    await this.writeVentasCategoriaCtx(sesion, {
      mode: 'VENTAS_CATEGORIA_FLOW',
      step: 'ASK_PERIOD',
      categoria: ctx.nombre ?? null,
      fechaInicio: null,
      fechaFin: null,
      mes: null,
      anio: null,
      topMode: false,
    });

    return {
      reply:
        `Necesito el período para consultar las ventas` +
        `${ctx.nombre ? ` de ${ctx.nombre}` : ''}.\n\n` +
        buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  if (option === 3) {
    await this.writeFollowUpCtx(sesion, {});
    await this.writeVentasCategoriaCtx(sesion, {
      mode: 'VENTAS_CATEGORIA_FLOW',
      step: 'ASK_PERIOD',
      categoria: null,
      fechaInicio: null,
      fechaFin: null,
      mes: null,
      anio: null,
      topMode: true,
    });

    return {
      reply: buildGuidedMenu('PERIODO'),
      nextFlowId: pasoActual.id,
    };
  }

  if (option === 4) {
    await this.clearAllContexts(sesion);
    const menu = await this.getMenuPaso();

    return {
      reply: menu.respuestaBot ?? 'Menú Principal',
      nextFlowId: menu.id,
    };
  }
}
      return {
      reply:
        `Estoy esperando una opción válida:\n` +
        buildNextActionMenu(ctx.source),
      nextFlowId: pasoActual.id,
    };
  }

  private async handleNavigationFlow(
    sesion: Sesion,
    pasoActual: MenuPaso,
    raw: string,
  ): Promise<{ reply: string; followUp?: string; nextFlowId: number } | null> {
    const nav = this.readNavigationCtx(sesion);

    if (nav?.mode !== 'NAVIGATION' || !nav?.step) {
      return null;
    }

    const text = normalizeGuidedOption(raw);

    if (text === '5' || text === '4' || text === 'menu' || text === 'menú') {
      await this.clearNavigationCtx(sesion);
      const menu = await this.getMenuPaso();

      return {
        reply: menu.respuestaBot ?? 'Menú Principal',
        nextFlowId: menu.id,
      };
    }

  if (nav.step === 'AWAITING_PRODUCT') {
  if (nav.source === 'STOCK') {
    await this.clearNavigationCtx(sesion);

        const input = raw.trim().toUpperCase();
    if (!input) {
      return {
        reply: 'Escribe el SKU o nombre del producto.',
        nextFlowId: pasoActual.id,
      };
    }

    // Si parece SKU, buscar directo por SKU
    if (looksLikeSku(input) && isAllowedSkuValue(input)) {
      const detail =
        await this.inventoryService.findStockDetalleByCodigoS4(input);

      if (!detail) {
        return {
          reply: `No encontré el producto con SKU ${input}.`,
          nextFlowId: pasoActual.id,
        };
      }

      await this.writeFollowUpCtx(sesion, {
        mode: 'FOLLOW_UP',
        source: 'STOCK',
        sku: input,
        nombre: detail?.Nombre ?? input,
      });

      await this.writeNavigationCtx(sesion, {
        mode: 'NAVIGATION',
        source: 'STOCK',
        step: 'AWAITING_NEXT_ACTION',
        payload: {
          sku: input,
          nombre: detail?.Nombre ?? input,
        },
      });

      return {
      reply: formatStockDetail(detail),
      followUp: buildStockActionMenu(),
      nextFlowId: pasoActual.id,
      };
    }

    // Si no es SKU, buscar por nombre
    const term = raw.trim();
    const pageSize = 5;
    const page = 0;

    const rows = filterItemsWithValidSku(
      await this.inventoryService.findStockByNamePaged(term, page, pageSize),
    );
    const total = await this.inventoryService.countStockByName(term);

    if (!rows.length) {
      return {
        reply: `No encontré el producto "${term}".`,
        nextFlowId: pasoActual.id,
      };
    }

    await this.writeStockSearchCtx(sesion, {
      term,
      page,
      pageSize,
      total,
      items: rows
        .filter((r: any) => isAllowedSkuValue(r.CodigoS4))
        .map((r: any) => ({
          sku: String(r.CodigoS4 ?? '').trim(),
          nombre: String(r.Nombre ?? '').trim(),
        })),
    });

    const start = 1;
    const end = rows.length;
    const hasMore = end < total;

    const list = rows
      .map(
        (r: any, i: number) =>
          `${start + i}) ${r.CodigoS4} - ${r.Nombre} (Stock: ${(r.StockTotal ?? 0).toString()})`,
      )
      .join('\n');

    return {
      reply:
        `Resultados ${start}-${end} de ${total} para "${term}":\n\n${list}\n\n` +
        `Escribe el número de la opción para ver el detalle de stock.\n` +
        (hasMore
          ? `También puedes escribir "siguientes" para ver más.`
          : `No hay más resultados.`),
      nextFlowId: pasoActual.id,
    };
  }

  if (nav.source === 'PROMOCION') {
    await this.clearNavigationCtx(sesion);
    return await this.resolveReplyFromDb(
      sesion,
      `promociones ${raw}`,
    );
  }

  if (nav.source === 'VENTAS') {
    await this.clearNavigationCtx(sesion);
    return await this.resolveReplyFromDb(
      sesion,
      `ventas ${raw}`,
    );
  }

  if (nav.source === 'PRONOSTICO') {
    await this.clearNavigationCtx(sesion);
    return await this.resolveReplyFromDb(
      sesion,
      `proyeccion ${raw}`,
    );
  }

  return null;
}
  if (nav.step === 'AWAITING_PERIOD') {
  const monthRange = extractMonthRange(raw);
  const parsedMesAnio = parseMesAnioFromText(raw);
  const hasExplicitYear = /\b20\d{2}\b/.test(raw);
  const hasMonthName =
    /\b(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|octubre|oct|noviembre|nov|diciembre|dic)\b/i.test(
      raw,
    );
  const hasExactDateRange =
    /\b20\d{2}-\d{2}-\d{2}\b\s*(?:al|a|hasta)\s*\b20\d{2}-\d{2}-\d{2}\b/i.test(
      raw,
    );

  if (text === '1' || text === 'este mes') {
    const now = new Date();
    await this.clearNavigationCtx(sesion);

    if (nav.source === 'VENTAS_CATEGORIA') {
      const categoria = nav.payload?.categoria ?? '';
      const mensaje = categoria
        ? `ventas de ${categoria} en ${getNombreMes(
            now.getMonth() + 1,
          )} ${now.getFullYear()}`
        : `ventas por categoria en ${getNombreMes(
            now.getMonth() + 1,
          )} ${now.getFullYear()}`;

      return this.resolveReplyFromDb(sesion, mensaje);
    }

    return null;
  }

  if (text === '2' || text === 'mes pasado') {
    const now = new Date();
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    await this.clearNavigationCtx(sesion);

    if (nav.source === 'VENTAS_CATEGORIA') {
      const categoria = nav.payload?.categoria ?? '';
      const mensaje = categoria
        ? `ventas de ${categoria} en ${getNombreMes(
            ref.getMonth() + 1,
          )} ${ref.getFullYear()}`
        : `ventas por categoria en ${getNombreMes(
            ref.getMonth() + 1,
          )} ${ref.getFullYear()}`;

      return this.resolveReplyFromDb(sesion, mensaje);
    }

    return null;
  }

  if (text === '3') {
    await this.writeNavigationCtx(sesion, {
      ...nav,
      step: 'AWAITING_MONTH_YEAR',
    });

    return {
      reply:
        'Escribe el período con este formato:\n' +
        'Ejemplo: marzo 2026',
      nextFlowId: pasoActual.id,
    };
  }

  if (text === '4') {
    await this.writeNavigationCtx(sesion, {
      ...nav,
      step: 'AWAITING_DATE_RANGE',
    });

    return {
      reply:
        'Escribe el rango con este formato:\n' +
        'Ejemplo: 2026-01-01 al 2026-03-31',
      nextFlowId: pasoActual.id,
    };
  }

  // Permitir texto libre directamente en este paso
  if (nav.source === 'VENTAS_CATEGORIA') {
    if (monthRange) {
      const categoria = nav.payload?.categoria ?? '';
      await this.clearNavigationCtx(sesion);

      const mensaje = categoria
        ? `ventas de ${categoria} del ${monthRange.fechaInicio} al ${monthRange.fechaFin}`
        : `ventas por categoria del ${monthRange.fechaInicio} al ${monthRange.fechaFin}`;

      return this.resolveReplyFromDb(sesion, mensaje);
    }

    if (hasExactDateRange) {
      const categoria = nav.payload?.categoria ?? '';
      await this.clearNavigationCtx(sesion);

      const mensaje = categoria
        ? `ventas de ${categoria} del ${raw}`
        : `ventas por categoria del ${raw}`;

      return this.resolveReplyFromDb(sesion, mensaje);
    }

    if (hasMonthName || hasExplicitYear) {
      const categoria = nav.payload?.categoria ?? '';
      await this.clearNavigationCtx(sesion);

      const mensaje = categoria
        ? `ventas de ${categoria} en ${raw}`
        : `ventas por categoria en ${raw}`;

      return this.resolveReplyFromDb(sesion, mensaje);
    }
  }

  return {
    reply: buildGuidedMenu('PERIODO'),
    nextFlowId: pasoActual.id,
  };
}

    if (nav.step === 'AWAITING_MONTH_YEAR') {
      await this.clearNavigationCtx(sesion);

      if (nav.source === 'VENTAS_CATEGORIA') {
        const categoria = nav.payload?.categoria ?? '';
        const mensaje = categoria
          ? `ventas de ${categoria} en ${raw}`
          : `ventas por categoria en ${raw}`;

        return this.resolveReplyFromDb(sesion, mensaje);
      }

      return null;
    }

    if (nav.step === 'AWAITING_DATE_RANGE') {
      await this.clearNavigationCtx(sesion);

      if (nav.source === 'VENTAS_CATEGORIA') {
        const categoria = nav.payload?.categoria ?? '';
        const mensaje = categoria
          ? `ventas de ${categoria} del ${raw}`
          : `ventas por categoria del ${raw}`;

        return this.resolveReplyFromDb(sesion, mensaje);
      }

      return null;
    }

    return null;
  }

  // ============================
  // CONTEXTO HELPERS
  // ============================
  private parseSesionContext(sesion: Sesion): Record<string, any> {
    try {
      const raw = (sesion as any).contexto;
      if (!raw) return {};
      if (typeof raw === 'string') return JSON.parse(raw);
      if (typeof raw === 'object') return raw;
      return {};
    } catch {
      return {};
    }
  }

  private async writeSesionContext(
    sesion: Sesion,
    key: string,
    value: any,
  ): Promise<void> {
    const base = this.parseSesionContext(sesion);
    base[key] = value;
    (sesion as any).contexto = JSON.stringify(base);
    await this.sesionRepo.save(sesion);
  }

  private async clearAllContexts(sesion: Sesion): Promise<void> {
  await this.writePronosticoCtx(sesion, {});
  await this.writeStockSearchCtx(sesion, {});
  await this.writePromoSearchCtx(sesion, {});
  await this.writeProductoAmbiguoCtx(sesion, {});
  await this.writeProductoLookupCtx(sesion, {});
  await this.writeCategoriaAmbiguaCtx(sesion, {});
  await this.writeNotasCreditoCtx(sesion, {});
  await this.writeVendedorAmbiguoCtx(sesion, {});
  await this.writeFollowUpCtx(sesion, {});
  await this.writeNavigationCtx(sesion, {});
  await this.writeVentasCategoriaCtx(sesion, {});
  await this.writeVentasMenuCtx(sesion, {});
  await this.writeVentasProductoCtx(sesion, {});
}

  private async clearQueryContexts(sesion: Sesion): Promise<void> {
  await this.writePronosticoCtx(sesion, {});
  await this.writeProductoAmbiguoCtx(sesion, {});
  await this.writeProductoLookupCtx(sesion, {});
  await this.writeCategoriaAmbiguaCtx(sesion, {});
  await this.writePromoSearchCtx(sesion, {});
  await this.writeStockSearchCtx(sesion, {});
  await this.writeNotasCreditoCtx(sesion, {});
  await this.writeVendedorAmbiguoCtx(sesion, {});
  await this.writeFollowUpCtx(sesion, {});
  await this.writeNavigationCtx(sesion, {});

  // No borrar aquí los flujos guiados de ventas.
  // Se limpian con clearAllContexts o cuando el flujo termina.
}

  private getActiveLockedFlow(
  sesion: Sesion,
):
  | 'PRODUCTO_AMBIGUO'
  | 'PRODUCTO_LOOKUP'
  | 'VENDEDOR_AMBIGUO'
  | 'CATEGORIA_AMBIGUA'
  | 'PRONOSTICO'
  | 'FOLLOW_UP'
  | 'NOTAS_CREDITO_MENU'
  | 'CLIENTES'
  | 'DETALLE_CLIENTE'
  | 'VENTAS_MENU'
  | 'VENTAS_PRODUCTO_FLOW'
  | 'VENTAS_CATEGORIA_FLOW'
  | null {
  if (this.isProductoAmbiguoActivo(sesion)) return 'PRODUCTO_AMBIGUO';
  if (this.isProductoLookupActivo(sesion)) return 'PRODUCTO_LOOKUP';
  if (this.isVendedorAmbiguoActivo(sesion)) return 'VENDEDOR_AMBIGUO';
  if (this.isCategoriaAmbiguaActiva(sesion)) return 'CATEGORIA_AMBIGUA';
  if (this.isPronosticoActivo(sesion)) return 'PRONOSTICO';
  if (this.isVentasProductoActivo(sesion)) return 'VENTAS_PRODUCTO_FLOW';
  if (this.isVentasCategoriaActiva(sesion)) return 'VENTAS_CATEGORIA_FLOW';
  if (this.isVentasMenuActivo(sesion)) return 'VENTAS_MENU';

  const notas = this.readNotasCreditoCtx(sesion);
  if (
    notas?.mode === 'NOTAS_CREDITO_MENU' ||
    notas?.mode === 'CLIENTES' ||
    notas?.mode === 'DETALLE_CLIENTE'
  ) {
    return notas.mode;
  }

  if (this.isFollowUpActivo(sesion)) return 'FOLLOW_UP';

  return null;
}


  private readStockSearchCtx(sesion: Sesion): StockSearchCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.stockSearch ?? {}) as StockSearchCtx;
  }

  private async writeStockSearchCtx(sesion: Sesion, ctx: StockSearchCtx) {
    await this.writeSesionContext(sesion, 'stockSearch', ctx);
  }

  private readPromoSearchCtx(sesion: Sesion): PromoSearchCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.promoSearch ?? {}) as PromoSearchCtx;
  }

  private async writePromoSearchCtx(sesion: Sesion, ctx: PromoSearchCtx) {
    await this.writeSesionContext(sesion, 'promoSearch', ctx);
  }

  private readPronosticoCtx(sesion: Sesion): PronosticoCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.pronostico ?? {}) as PronosticoCtx;
  }

  private async writePronosticoCtx(sesion: Sesion, ctx: PronosticoCtx) {
    await this.writeSesionContext(sesion, 'pronostico', ctx);
  }

  //Helpers de ventas por categoria
private readVentasMenuCtx(sesion: Sesion): VentasMenuCtx {
  const raw = this.parseSesionContext(sesion);
  return (raw?.ventasMenu ?? {}) as VentasMenuCtx;
}

private async writeVentasMenuCtx(sesion: Sesion, ctx: VentasMenuCtx) {
  await this.writeSesionContext(sesion, 'ventasMenu', ctx);
}

private isVentasMenuActivo(sesion: Sesion): boolean {
  const ctx = this.readVentasMenuCtx(sesion);
  return ctx?.mode === 'VENTAS_MENU' && !!ctx?.step;
}

private readVentasProductoCtx(sesion: Sesion): VentasProductoCtx {
  const raw = this.parseSesionContext(sesion);
  return (raw?.ventasProducto ?? {}) as VentasProductoCtx;
}

private async writeVentasProductoCtx(sesion: Sesion, ctx: VentasProductoCtx) {
  await this.writeSesionContext(sesion, 'ventasProducto', ctx);
}

private isVentasProductoActivo(sesion: Sesion): boolean {
  const ctx = this.readVentasProductoCtx(sesion);
  return ctx?.mode === 'VENTAS_PRODUCTO_FLOW' && !!ctx?.step;
}

  private readVentasCategoriaCtx(sesion: Sesion): VentasCategoriaCtx {
  const raw = this.parseSesionContext(sesion);
  return (raw?.ventasCategoriaFlow ?? {}) as VentasCategoriaCtx;
}

private async writeVentasCategoriaCtx(
  sesion: Sesion,
  ctx: VentasCategoriaCtx,
) {
  await this.writeSesionContext(sesion, 'ventasCategoriaFlow', ctx);
}

private isVentasCategoriaActiva(sesion: Sesion): boolean {
  const ctx = this.readVentasCategoriaCtx(sesion);
  return ctx?.mode === 'VENTAS_CATEGORIA_FLOW' && !!ctx?.step;
}

  private readProductoAmbiguoCtx(sesion: Sesion): ProductoAmbiguoCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.productoAmbiguo ?? {}) as ProductoAmbiguoCtx;
  }

  private async writeProductoAmbiguoCtx(
    sesion: Sesion,
    ctx: ProductoAmbiguoCtx,
  ) {
    await this.writeSesionContext(sesion, 'productoAmbiguo', ctx);
  }

  private readVendedorAmbiguoCtx(sesion: Sesion): VendedorAmbiguoCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.vendedorAmbiguo ?? {}) as VendedorAmbiguoCtx;
  }

  private async writeVendedorAmbiguoCtx(
    sesion: Sesion,
    ctx: VendedorAmbiguoCtx,
  ) {
    await this.writeSesionContext(sesion, 'vendedorAmbiguo', ctx);
  }

  private isVendedorAmbiguoActivo(sesion: Sesion): boolean {
    const ctx = this.readVendedorAmbiguoCtx(sesion);
    return ctx?.mode === 'VENDEDOR_AMBIGUO' && ctx?.step === 'ASK_VENDOR';
  }
  private readCategoriaAmbiguaCtx(sesion: Sesion): CategoriaAmbiguaCtx {
  const raw = this.parseSesionContext(sesion);
  return (raw?.categoriaAmbigua ?? {}) as CategoriaAmbiguaCtx;
}

private async writeCategoriaAmbiguaCtx(
  sesion: Sesion,
  ctx: CategoriaAmbiguaCtx,
) {
  await this.writeSesionContext(sesion, 'categoriaAmbigua', ctx);
}

private isCategoriaAmbiguaActiva(sesion: Sesion): boolean {
  const ctx = this.readCategoriaAmbiguaCtx(sesion);
  return ctx?.mode === 'CATEGORIA_AMBIGUA' && ctx?.step === 'ASK_OPTION';
}

  private readNotasCreditoCtx(sesion: Sesion): NotasCreditoCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.notasCredito ?? {}) as NotasCreditoCtx;
  }

  private async writeNotasCreditoCtx(sesion: Sesion, ctx: NotasCreditoCtx) {
    await this.writeSesionContext(sesion, 'notasCredito', ctx);
  }

  private isProductoAmbiguoActivo(sesion: Sesion): boolean {
    const ctx = this.readProductoAmbiguoCtx(sesion);
    return ctx?.mode === 'PRODUCTO_AMBIGUO' && ctx?.step === 'ASK_ACTION';
  }

  private isPronosticoActivo(sesion: Sesion): boolean {
    const ctx = this.readPronosticoCtx(sesion);
    return ctx?.mode === 'PRONOSTICO';
  }

  private readFollowUpCtx(sesion: Sesion): FollowUpCtx {
    const raw = this.parseSesionContext(sesion);
    return (raw?.followUp ?? {}) as FollowUpCtx;
  }

  private async writeFollowUpCtx(sesion: Sesion, ctx: FollowUpCtx) {
  await this.writeSesionContext(sesion, 'followUp', ctx);
}

private readNavigationCtx(sesion: Sesion): NavigationCtx {
  const raw = this.parseSesionContext(sesion);
  return (raw?.navigation ?? {}) as NavigationCtx;
}

private async writeNavigationCtx(sesion: Sesion, ctx: NavigationCtx) {
  await this.writeSesionContext(sesion, 'navigation', ctx);
}

private async clearNavigationCtx(sesion: Sesion) {
  await this.writeSesionContext(sesion, 'navigation', {});
}

private isFollowUpActivo(sesion: Sesion): boolean {
  const ctx = this.readFollowUpCtx(sesion);

  if (ctx?.mode !== 'FOLLOW_UP' || !ctx?.source) {
    return false;
  }

  if (ctx.source === 'VENTAS_CATEGORIA') {
    return true;
  }

  return !!ctx?.sku;
}

  // ============================
  // Helpers varios
  // ============================
private filterItemsWithValidSku<T extends Record<string, any>>(items: T[] = []): T[] {
  return items.filter((item) =>
    isAllowedSkuValue(getAnySkuValue(item)),
  );
}

private extractCodigoS4(text: string): string | null {
  const t = (text ?? '').toString().toUpperCase();
  const m = t.match(/\b([A-Z][A-Z0-9-]{4,30})\b/);

  if (!m?.[1]) return null;

  const sku = m[1].trim().toUpperCase();

  if (!isAllowedSkuValue(sku)) return null;
  if (!/\d/.test(sku)) return null;

  return sku;
}

  private async getStockTotalBySkuFromView(sku: string): Promise<number> {
    if (!isAllowedSkuValue(sku)) return 0;

    const r = await this.inventoryService.findStockByCodeOrName(sku);
    if (!r) return 0;
    if (Array.isArray(r)) return 0;
    return Number((r as any).StockTotal ?? 0);
  }
 private async findOrCreateSesionByCanal(
  canal: string,
  canalRef: string,
): Promise<Sesion> {
  const last = await this.sesionRepo.findOne({
    where: { canal, canalRef } as any,
    order: { id: 'DESC' },
  });

  if (last) return last;

  const now = new Date();

  const nueva = this.sesionRepo.create();

  nueva.idUsuario = null;
  nueva.fechaInicio = now;
  nueva.ultimaActividad = now;
  nueva.contexto = null;
  nueva.canal = canal;
  nueva.canalRef = canalRef;

  return await this.sesionRepo.save(nueva);
}

  private async saveMensaje(params: {
    idSesion: number;
    idUsuario?: number | null;
    remitente: 'USUARIO' | 'BOT';
    contenido: string;
  }) {
    const idUsuario =
      params.idUsuario &&
      Number.isFinite(params.idUsuario) &&
      params.idUsuario > 0
        ? params.idUsuario
        : null;

    const m = this.mensajeRepo.create({
      idSesion: params.idSesion,
      idUsuario,
      remitente: params.remitente,
      tipoMensaje: 'TEXT',
      contenido: params.contenido,
      fechaHora: new Date(),
    } as any);

    await this.mensajeRepo.save(m);
  }
  private async getMenuPaso(): Promise<MenuPaso> {
    return {
      id: 0,
      tipoPaso: 'MENU',
      respuestaBot: this.MENU_PRINCIPAL,
    };
  }


private looksLikeStockOptionReference(text: string): boolean {
  const t = (text ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    /^\d+\b/.test(t) || // permite responder solo: 1, 2, 3...
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
}


  private buildContextualInvalidInputReply(sesion: Sesion): string | null {
    if (this.isProductoLookupActivo(sesion)) {
  const ctx = this.readProductoLookupCtx(sesion);
  const pageSize = ctx.pageSize ?? 5;
  const currentPage = ctx.page ?? 0;
  const total = ctx.total ?? ctx.items?.length ?? 0;
  const startIndex = currentPage * pageSize;
  const pageItems = (ctx.items ?? []).slice(startIndex, startIndex + pageSize);
  const list = pageItems
    .map((x, i) => `${startIndex + i + 1}) ${x.nombre} (SKU: ${x.sku})`)
    .join('\n');

  return (
    'Estoy esperando el número de una opción válida.\n\n' +
    `${list}\n\n` +
    (startIndex + pageItems.length < total
      ? 'También puedes escribir el SKU exacto, "siguientes" o "menu" para salir.'
      : 'También puedes escribir el SKU exacto o "menu" para salir.')
  );
}
    if (this.isProductoAmbiguoActivo(sesion)) {
      return (
        'Estoy esperando una opción válida:\n' +
        '1) Stock\n' +
        '2) Ventas\n' +
        '3) Proyección\n' +
        '4) SKU\n\n' +
        'También puedes escribir "menu" para salir.'
      );
    }

    if (this.isVendedorAmbiguoActivo(sesion)) {
      return 'Estoy esperando el número o el código exacto del vendedor.';
    }

    if (this.isPronosticoActivo(sesion)) {
      return (
        'Estoy esperando el SKU o nombre del producto para consultar la proyección.\n' +
        'Ejemplo: PT001004009 o Catrachito 250ml.'
      );
    }

    if (this.isFollowUpActivo(sesion)) {
      const followUp = this.readFollowUpCtx(sesion);
      if (followUp?.source) {
        return `Estoy esperando una opción válida:\n${buildNextActionMenu(
          followUp.source,
        )}`;
      }
    }

    return null;
  }

private readProductoLookupCtx(sesion: Sesion): ProductoLookupCtx {
  const raw = this.parseSesionContext(sesion);
  return (raw?.productoLookup ?? {}) as ProductoLookupCtx;
}

private async writeProductoLookupCtx(
  sesion: Sesion,
  ctx: ProductoLookupCtx,
) {
  await this.writeSesionContext(sesion, 'productoLookup', ctx);
}

private isProductoLookupActivo(sesion: Sesion): boolean {
  const ctx = this.readProductoLookupCtx(sesion);
  return ctx?.mode === 'PRODUCTO_LOOKUP' && ctx?.step === 'ASK_SELECT';
}

private isGenericPromoTerm(term: string): boolean {
  const t = (term || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const genericTerms = [
    'disponibles',
    'todas',
    'todo',
    'promociones',
    'promocion',
    'ver',
    'mostrar',
  ];

  return genericTerms.includes(t);
}
}