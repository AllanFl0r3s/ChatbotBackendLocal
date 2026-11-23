import { Injectable } from '@nestjs/common';
import { AcademicRouteService } from './academic-route.service';
import { addDays, normalize, todayInHonduras } from './suggestions.core';
import { ClientLookupService, suggestedClientTerm } from './client-lookup.service';
import { historyStart } from './suggestions.core';
import type { SuggestionContext } from './suggestions.core';
import { HISTORY_MENU, historyAction, historyPeriod, inactiveDays, isHistoryEntry } from './purchase-history.core';
import { PurchaseHistoryRepository } from './purchase-history.repository';
import { shortDate } from './suggestions.core';

@Injectable()
export class PurchaseHistoryService {
  constructor(
    private readonly access: AcademicRouteService,
    private readonly clients: ClientLookupService,
    private readonly repo: PurchaseHistoryRepository,
  ) {}

  async handle(userId: number, text: string, previous?: SuggestionContext) {
    if (!previous?.active && !isHistoryEntry(text)) return null;
    const t = normalize(text);
    if (/^(menu|menu principal|volver al menu principal|salir)$/.test(t) || (previous?.active && t === '5'))
      return { reply: '', context: null, exit: true };
    const requested = t.match(/\bruta\s*:\s*([a-z0-9_-]+)|\bruta\s+((?=[a-z0-9_-]*\d)[a-z0-9_-]+)/);
    let route: string;
    try { route = await this.access.resolve(userId, requested?.[1] ?? requested?.[2] ?? previous?.route); }
    catch (error) { return { reply: (error as Error).message, context: null }; }
    if (previous?.route && previous.route !== route)
      return { reply: 'Tu ruta cambió. Vuelve al menú principal e inicia otra consulta.', context: null };
    let ctx: SuggestionContext = previous?.active ? { ...previous } : { active: true, route };
    const today = todayInHonduras();
    const next = /^(mas|siguientes)$/.test(t);
    if (!ctx.action || (ctx.page !== undefined && !next) || suggestedClientTerm(text)) {
      const action = historyAction(text);
      ctx = { active: true, route, action, client: suggestedClientTerm(text) ? undefined : ctx.client };
    }
    if (!ctx.action) return { reply: HISTORY_MENU, context: ctx };
    // Capturar el período en el primer turno, incluso si falta seleccionar el cliente.
    if (ctx.action === 2 && !ctx.from) Object.assign(ctx, historyPeriod(text, today));
    if (ctx.action === 4 && !ctx.days && !(/^[1-4]$/.test(t) && (previous?.action !== 4 || previous.page !== undefined)))
      ctx.days = inactiveDays(text);
    if (ctx.action !== 4) {
      const prompt = await this.clients.resolve(ctx, text, suggestedClientTerm(text) ??
        (previous?.action === ctx.action && !previous.client && !previous.choices && !isHistoryEntry(text) &&
          !historyPeriod(text, today) ? text.trim() : undefined));
      if (prompt) return { reply: prompt, context: ctx };
    }
    if (ctx.action === 2 && !ctx.from)
      return { reply: 'Indica el período: mes pasado, este mes, una fecha AAAA-MM-DD o dos fechas AAAA-MM-DD a AAAA-MM-DD.', context: ctx };
    if (ctx.action === 4 && !ctx.days)
      return { reply: '¿Cuántos días sin compras deseas consultar? Escribe un número entre 1 y 3650.', context: ctx };
    ctx.page = next ? (ctx.page ?? 0) + 1 : 0;
    const from = ctx.action === 4 ? addDays(today, -ctx.days!) : ctx.from ?? historyStart(today);
    const rows = await this.repo.results(route, ctx.action === 4 ? undefined : ctx.client!.code,
      ctx.action, from, ctx.to ?? today, ctx.page);
    const body = rows.map((r, i) => {
      if (ctx.action === 1) return `Última compra: ${shortDate(r.date!)}\nRegistro: ${r.document}`;
      const number = ctx.page! * 5 + i + 1;
      if (ctx.action === 4) return `${number}) ${r.name.trim()} (${r.code})\nÚltima compra: ${r.date ? shortDate(r.date) : 'sin compras registradas en tu ruta'}`;
      // Mostrar cantidades sin ceros sobrantes y usar palabras habituales para el vendedor.
      const quantity = Number(r.quantity).toLocaleString('es-HN', { maximumFractionDigits: 5 });
      const unit = (r.unit || 'sin unidad registrada').toLowerCase();
      const label = Number(r.quantity) === 1 ? unit : ({ unidad: 'unidades', caja: 'cajas' }[unit] ?? unit);
      return `${number}) ${r.name.trim()}\n${r.purchases} ${Number(r.purchases) === 1 ? 'registro' : 'registros'} · ${quantity} ${label}`;
    }).join('\n\n');
    const total = Number(rows[0]?.total ?? 0);
    const title = ctx.action === 4 ? `Clientes sin compras en los últimos ${ctx.days} días` : ctx.client!.name.trim();
    const period = [2, 3].includes(ctx.action) ? `\n${ctx.action === 3 ? 'Lo que más compra' : 'Productos comprados'} · ${shortDate(from)} al ${shortDate(ctx.to ?? today)}` : '';
    const pagination = rows.length && total > 5 ? `\n\nMostrando ${ctx.page * 5 + 1} a ${ctx.page * 5 + rows.length} de ${total}.` : '';
    const more = rows.length && (ctx.page + 1) * 5 < total ?
      `\n\nPara ver otros ${ctx.action === 4 ? 'clientes' : 'productos'}, escribe más.` : '';
    return {
      reply: `${title}${period}\n\n` + (body || (ctx.page ? 'Ya viste todos los resultados.' : 'No encontré resultados para esta consulta.')) +
        `${pagination}\n\nRuta ${route} · Consultado: ${shortDate(today)}\nDatos ficticios · Pueden faltar compras recientes.${more}`,
      context: ctx,
    };
  }
}
