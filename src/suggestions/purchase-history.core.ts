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

type Period = { from: string; to: string };
export const PERIOD_HELP = '¿De qué fechas quieres ver las compras?\nEscribe «este mes», «mes pasado» o un rango de fechas.\nEjemplo: 1/1/2026 al 1/5/2026 (del 1 de enero al 1 de mayo).';

// Convierte fechas habituales del vendedor a ISO; los años cortos pertenecen al siglo 2000.
function inputDate(text: string): string {
  const parts = text.split(/[/-]/);
  const [year, month, day] = parts[0].length === 4 ? parts : [parts[2], parts[1], parts[0]];
  return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function readHistoryPeriod(text: string, today: string): { period?: Period; error?: string } {
  const t = normalize(text);
  const dates = t.match(/\b\d+[/-]\d+[/-]\d+\b/g)?.map(inputDate);
  if (dates) {
    if (dates.length > 2) return { error: 'Escribe solo la fecha inicial y la fecha final.' };
    if (dates.some(d => {
      const parsed = new Date(`${d}T12:00:00Z`);
      return !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d;
    })) return { error: 'Una de las fechas no existe. Revísala y escríbela como día/mes/año.' };
    if (dates.some(d => d < '1900-01-01')) return { error: 'Usa una fecha desde el año 1900 y escribe el año con cuatro dígitos.' };
    const [from, to = from] = dates;
    if (from > to) return { error: `La fecha final es anterior a la inicial.\nEscribe primero la más antigua: ${to.split('-').reverse().join('/')} - ${from.split('-').reverse().join('/')}.` };
    if (to > today) return { error: `Solo puedo consultar compras hasta hoy: ${today.split('-').reverse().join('/')}.` };
    if (to > addDays(from, 3660)) return { error: 'Consulta hasta 10 años por vez. Elige un período más corto.' };
    return { period: { from, to } };
  }
  const [year, month] = today.split('-').map(Number);
  if (/mes pasado|mes anterior/.test(t)) {
    const from = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
    return { period: { from, to: addDays(`${today.slice(0, 7)}-01`, -1) } };
  }
  if (/este mes|mes actual/.test(t)) return { period: { from: `${today.slice(0, 7)}-01`, to: today } };
  if (/\bhoy\b/.test(t)) return { period: { from: today, to: today } };
  if (/\bayer\b/.test(t)) return { period: { from: addDays(today, -1), to: addDays(today, -1) } };
  const days = t.match(/ultimos\s+(\d{1,4})\s+dias\b/)?.[1];
  if (days && Number(days) >= 1 && Number(days) <= 3650)
    return { period: { from: addDays(today, 1 - Number(days)), to: today } };
  return {};
}

export const historyPeriod = (text: string, today: string): Period | undefined => readHistoryPeriod(text, today).period;

export function inactiveDays(text: string): number | undefined {
  const t = normalize(text);
  const value = /^\d{1,4}$/.test(t) ? Number(t) : Number(t.match(/\b(\d{1,4})\s*dias\b/)?.[1]);
  return Number.isInteger(value) && value > 0 && value <= 3650 ? value : undefined;
}
