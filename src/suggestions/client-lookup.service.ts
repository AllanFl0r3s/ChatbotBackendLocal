import { Injectable } from '@nestjs/common';
import type { SuggestionContext } from './suggestions.core';
import { SuggestionsRepository } from './suggestions.repository';
import { normalize } from './suggestions.core';

export function suggestedClientTerm(text: string): string | undefined {
  const term = text.match(/\bcliente\s+(.+?)(?=\s+(?:tienen?|est[aá]n|vencen?|para|con|en|durante|est[ae]|el mes|hoy|ayer|[uú]ltimos|pr[oó]xim\w*)\b|[?¿]|$)/i)?.[1];
  return term?.replace(/\s+(?:(?:del|desde|entre)\s+)?\d{1,4}[/-]\d{1,2}[/-]\d{1,4}[\s\S]*$/i, '').replace(/[.!]+$/, '').trim();
}

@Injectable()
export class ClientLookupService {
  constructor(private readonly repo: SuggestionsRepository) {}

  async resolve(ctx: SuggestionContext, text: string, term?: string): Promise<string | undefined> {
    if (ctx.client) {
      // Comprobar de nuevo la pertenencia: una reasignación del maestro revoca el acceso en el siguiente turno.
      const current = await this.repo.clients(ctx.route!, ctx.client.code, 0);
      if (!current.some(c => c.code === ctx.client!.code)) {
        delete ctx.client;
        return 'El cliente ya no pertenece a tu ruta. Vuelve al menú principal e inicia otra consulta.';
      }
      return;
    }
    const t = normalize(text);
    if (ctx.choices && !/^(mas|siguientes)$/.test(t)) {
      const selected = /^[1-5]$/.test(t) ? ctx.choices[Number(t) - 1] : ctx.choices.find(c => c.code === text.trim());
      if (!selected) return 'Selecciona un número mostrado, su código exacto o escribe “más”.';
      ctx.client = selected;
      delete ctx.choices;
      return this.resolve(ctx, text);
    }
    if (/^(mas|siguientes)$/.test(t) && ctx.search) {
      ctx.choicePage = (ctx.choicePage ?? 0) + 1;
      term = ctx.search;
    } else if (term) ctx.choicePage = 0;
    if (!term) return '¿Para qué cliente deseas consultar? Escribe su código o nombre.';
    const rows = await this.repo.clients(ctx.route!, term, ctx.choicePage ?? 0);
    const exact = rows.find(c => normalize(c.code) === normalize(term));
    if (exact || (rows.length === 1 && Number(rows[0].total) === 1)) {
      ctx.client = exact ?? rows[0];
      delete ctx.choices;
      return;
    }
    if (!rows.length) return ctx.choicePage ? 'No hay más coincidencias. Selecciona un cliente de la última lista o vuelve al menú principal.' :
      'No encontré ese cliente en tu ruta. Escribe otro código o nombre.';
    ctx.search = term;
    ctx.choices = rows;
    return rows.map((c, i) => `${i + 1}) ${c.name.trim()} · ${c.code}`).join('\n') +
      '\nSelecciona un cliente.' + (Number(rows[0].total) > ((ctx.choicePage ?? 0) + 1) * 5 ? ' Escribe “más” para otras coincidencias.' : '');
  }
}
