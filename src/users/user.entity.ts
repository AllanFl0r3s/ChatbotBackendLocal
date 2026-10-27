import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from '../roles/role.entity';

@Entity({ name: 'TBL_USUARIOS' })
export class User {
  @PrimaryGeneratedColumn({ name: 'ID_USUARIO' })
  id: number;

  @Column({ name: 'Id_Rol', type: 'int' })
  roleId: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'Id_Rol', referencedColumnName: 'id' })
  role: Role;

  @Column({ name: 'Nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'Usuario', type: 'nvarchar', length: 100, unique: true, nullable: true })
  usuario?: string | null;

  @Column({ name: 'Email', type: 'nvarchar', length: 150, unique: true })
  email: string;

  @Column({ name: 'PasswordHash', type: 'nvarchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'Telefono_numero', type: 'nvarchar', length: 20, nullable: true })
  telefonoNumero?: string | null;

  @Column({ name: 'Fecha_Registro', type: 'datetime2', nullable: false })
  fechaRegistro: Date;

  @Column({ name: 'Ultimo_Contacto', type: 'datetime2', nullable: true })
  ultimoContacto?: Date;

  @Column({ name: 'Estado', type: 'bit', default: () => '1' })
  estado: boolean;

}
