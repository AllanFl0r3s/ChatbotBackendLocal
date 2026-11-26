import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'S01', nullable: true })
  @IsOptional()
  @IsIn(['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10'])
  rutaCodigo?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  roleId?: number;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  // 👇 NUEVO
  @ApiPropertyOptional({ example: 'juan123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  usuario?: string;

  @ApiPropertyOptional({ example: 'usuario@correo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'P@ssw0rd' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password?: string;

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
