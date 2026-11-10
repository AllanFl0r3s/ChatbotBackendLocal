import { ChatService } from './chat.service';
import { InventoryService } from './inventory.service';
import { OpenAiService } from './openai.service';

describe('Chat: navegación numérica sin clasificador externo', () => {
  let service: ChatService;
  let session: any;
  let externalCall: jest.Mock;
  let query: jest.Mock;

  beforeEach(() => {
    session = undefined;
    const sessions = {
      findOne: jest.fn(async () => session),
      create: jest.fn((value?: any) => value ?? {}),
      save: jest.fn(async (value: any) => {
        session = value;
        session.id ??= 1;
        return session;
      }),
    };
    const messages = {
      create: jest.fn((value: any) => value),
      save: jest.fn(async (value: any) => value),
    };

    // Un fallo si se intenta usar IA deja visible cualquier regresión del menú.
    const ai = new OpenAiService({ get: () => 'clave-ficticia-para-pruebas' } as any);
    externalCall = jest.fn().mockRejectedValue(new Error('El menú no debe llamar a OpenAI'));
    (ai as any).client.responses.create = externalCall;

    query = jest.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('VW_STOCK_S4_PRODUCTO_CENTRO')) {
        if (params[0] !== 'PT990000001') return [];
        return [
          { CodigoS4: 'PT990000001', Nombre: 'Quartz agua purificada botella 600 ml',
            Centro: 'DEMO-CENTRAL', CentroNom: 'Bodega central ficticia', Zona: 'DEMOSTRACION', StockTotal: 120 },
          { CodigoS4: 'PT990000001', Nombre: 'Quartz agua purificada botella 600 ml',
            Centro: 'DEMO-RUTA', CentroNom: 'Bodega de ruta ficticia', Zona: 'DEMOSTRACION', StockTotal: 15 },
        ];
      }
      if (!sql.includes('VWchatbot_STOCK_S4_PRODUCTO')) throw new Error('Fuente SQL inesperada');
      return [{ CodigoS4: 'PT990000001', Nombre: 'Quartz agua purificada botella 600 ml', StockTotal: 135 }];
    });
    const inventory = new InventoryService({} as any, { query } as any);
    const moderation = { isAllowedText: jest.fn().mockRejectedValue(new Error('Moderación externa inesperada')) };
    service = new ChatService(sessions as any, messages as any, ai, moderation as any, inventory, {} as any, {} as any);
  });

  it.each(['1', 'opcion 1', 'opción 1', '1) Stock'])('menu → %s pide un producto sin usar OpenAI', async (option) => {
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, option);
    expect(result.reply).toContain('Para consultar stock');
    expect(JSON.parse(session.contexto).navigation).toMatchObject({ source: 'STOCK', step: 'AWAITING_PRODUCT' });
    expect(externalCall).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('menu → 1 → producto → 1 conserva la selección del listado de stock', async () => {
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '1');
    const list = await service.handleWebMessage(1, 'Quartz 600ml');
    expect(list.reply).toContain('PT990000001');
    const detail = await service.handleWebMessage(1, '1');
    expect(detail.reply).toContain('Stock total: 135');
    expect(detail.reply).toContain('120 Unids');
    expect(detail.reply).toContain('15 Unids');
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('seleccionar 1 desde una búsqueda directa mantiene el contexto del producto', async () => {
    await service.handleWebMessage(1, 'stock de quartz 600ml');
    const result = await service.handleWebMessage(1, '1');
    expect(result.reply).toContain('Stock total: 135');
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('la marca Quartz sin dígitos se busca por nombre tras elegir stock', async () => {
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '1');
    const result = await service.handleWebMessage(1, 'Quartz');
    expect(result.reply).toContain('Resultados');
    expect(result.reply).toContain('PT990000001');
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('menu → 2 pide el número de pedido sin usar IA ni consultar SQL comercial', async () => {
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, '2');
    expect(result.reply).toContain('número de pedido');
    expect(externalCall).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('menu → 3 abre el submenú de ventas sin usar IA', async () => {
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, '3');
    expect(result.reply).toContain('¿Qué deseas consultar de ventas?');
    expect(externalCall).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
