import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController: indisponibilidad de datos', () => {
  const request = { user: { userId: 1 } };

  it('no expone SQL ni responde éxito cuando falta una fuente', async () => {
    const error = new Error('Invalid object name private_table');
    error.name = 'QueryFailedError';
    const controller = new ChatController({
      handleWebMessage: jest.fn().mockRejectedValue(error),
    } as unknown as ChatService);
    await expect(controller.message(request, { message: 'promociones' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.message(request, { message: 'promociones' })).rejects.not.toThrow(
      'private_table',
    );
  });

  it('conserva los errores de validación del servicio', async () => {
    const error = new BadRequestException('Consulta inválida');
    const controller = new ChatController({
      handleWebMessage: jest.fn().mockRejectedValue(error),
    } as unknown as ChatService);
    await expect(controller.message(request, { message: 'stock' })).rejects.toBe(error);
  });
});
