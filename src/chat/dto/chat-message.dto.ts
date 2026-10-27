import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ example: 'menu' })
  @IsString()
  @MaxLength(300)
  message: string;
}