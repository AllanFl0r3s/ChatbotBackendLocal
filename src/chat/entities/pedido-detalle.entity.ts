import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_PEDIDO_DETALLE' })
export class PedidoDetalle {
  @PrimaryGeneratedColumn({ name: 'ID_PEDIDO_DETALLE' })
  id: number;

  @Column({ name: 'Id_Pedido', type: 'int' })
  idPedido: number;

  @Column({ name: 'Id_Producto', type: 'int' })
  idProducto: number;

  @Column({ name: 'Cantidad', type: 'int', default: 1 })
  cantidad: number;

  @Column({ name: 'Precio', type: 'decimal', precision: 18, scale: 2, default: 0 })
  precio: number;

  @Column({ name: 'Subtotal', type: 'decimal', precision: 18, scale: 2, default: 0 })
  subtotal: number;
}
