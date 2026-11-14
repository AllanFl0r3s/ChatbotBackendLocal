import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('message')
  @ApiOperation({ summary: 'Chat Web (JWT)' })
  async message(@Req() req: any, @Body() dto: ChatMessageDto) {
    const userId = Number(req.user?.userId);

    if (!Number.isFinite(userId)) {
      throw new BadRequestException('JWT inválido: userId no encontrado.');
    }

    const text = (dto?.message ?? '').toString().trim();

    if (!text) {
      throw new BadRequestException('message es requerido');
    }

    if (text.length > 300) {
      throw new BadRequestException(
        'El mensaje no puede exceder 300 caracteres.',
      );
    }

    try {
      return await this.chatService.handleWebMessage(userId, text);
    } catch (error) {
      if (error instanceof Error && error.name === 'QueryFailedError') {
        throw new ServiceUnavailableException(
          'No fue posible consultar los datos. Intenta de nuevo; si persiste, informa al administrador.',
        );
      }
      throw error;
    }
  }
}
