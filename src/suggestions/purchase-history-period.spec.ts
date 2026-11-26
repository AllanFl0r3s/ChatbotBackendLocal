import { historyPeriod, readHistoryPeriod } from './purchase-history.core';
import { suggestedClientTerm } from './client-lookup.service';

describe('Fechas fáciles de escribir para el vendedor', () => {
  const today = '2026-11-24';
  it.each([
    ['1/1/26 - 1/5/26', '2026-01-01', '2026-05-01'],
    ['del 1/1/2026 al 1/5/2026', '2026-01-01', '2026-05-01'],
    ['1-1-26 a 1-5-26', '2026-01-01', '2026-05-01'],
    ['2026-01-01 a 2026-05-01', '2026-01-01', '2026-05-01'],
    ['24/11/26', today, today],
    ['hoy', today, today],
    ['ayer', '2026-11-23', '2026-11-23'],
    ['últimos 7 días', '2026-11-18', today],
    ['este mes', '2026-11-01', today],
    ['mes pasado', '2026-10-01', '2026-10-31'],
  ])('interpreta «%s» con día primero', (text, from, to) => {
    expect(historyPeriod(text, today)).toEqual({ from, to });
  });
  it('explica las fechas invertidas sin ejecutar una consulta distinta', () => {
    expect(historyPeriod('2026-02-14 a 2026-01-12', today)).toBeUndefined();
    expect(readHistoryPeriod('2026-02-14 a 2026-01-12', today).error)
      .toContain('12/01/2026 - 14/02/2026');
  });
  it.each(['31/2/26', '29/2/2026', '1/13/26', '1/1/2', '1/1/26 - 1/5/20266'])('rechaza «%s» sin aceptar solo una parte', text => {
    expect(historyPeriod(text, today)).toBeUndefined();
    expect(readHistoryPeriod(text, today).error).toBeDefined();
  });
  it('admite el 29 de febrero de un año bisiesto', () => {
    expect(historyPeriod('29/2/24', today)).toEqual({ from: '2024-02-29', to: '2024-02-29' });
  });
  it('explica una fecha futura con la fecha límite', () => {
    expect(readHistoryPeriod('25/11/26', today).error).toContain('24/11/2026');
  });
  it('solicita dos fechas cuando se escriben tres', () => {
    expect(readHistoryPeriod('1/1/26, 2/1/26, 3/1/26', today).error).toContain('solo la fecha inicial');
  });
  it('separa el nombre o código del cliente del rango escrito', () => {
    expect(suggestedClientTerm('¿Qué productos compró el cliente C1 del 1/1/26 al 1/5/26?')).toBe('C1');
    expect(suggestedClientTerm('productos del cliente Comercial Del Centro 1/1/26 - 1/5/26')).toBe('Comercial Del Centro');
    expect(suggestedClientTerm('productos del cliente C1 ayer')).toBe('C1');
  });
});
