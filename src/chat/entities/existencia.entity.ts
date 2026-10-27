import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_EXISTENCIAS' })
export class Existencia {
  @PrimaryGeneratedColumn({ name: 'ID_EXISTENCIA' })
  id: number;

  @Column({ name: 'Id_Producto', type: 'int' })
  idProducto: number;

  @Column({ name: 'Id_Bodega', type: 'int' })
  idBodega: number;

  @Column({ name: 'Stock', type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'Stock_Minimo', type: 'int', default: 0 })
  stockMinimo: number;
}
