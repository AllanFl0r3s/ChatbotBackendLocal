import { Injectable } from '@nestjs/common';
import { AcademicRouteService } from './academic-route.service';
import { deadline, normalize, todayInHonduras } from './suggestions.core';
import { ClientLookupService, suggestedClientTerm } from './client-lookup.service';
import { PromotionCatalogService } from './promotion-catalog.service';
import { SuggestionsRepository } from './suggestions.repository';
import {
  applicablePromotions, historyStart, isSuggestionsEntry, promotionText,
  rankPromotions, SUGGESTIONS_MENU, suggestionAction,
} from './suggestions.core';
import type { SuggestionContext } from './suggestions.core';

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly access: AcademicRouteService,
    private readonly clients: ClientLookupService,
    private readonly catalog: PromotionCatalogService,
    private readonly repo: SuggestionsRepository,
  ) {}

  async handle(userId: number, text: string, previous?: SuggestionContext) {
    if (!previous?.active && !isSuggestionsEntry(text)) return null;
    const t = normalize(text);
    if (/^(menu|menu principal|volver al menu principal|salir)$/.test(t) || (previous?.active && t === '7'))
      return { reply: '', context: null, exit: true };
    const ctx: SuggestionContext = previous?.active ? { ...previous } : { active: true };
    const requested = t.match(/\bruta\s*:\s*([a-z0-9_-]+)|\bruta\s+((?=[a-z0-9_-]*\d)[a-z0-9_-]+)/);
    let route: string;
    try { route = await this.access.resolve(userId, requested?.[1] ?? requested?.[2] ?? ctx.route); }
    catch (error) { return { reply: (error as Error).message, context: null }; }
    if (ctx.route && ctx.route !== route)
      return { reply: 'Tu ruta cambió. Vuelve al menú principal e inicia otra consulta.', context: null };
    ctx.route = route;
    if (t === 'atras') {
      // Conservar el cliente al salir de una consulta; el siguiente atrás permite cambiarlo.
      if (ctx.action && ctx.client) {
        const menuContext: SuggestionContext = { active: true, route, client: ctx.client };
        const prompt = await this.clients.resolve(menuContext, text);
        return { reply: prompt ?? `${ctx.client.name.trim()}\n${SUGGESTIONS_MENU}`, context: menuContext };
      }
      return ctx.client || ctx.choices || ctx.action
        ? { reply: '¿Para qué cliente deseas consultar? Escribe su código o nombre.', context: { active: true, route } as SuggestionContext }
        : { reply: '', context: null, exit: true };
    }
    const embeddedClient = suggestedClientTerm(text);
    if (embeddedClient && previous?.client) {
      // Una nueva pregunta sobre otro cliente no debe reutilizar el cliente anterior.
      delete ctx.client;
      delete ctx.choices;
      delete ctx.page;
      delete ctx.selection;
      delete ctx.until;
      ctx.action = suggestionAction(text);
    }
    const today = todayInHonduras();
    if (!ctx.action) ctx.action = isSuggestionsEntry(text) && !/^(9|opcion 9|promociones sugeridas(?: por cliente)?)$/.test(t)
      ? suggestionAction(text) : undefined;
    if (ctx.action === 5 && !ctx.until) ctx.until = deadline(text, today);
    const prompt = await this.clients.resolve(ctx, text, embeddedClient ??
      (previous?.active && !previous.client && !previous.choices && !isSuggestionsEntry(text) ? text.trim() : undefined));
    if (prompt) return { reply: prompt, context: ctx };
    if (!ctx.action || (ctx.page !== undefined && !ctx.selection && !/^(mas|siguientes)$/.test(t))) {
      const action = ctx.action && ctx.page === undefined ? ctx.action : previous?.client && !embeddedClient ? suggestionAction(text) : undefined;
      ctx.action = action;
      ctx.page = undefined;
      ctx.until = action === 5 ? deadline(text, today) : undefined;
    }
    if (!ctx.action) return { reply: `${ctx.client!.name.trim()}\n${SUGGESTIONS_MENU}`, context: ctx };
    if (ctx.action === 5 && !ctx.until) {
      ctx.until = deadline(text, today);
      if (!ctx.until) return { reply: '¿Qué plazo deseas consultar: 7 días, 15 días, esta semana o una fecha AAAA-MM-DD?', context: ctx };
    }
    const catalog = await this.catalog.load(today);
    if (!catalog) return {
      reply: 'Todavía no hay un catálogo comercial validado con vigencia y clientes elegibles. No puedo confirmar promociones, bonificaciones ni fechas de vencimiento.\n' + SUGGESTIONS_MENU,
      context: { active: true, route, client: ctx.client } as SuggestionContext,
    };
    const promotions = applicablePromotions(catalog, ctx.client!.code, today);
    if (ctx.action === 4 && promotions.length && promotions.every(p => !p.buyQuantity)) return {
      reply: 'Las promociones de demostración no tienen cantidades de bonificación registradas. No puedo indicar cuántas unidades debes comprar.\n\n' + SUGGESTIONS_MENU,
      context: { ...ctx, page: 0 },
    };
    const facts = await this.repo.facts(route, ctx.client!.code, historyStart(today), today, [...new Set(promotions.map(p => p.sku))]);
    const ranked = rankPromotions(promotions, facts, ctx.action, ctx.until);
    const footer = `\n\nDatos ficticios · Consultado: ${today.split('-').reverse().join('/')}\nActualización de promociones no registrada. El stock puede cambiar.`;
    if (ctx.selection && !/^(mas|siguientes)$/.test(t)) {
      const indexes = t.split(/\s*,\s*/);
      if (!indexes.length || indexes.some(i => !/^[1-5]$/.test(i) || !ctx.selection![Number(i) - 1]))
        return { reply: 'Selecciona números de la lista separados por comas, por ejemplo: 1,3. O escribe “más”.', context: ctx };
      const ids = new Set(indexes.map(i => ctx.selection![Number(i) - 1]));
      const selected = ranked.filter(p => ids.has(p.id));
      delete ctx.selection;
      if (selected.length !== ids.size) return { reply: 'Las promociones cambiaron o ya no aplican. Selecciona nuevamente la opción 6.', context: { ...ctx, action: undefined, page: undefined } };
      return { reply: `Mensaje preparado para ${ctx.client!.name.trim()}:\n\nHola, estas son las promociones disponibles para ti:\n\n${selected.map(promotionText).join('\n\n')}\n\nSujeto a disponibilidad y condiciones indicadas. Confirma el stock antes de realizar el pedido.${footer}`, context: ctx };
    }
    ctx.page = /^(mas|siguientes)$/.test(t) ? (ctx.page ?? 0) + 1 : 0;
    const page = ranked.slice(ctx.page * 5, ctx.page * 5 + 5);
    if (!page.length) return { reply: (ctx.page ? 'No hay más resultados.' : 'No hay promociones que cumplan esta consulta para el cliente.') + footer, context: ctx };
    if (ctx.action === 6) ctx.selection = page.map(p => p.id);
    return {
      reply: `${ctx.client!.name.trim()}\n\n` + page.map((p, i) => `${i + 1}) ${promotionText(p)}\nRegistros de compra: ${p.facts?.purchases ?? 0}. Stock reportado: ${p.facts?.stock ?? 'no disponible'} (unidad de la fuente).`).join('\n\n') +
        (ctx.selection ? '\nSelecciona las promociones para el mensaje: 1,3, por ejemplo.' : '') +
        ((ctx.page + 1) * 5 < ranked.length ? '\nEscribe “más” o “siguientes” para continuar.' : '') + footer,
      context: ctx,
    };
  }
}
