import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const trimmed = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const normalized = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;

// Solo datos de la persona. Rol, estado, hash e identificador no forman parte del contrato.
export class RegisterDto {
  @ApiProperty({ example: 'Persona de demostración', minLength: 2, maxLength: 150 })
  @Transform(trimmed)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: 'usuario.demo', minLength: 3, maxLength: 50 })
  @Transform(normalized)
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{2,49}$/, { message: 'El usuario debe tener de 3 a 50 letras, números, puntos, guiones o guiones bajos.' })
  usuario!: string;

  @ApiProperty({ example: 'persona@example.invalid', maxLength: 150 })
  @Transform(normalized)
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(150)
  email!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 72 })
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres.' })
  // bcrypt limita por bytes, no por caracteres: evita truncamiento con texto Unicode.
  @IsByteLength(0, 72, { message: 'La contraseña es demasiado larga.' })
  password!: string;
}
