import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'persona@example.invalid' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(150)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por correo; no es un accessToken.' })
  @IsString() @MaxLength(1500) @Matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  token: string;

  @ApiProperty({ minLength: 12, description: 'Máximo 72 bytes UTF-8, sin recortar espacios.' })
  @IsString() @MinLength(12) @IsByteLength(0, 72)
  password: string;
}
