import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

// Registra el endpoint y su servicio. No crea tablas, vistas ni conexiones nuevas.
@Module({
  controllers: [VisitsController],
  providers: [VisitsService],
})
export class VisitsModule {}
