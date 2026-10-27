import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'TBL_PASOS' })
export class Paso {
  @PrimaryGeneratedColumn({ name: 'ID_FLUJO' })
  id: number;

  @Column({ name: 'Nombre_Paso', type: 'nvarchar', length: 120 })
  nombrePaso: string;

  @Column({ name: 'Respuesta_Bot', type: 'nvarchar', nullable: true })
  respuestaBot: string | null;

  @Column({ name: 'Opcion_Siguiente', type: 'nvarchar', length: 120, nullable: true })
  opcionSiguiente: string | null;

  @Column({ name: 'Espera_Respuesta', type: 'bit', default: false })
  esperaRespuesta: boolean;

  @Column({ name: 'Tipo_Paso', type: 'nvarchar', length: 50, nullable: true })
  tipoPaso: string | null;
}
