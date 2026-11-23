import { addDays, normalize } from './suggestions.core';

export const HISTORY_MENU = `Historial de compras. ¿Qué deseas consultar?
1) Última compra de un cliente.
2) Productos comprados por un cliente en un período.
3) Productos que compra con mayor frecuencia (últimos 180 días).
4) Clientes de mi ruta sin compras en un plazo determinado.
5) Volver al menú principal.`;

export function historyAction(text: string): number | undefined {
  const t = normalize(text);
  if (/^[1-4]$/.test(t)) return Number(t);
  if (/sin compr|sin realizar.*compr/.test(t)) return 4;
  if (/ultima compra/.test(t)) return 1;
  if (/frecuen|habitual/.test(t)) return 3;
  if (/productos.*compr|que compro/.test(t)) return 2;
  return undefined;
}

export function isHistoryEntry(text: string): boolean {
  const t = normalize(text);
  return /^(10|opcion 10|historial de compras(?: por cliente)?)$/.test(t) ||
    (/cliente|ruta/.test(t) && historyAction(text) !== undefined && !/promocion|bonifica|cotizaci|descuento/.test(t));
}

export function historyPeriod(text: string, today: string): { from: string; to: string } | undefined {
  const t = normalize(text);
  const [year, month] = today.split('-').map(Number);
  if (/mes pasado|mes anterior/.test(t)) {
    const from = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
    return { from, to: addDays(`${today.slice(0, 7)}-01`, -1) };
  }
  if (/este mes|mes actual/.test(t)) return { from: `${today.slice(0, 7)}-01`, to: today };
  if (/\bhoy\b/.test(t)) return { from: today, to: today };
  const dates = t.match(/\d{4}-\d{2}-\d{2}/g);
  if (!dates || dates.length > 2 || dates.some(d => {
    const parsed = new Date(`${d}T12:00:00Z`);
    return d < '1900-01-01' || d > today || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d;
  })) return;
  const [from, to = from] = dates;
  if (from <= to && to <= addDays(from, 3660)) return { from, to };
}

export function inactiveDays(text: string): number | undefined {
  const t = normalize(text);
  const value = /^\d{1,4}$/.test(t) ? Number(t) : Number(t.match(/\b(\d{1,4})\s*dias\b/)?.[1]);
  return Number.isInteger(value) && value > 0 && value <= 3650 ? value : undefined;
}
