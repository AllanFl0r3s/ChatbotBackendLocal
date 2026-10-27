import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Mensaje } from './mensaje.entity';

@Entity({ name: 'TBL_SESIONES' })
export class Sesion {
  @PrimaryGeneratedColumn({ name: 'ID_SESION' })
  id!: number;

  @Column({ name: 'Id_Usuario', type: 'int', nullable: true })
  idUsuario!: number | null;

  @Column({ name: 'Fecha_Inicio', type: 'datetime2' })
  fechaInicio!: Date;

  @Column({ name: 'Ultima_Actividad', type: 'datetime2' })
  ultimaActividad!: Date;

  @Column({ name: 'Contexto', type: 'nvarchar', nullable: true })
  contexto!: string | null;

  @Column({ name: 'Canal', type: 'nvarchar', length: 20 })
  canal!: string;

  @Column({ name: 'CanalRef', type: 'nvarchar', length: 100 })
  canalRef!: string;

  @OneToMany(() => Mensaje, (m) => m.sesion)
  mensajes!: Mensaje[];
}