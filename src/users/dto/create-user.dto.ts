import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  roleId!: number;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: 'juan123' })
  @IsString()
  @MaxLength(100)
  usuario!: string;

  @ApiProperty({ example: 'usuario@correo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @ApiPropertyOptional({ example: '9999-9999', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoNumero?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}