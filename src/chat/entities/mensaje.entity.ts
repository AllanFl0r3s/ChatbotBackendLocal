import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Sesion } from './sesion.entity';

@Entity({ name: 'TBL_MENSAJES' })
export class Mensaje {
  @PrimaryGeneratedColumn({ name: 'ID_MENSAJES' })
  id: number;

  @Column({ name: 'Id_Sesion', type: 'int' })
  idSesion: number;

  @Column({ name: 'Id_Usuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @Column({ name: 'Remitente', type: 'nvarchar', length: 30 })
  remitente: string; // "CLIENTE" | "BOT"

  @Column({ name: 'Tipo_Mensaje', type: 'nvarchar', length: 30 })
  tipoMensaje: string; // "TEXT"

  @Column({ name: 'Contenido', type: 'nvarchar', nullable: true })
  contenido: string | null;

  @Column({ name: 'Fecha_Hora', type: 'datetime2' })
  fechaHora: Date;

  @ManyToOne(() => Sesion, (s) => s.mensajes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'Id_Sesion' })
  sesion: Sesion;
}

