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
      if (sql.includes('VWchatbot_PEDIDO_DETALLE_S4')) {
        return params[0] === '0001001' ? [{ IdPedido: '0001001', Material: 'PT990000001', NombreMaterial: 'Quartz DEMO', Unidades: 24, UndMedida: 'UN' }] : [];
      }
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
    service = new ChatService(sessions as any, messages as any, ai, moderation as any, inventory, {} as any, {} as any,
      { handle: jest.fn().mockResolvedValue(null) } as any, { handle: jest.fn().mockResolvedValue(null) } as any,
      { handle: jest.fn().mockResolvedValue(null) } as any);
  });

  it.each(['1', 'opcion 1', 'opción 1', '1) Stock'])('menu → %s pide un producto sin usar OpenAI', async (option) => {
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, option);
    expect(result.reply).toContain('Para consultar stock');
    expect(JSON.parse(session.contexto).navigation).toMatchObject({ source: 'STOCK', step: 'AWAITING_PRODUCT' });
    expect(externalCall).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.reply).toContain('Quartz agua purificada botella 600 ml');
    expect(result.reply).toContain('PT990000001');
    expect(result.reply).not.toContain('PT001022005');
  });

  it('elige un ejemplo del catálogo por número y consulta su detalle actualizado', async () => {
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '1');
    const result = await service.handleWebMessage(1, '1');
    expect(result.reply).toContain('Stock total: 135');
    expect(result.reply).toContain('120 Unids');
    expect(result.reply).toContain('15 Unids');
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('no inventa ejemplos cuando no hay productos disponibles', async () => {
    query.mockResolvedValueOnce([]);
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, '1');
    expect(result.reply).toContain('No hay productos con existencias');
    expect(result.reply).not.toContain('PT990000001');
    expect(JSON.parse(session.contexto).stockSearch.items).toBeUndefined();
  });

  it('un fallo del catálogo permite reintentar sin mostrar ejemplos inventados ni errores SQL', async () => {
    query.mockRejectedValueOnce(new Error('private SQL details'));
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, '1');
    expect(result.reply).toContain('No pude cargar los ejemplos');
    expect(result.reply).not.toContain('private SQL');
    expect(JSON.parse(session.contexto).navigation.step).toBe('AWAITING_PRODUCT');
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
    expect(result.reply).toContain('Escribe “atrás” para volver.');
    expect(externalCall).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
  it('atrás desde pedidos regresa al menú y elimina la consulta pendiente', async () => {
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '2');
    const menu = await service.handleWebMessage(1, 'atrás');
    expect(menu.reply).toContain('1) Stock disponibles');
    expect(menu.reply).not.toContain('Escribe “atrás” para volver.');
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

  it('menu → 2 → número de pedido conserva ceros y permite consultar otro número', async () => {
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '2');
    const found = await service.handleWebMessage(1, '0001001');
    expect(found.reply).toContain('Detalle del pedido 0001001');
    expect(found.reply).toContain('24 UN');
    const missing = await service.handleWebMessage(1, '9999999');
    expect(missing.reply).toContain('No encontré el pedido 9999999');
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('un identificador inválido en pedidos pide corregirlo sin llamar al proveedor', async () => {
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '2');
    const invalid = await service.handleWebMessage(1, 'pedido incorrecto');
    expect(invalid.reply).toContain('6 a 15 dígitos');
    expect(query).not.toHaveBeenCalled();
    expect(externalCall).not.toHaveBeenCalled();
    const menu = await service.handleWebMessage(1, 'menu');
    expect(menu.reply).toContain('Stock');
  });

  it('ventas por vendedor permite resolver coincidencias y elegir un mes explícito', async () => {
    const sales = (service as any).salesService;
    sales.findVendedores = jest.fn(async () => [
      { SLPRSNID: 'DEMO01', Nombre: 'Vendedor DEMO Norte' },
      { SLPRSNID: 'DEMO02', Nombre: 'Vendedor DEMO Sur' },
    ]);
    sales.getVentaNetaVendedorMes = jest.fn(async () => ({ SLPRSNID: 'DEMO02', Nombre: 'Vendedor DEMO Sur', VentaNeta: 666.60 }));
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '3');
    await service.handleWebMessage(1, '2');
    expect((await service.handleWebMessage(1, 'DEMO')).reply).toContain('Elige el vendedor');
    await service.handleWebMessage(1, '2');
    await service.handleWebMessage(1, '3');
    const result = await service.handleWebMessage(1, 'noviembre 2026');
    expect(result.reply).toContain('666.60');
    expect(sales.getVentaNetaVendedorMes).toHaveBeenCalledWith({ slprsnid: 'DEMO02', mes: 11, anio: 2026 });
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('una categoría parcial única usa el nombre real de la fuente', async () => {
    const sales = (service as any).salesService;
    sales.buscarCategorias = jest.fn(async () => [{ Categoria: 'Bebidas demo' }]);
    sales.getVentasPorCategoria = jest.fn(async () => ({ Categoria: 'Bebidas demo', VentaNeta: 100 }));
    await service.handleWebMessage(1, 'menu');
    await service.handleWebMessage(1, '3');
    await service.handleWebMessage(1, '3');
    await service.handleWebMessage(1, '1');
    await service.handleWebMessage(1, 'Bebidas');
    await service.handleWebMessage(1, '3');
    const result = await service.handleWebMessage(1, 'noviembre 2026');
    expect(result.reply).toContain('Bebidas demo');
    expect(sales.getVentasPorCategoria).toHaveBeenCalledWith(expect.objectContaining({ categoria: 'Bebidas demo', mes: 11, anio: 2026 }));
    expect(externalCall).not.toHaveBeenCalled();
  });

  it('una frase no reconocida vuelve al menú sin usar una clave externa ficticia', async () => {
    (service as any).salesService.findProductosByNombre = jest.fn(async () => []);
    await service.handleWebMessage(1, 'menu');
    const result = await service.handleWebMessage(1, 'necesito hablar sobre un tema desconocido');
    expect(result.reply).toContain('No logré identificar');
    expect(result.reply).toContain('Stock');
    expect(externalCall).not.toHaveBeenCalled();
  });
});
