import { InventoryService } from './inventory.service';

describe('Ejemplos disponibles desde inventario', () => {
  it('consulta la vista de stock, limita la muestra y descarta filas no utilizables', async () => {
    const query = jest.fn().mockResolvedValue([
      { CodigoS4: ' PT990000001 ', Nombre: ' Quartz 600 ml ', StockTotal: '135' },
      { CodigoS4: 'PT990000002', Nombre: 'Sin stock', StockTotal: 0 },
      { CodigoS4: 'PT990000003', Nombre: '', StockTotal: 10 },
      { CodigoS4: '123', Nombre: 'Código no permitido', StockTotal: 5 },
    ]);
    const inventory = new InventoryService({} as any, { query } as any);
    expect(await inventory.findAvailableExamples()).toEqual([
      { CodigoS4: 'PT990000001', Nombre: 'Quartz 600 ml', StockTotal: 135 },
    ]);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('TOP (6)');
    expect(sql).toContain('VWchatbot_STOCK_S4_PRODUCTO');
    expect(sql).toContain('StockTotal > 0');
    expect(sql).toContain('ORDER BY Nombre, CodigoS4');
  });
});
