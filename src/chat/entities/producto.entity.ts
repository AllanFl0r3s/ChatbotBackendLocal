import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_PRODUCTOS' })
export class Producto {
  @PrimaryGeneratedColumn({ name: 'ID_PRODUCTO' })
  id: number;

  @Column({ name: 'SKU', type: 'nvarchar', length: 50 })
  sku: string;

  @Column({ name: 'Id_categoria', type: 'int' })
  idCategoria: number;

  @Column({ name: 'Nombre', type: 'nvarchar', length: 200 })
  nombre: string;

  @Column({ name: 'Descripcion', type: 'nvarchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ name: 'Precio_Base', type: 'decimal', precision: 18, scale: 2, default: 0 })
  precioBase: number;

  @Column({ name: 'Estado_Producto', type: 'bit', default: true })
  estado: boolean;
}
