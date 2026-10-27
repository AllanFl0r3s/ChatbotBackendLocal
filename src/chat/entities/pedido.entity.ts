import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_PEDIDOS' })
export class Pedido {
  @PrimaryGeneratedColumn({ name: 'ID_PEDIDOS' })
  id: number;

  @Column({ name: 'Id_Cliente', type: 'int' })
  idCliente: number;

  @Column({ name: 'Id_Usuario', type: 'int' })
  idUsuario: number;

  @Column({ name: 'Estado_Pedido', type: 'nvarchar', length: 30, default: 'BORRADOR' })
  estadoPedido: string;

  @Column({ name: 'Total', type: 'decimal', precision: 18, scale: 2, default: 0 })
  total: number;

  @Column({ name: 'Fecha_Pedido', type: 'datetime2', default: () => 'SYSDATETIME()' })
  fechaPedido: Date;

}
