import { ChatService } from './chat.service';

describe('Ayuda para volver en todas las opciones', () => {
  const hint = 'Escribe “atrás” para volver.';
  function setup(result: { reply: string; followUp?: string; nextFlowId: number }) {
    const chat = Object.create(ChatService.prototype) as any;
    Object.assign(chat, { MENU_PRINCIPAL: 'Menú principal', MENU_OPCIONES: 'Opciones',
      politeReplies: ['Con gusto.'], resolveReplyContentFromDb: jest.fn().mockResolvedValue(result) });
    return chat;
  }
  it.each(['stock', 'pedidos', 'ventas', 'proyecciones', 'notas de crédito', 'promociones'])(
    'añade la indicación a %s', async option => {
      const chat = setup({ reply: `Consulta de ${option}`, nextFlowId: 0 });
      const result = await chat.resolveReplyFromDb({}, option);
      expect(result.reply).toBe(`Consulta de ${option}\n\n${hint}`);
    });
  it('coloca la indicación al final cuando hay un segundo mensaje', async () => {
    const chat = setup({ reply: 'Resultado', followUp: '¿Qué deseas hacer?', nextFlowId: 0 });
    const result = await chat.resolveReplyFromDb({}, 'stock');
    expect(result.reply).toBe('Resultado');
    expect(result.followUp).toBe(`¿Qué deseas hacer?\n\n${hint}`);
  });
  it.each(['Menú principal', 'Opciones', 'Con gusto.'])(
    'omite la indicación en %s', async reply => {
      const chat = setup({ reply, nextFlowId: 0 });
      expect((await chat.resolveReplyFromDb({}, 'menu')).reply).toBe(reply);
    });
  it('no repite la indicación cuando un flujo vuelve a pasar por el enrutador', async () => {
    const chat = setup({ reply: `Consulta\n\n${hint}`, nextFlowId: 0 });
    expect((await chat.resolveReplyFromDb({}, 'stock')).reply.match(/Escribe/g)).toHaveLength(1);
  });
});
