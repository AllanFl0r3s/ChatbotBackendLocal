import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ nullable: true, example: 'S01' })
  rutaCodigo?: string | null;

  @ApiProperty({ type: [String] })
  rutasAsignadas?: string[];

  @ApiProperty()
  id!: number;

  @ApiProperty()
  roleId!: number;

  @ApiProperty()
  roleName!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ required: false, nullable: true })
  usuario?: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ required: false, nullable: true })
  telefonoNumero?: string | null;

  @ApiProperty()
  estado!: boolean;

  @ApiProperty()
  fechaRegistro!: Date;

  @ApiProperty({ required: false, nullable: true })
  ultimoContacto?: Date | null;
}
