import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_CATEGORIAS' })
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'ID_CATEGORIA' })
  id: number;

  @Column({ name: 'Nombre', type: 'nvarchar', length: 120 })
  nombre: string;

  @Column({ name: 'Descripcion', type: 'nvarchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ name: 'Estado_categoria', type: 'bit', default: true })
  estado: boolean;
}
