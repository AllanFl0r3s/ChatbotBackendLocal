import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_ROLES' })
export class Role {
  @PrimaryGeneratedColumn({ name: 'ID_ROL' })
  id!: number;

  @Column({ name: 'Nombre', type: 'nvarchar', length: 100 })
  nombre!: string;

  @Column({ name: 'Descripcion', type: 'nvarchar', length: 255, nullable: true })
  descripcion?: string | null;

  @Column({ name: 'Estado_Rol', type: 'bit', default: () => '1' })
  estado!: boolean;

  @Column({ name: 'Fecha_Creacion', type: 'datetime2' })
  fechaCreacion!: Date;
}