import { ConfigService } from '@nestjs/config';
import { AcademicRouteService } from './academic-route.service';
import { RouteAccessService } from '../route-access/route-access.service';
import { ClientLookupService, suggestedClientTerm } from './client-lookup.service';
import { SuggestionsRepository } from './suggestions.repository';
import { PurchaseHistoryRepository } from './purchase-history.repository';
import { PurchaseHistoryService } from './purchase-history.service';
import { PromotionCatalogService } from './promotion-catalog.service';
import { SuggestionsService } from './suggestions.service';
import { historyPeriod } from './purchase-history.core';

describe('Opciones académicas 9 y 10', () => {
  const users = { findOne: async ({ where }: any) => ({ id: where.id, estado: true }) } as any;
  const access = new AcademicRouteService(new RouteAccessService(users, new ConfigService({ VISITS_ROUTE_ACCESS: '{"1":["S08","S09"]}' })));
  const client = { code: 'DEMO001', name: 'Cliente de prueba', total: 1 };
  const repo = { clients: jest.fn(), catalog: jest.fn(), facts: jest.fn() };
  const purchases = { results: jest.fn() };
  const promotion = { id: 'DEMO-PROMO-1', sku: 'PT990000001', name: 'Agua demo', startsOn: '2026-11-01',
    endsOn: '2026-11-30', conditions: 'Oferta ficticia', clientCodes: ['*'] };
  let history: PurchaseHistoryService;
  let suggestions: SuggestionsService;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-23T18:00:00Z'));
    repo.clients.mockReset().mockImplementation(async (_route, term) => term === client.code ? [client] : []);
    repo.catalog.mockReset().mockResolvedValue({ source: 'Académica', updatedAt: null, promotions: [promotion] });
    repo.facts.mockReset().mockResolvedValue([{ sku: promotion.sku, purchases: 2, stock: 10 }]);
    purchases.results.mockReset().mockResolvedValue([]);
    const lookup = new ClientLookupService(repo as unknown as SuggestionsRepository);
    history = new PurchaseHistoryService(access, lookup, purchases as unknown as PurchaseHistoryRepository);
    suggestions = new SuggestionsService(access, lookup, new PromotionCatalogService(repo as unknown as SuggestionsRepository),
      repo as unknown as SuggestionsRepository);
  });
  afterEach(() => jest.useRealTimers());

  it('atrás limpia el historial y conserva la ruta académica elegida', async () => {
    const result = await history.handle(1, 'atrás', { active: true, route: 'S09', action: 2, client, from: '2026-01-01', page: 1 });
    expect(result?.reply).toContain('Historial de compras.');
    expect(result?.context).toEqual({ active: true, route: 'S09' });
    expect((await history.handle(1, 'atras', result!.context!))?.exit).toBe(true);
    expect(purchases.results).not.toHaveBeenCalled();
  });
  it('atrás en promociones permite volver al menú y cambiar de cliente', async () => {
    const result = await suggestions.handle(1, 'atrás', { active: true, route: 'S08', action: 6, client, selection: ['DEMO-PROMO-1'], page: 1 });
    expect(result?.reply).toContain('¿Qué deseas consultar?');
    expect(result?.context).toEqual({ active: true, route: 'S08', client });
    const choose = await suggestions.handle(1, 'atras', result!.context!);
    expect(choose?.context).toEqual({ active: true, route: 'S08' });
    expect((await suggestions.handle(1, 'atrás', choose!.context!))?.exit).toBe(true);
    expect(repo.catalog).not.toHaveBeenCalled();
  });

  it('reutiliza los permisos académicos y permite elegir otra ruta autorizada', async () => {
    await expect(access.resolve(1)).resolves.toBe('S08');
    await expect(access.resolve(1, 's09')).resolves.toBe('S09');
    await expect(access.resolve(1, 'S02')).rejects.toThrow('No tienes permiso');
    await expect(access.resolve(2)).rejects.toThrow('No tienes permiso');
  });
  it('una configuración inválida no abre el acceso', async () => {
    const broken = new AcademicRouteService(new RouteAccessService(users, new ConfigService({ VISITS_ROUTE_ACCESS: '{' })));
    await expect(broken.resolve(1)).rejects.toThrow('configuración');
  });
  it('rechaza una ruta ajena antes de buscar clientes o consultar ventas', async () => {
    const result = await history.handle(1, '¿Cuándo fue la última compra del cliente DEMO001 en ruta S02?');
    expect(result?.reply).toContain('No tienes permiso');
    expect(repo.clients).not.toHaveBeenCalled();
    expect(purchases.results).not.toHaveBeenCalled();
  });
  it('separa este mes del código y conserva cliente, ruta y período', async () => {
    const result = await history.handle(1, '¿Qué productos compró el cliente DEMO001 este mes?');
    expect(suggestedClientTerm('cliente DEMO001 este mes')).toBe('DEMO001');
    expect(result?.context?.client?.code).toBe('DEMO001');
    expect(purchases.results).toHaveBeenCalledWith('S08', 'DEMO001', 2, '2026-11-01', '2026-11-23', 0);
  });
  it('pide únicamente el período que falta', async () => {
    const first = await history.handle(1, '10');
    const second = await history.handle(1, '2', first!.context!);
    const third = await history.handle(1, 'DEMO001', second!.context!);
    expect(third?.reply).toContain('¿De qué fechas quieres ver las compras?');
    expect(third?.reply).toContain('Ejemplo: 1/1/2026 al 1/5/2026');
    expect(purchases.results).not.toHaveBeenCalled();
    await history.handle(1, 'mes pasado', third!.context!);
    expect(purchases.results).toHaveBeenCalledWith('S08', 'DEMO001', 2, '2026-10-01', '2026-10-31', 0);
  });
  it('un cliente inexistente no produce una compra ficticia', async () => {
    const result = await history.handle(1, '¿Cuándo fue la última compra del cliente OTRO?');
    expect(result?.reply).toContain('No encontré ese cliente');
    expect(purchases.results).not.toHaveBeenCalled();
  });
  it('una ruta revocada en configuración invalida el contexto anterior', async () => {
    const result = await history.handle(1, 'más', { active: true, route: 'S02', client, action: 3, page: 0 });
    expect(result?.reply).toContain('No tienes permiso');
    expect(purchases.results).not.toHaveBeenCalled();
  });
  it('solicita los días al elegir opción 4, sin confundirla con cuatro días', async () => {
    const result = await history.handle(1, '4', { active: true, route: 'S08' });
    expect(result?.reply).toContain('Cuántos días');
    await history.handle(1, '30', result!.context!);
    expect(purchases.results).toHaveBeenCalledWith('S08', undefined, 4, '2026-10-24', '2026-11-23', 0);
  });
  it('conserva la numeración al continuar resultados con más', async () => {
    purchases.results.mockResolvedValue([{ code: client.code, name: 'Agua demo', document: null, date: '2026-11-05',
      sku: promotion.sku, unit: 'unidad', quantity: '2.000', purchases: 2, total: 6 }]);
    const result = await history.handle(1, 'más', { active: true, route: 'S08', client, action: 3, page: 0 });
    expect(result?.reply).toContain('6) Agua demo');
    expect(result?.reply).toContain('Mostrando 6 a 6 de 6');
    expect(result?.reply).toContain('2 registros · 2 unidades');
  });
  it('consulta promociones del SQL académico sin afirmar una fecha de actualización', async () => {
    const result = await suggestions.handle(1, '¿Qué promociones aplican para el cliente DEMO001?');
    expect(repo.catalog).toHaveBeenCalledWith('2026-11-23');
    expect(result?.reply).toContain('DEMO-PROMO-1');
    expect(result?.reply).toContain('Actualización de promociones no registrada');
  });
  it('no inventa cantidades de bonificación ausentes en el esquema académico', async () => {
    const result = await suggestions.handle(1, '4', { active: true, route: 'S08', client });
    expect(result?.reply).toContain('no tienen cantidades');
    expect(repo.facts).not.toHaveBeenCalled();
  });
  it('excluye promociones vencidas y stock agotado', async () => {
    repo.catalog.mockResolvedValueOnce({ source: 'Académica', updatedAt: null, promotions: [{ ...promotion, endsOn: '2026-11-22' }] });
    expect((await suggestions.handle(1, '1', { active: true, route: 'S08', client }))?.reply).toContain('No hay promociones');
    repo.facts.mockResolvedValueOnce([{ sku: promotion.sku, purchases: 2, stock: 0 }]);
    expect((await suggestions.handle(1, '3', { active: true, route: 'S08', client }))?.reply).toContain('No hay promociones');
  });
  it('mantiene SQL y parámetros separados, usando únicamente la fuente académica', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    await new PurchaseHistoryRepository(db as never).results('S08', "X';--", 3, '2026-05-27', '2026-11-23', 0);
    expect(db.query.mock.calls[0][0]).toContain('VWchatbot_HISTORIAL_COMPRAS');
    expect(db.query.mock.calls[0][0]).not.toContain("X';--");
    expect(db.query.mock.calls[0][1][1]).toBe("X';--");
  });
  it('un fallo SQL se distingue de cero compras', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('detalle privado del proveedor')) };
    await expect(new PurchaseHistoryRepository(db as never).results('S08', 'DEMO001', 1, '2026-05-27', '2026-11-23', 0))
      .rejects.toThrow('No fue posible consultar');
  });
  it('rechaza períodos imposibles o invertidos', () => {
    expect(historyPeriod('2026-02-30', '2026-11-23')).toBeUndefined();
    expect(historyPeriod('2026-11-20 a 2026-11-01', '2026-11-23')).toBeUndefined();
  });
});
