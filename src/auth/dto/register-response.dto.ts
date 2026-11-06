import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: 'Cuenta creada. Ya puedes iniciar sesión.' })
  message!: string;
}
