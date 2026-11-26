import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { RouteAccessModule } from '../route-access/route-access.module';

// Registra el endpoint y su servicio. No crea tablas, vistas ni conexiones nuevas.
@Module({
  imports: [RouteAccessModule],
  controllers: [VisitsController],
  providers: [VisitsService],
})
export class VisitsModule {}
