
export type Promotion = {
  id: string; sku: string; name: string; startsOn: string; endsOn: string;
  clientCodes: string[]; buyQuantity?: number; buyUnit?: string;
  bonusQuantity?: number; bonusUnit?: string; conditions: string;
};
export type Catalog = { source: string; updatedAt: string | null; promotions: Promotion[] };
export type Client = { code: string; name: string; total: number };
export type SuggestionContext = {
  active: true; route?: string; client?: Client; choices?: Client[];
  search?: string; choicePage?: number; action?: number; page?: number;
  until?: string; selection?: string[];
  from?: string; to?: string; days?: number;
};
export const SUGGESTIONS_MENU = `¿Qué deseas consultar?
1) Promociones aplicables al cliente.
2) Promociones de sus productos habituales.
3) Productos habituales en promoción con stock.
4) Cantidades y condiciones para bonificaciones.
5) Promociones próximas a vencer.
6) Preparar un mensaje con promociones seleccionadas.
7) Volver al menú principal.`;

export function isSuggestionsEntry(text: string): boolean {
  const t = normalize(text);
  return /^(9|opcion 9|promociones sugeridas(?: por cliente)?)$/.test(t) ||
    (/\bcliente\b/.test(t) && /promocion|bonificaci/.test(t) && !/cotizaci|descuento adicional/.test(t));
}

export function suggestionAction(text: string): number | undefined {
  const t = normalize(text);
  if (/^[1-6]$/.test(t)) return Number(t);
  if (/mensaje|prepara/.test(t)) return 6;
  if (/venc|vigencia/.test(t)) return 5;
  if (/bonifica|cantidad|condiciones/.test(t)) return 4;
  if (/stock|disponib/.test(t)) return 3;
  if (/habitual|compra/.test(t)) return 2;
  if (/promocion/.test(t)) return 1;
  return undefined;
}

export function applicablePromotions(catalog: Catalog, client: string, today: string) {
  return catalog.promotions.filter(p => p.startsOn <= today && p.endsOn >= today &&
    (p.clientCodes.includes(client) || p.clientCodes.includes('*')));
}

export type ProductFacts = { sku: string; purchases: number; stock: number | null };
export function rankPromotions(promotions: Promotion[], facts: ProductFacts[], action: number, until?: string) {
  const products = new Map(facts.map(p => [p.sku, p]));
  return promotions.map(p => ({ ...p, facts: products.get(p.sku) }))
    .filter(p => (![2, 3].includes(action) || (p.facts?.purchases ?? 0) > 0) &&
      (action !== 4 || ((p.buyQuantity ?? 0)>0 && (p.bonusQuantity ?? 0)>0)) &&
      (action !== 3 || (p.facts?.stock ?? 0) > 0) && (action !== 5 || (!!until && p.endsOn <= until)))
    .sort((a, b) => (b.facts?.purchases ?? 0) - (a.facts?.purchases ?? 0) ||
      a.endsOn.localeCompare(b.endsOn) || a.id.localeCompare(b.id));
}

export function historyStart(today: string) { return addDays(today, -180); }
export function promotionText(p: Promotion): string {
  const bonus = p.buyQuantity && p.bonusQuantity ? `Compra ${p.buyQuantity} ${p.buyUnit} y recibe ${p.bonusQuantity} ${p.bonusUnit}.\n` : '';
  return `${p.name} [${p.id}] · SKU ${p.sku}\n${bonus}${p.conditions}\nVigencia: ${shortDate(p.startsOn)} al ${shortDate(p.endsOn)}.`;
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿?¡!]/g, '').trim();
export function todayInHonduras(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function shortDate(date: string): string { return date.split('-').reverse().join('/'); }
export function deadline(text: string, today: string): string | undefined {
  const t = normalize(text);
  if (/esta semana/.test(t)) return addDays(today, (7 - new Date(`${today}T12:00:00Z`).getUTCDay()) % 7);
  const days = t.match(/\b(7|15)\s*(?:dias)?$/);
  if (days) return addDays(today, Number(days[1]));
  const date = t.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (!date || date < today || date > addDays(today, 3660)) return;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : undefined;
}
