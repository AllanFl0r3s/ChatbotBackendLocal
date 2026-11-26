import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateUserDto {
  @ApiPropertyOptional({ example: 'S01', nullable: true })
  @IsOptional()
  @IsIn(['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10'])
  rutaCodigo?: string | null;

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
