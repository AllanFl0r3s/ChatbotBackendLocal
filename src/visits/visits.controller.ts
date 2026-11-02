import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VisitsService } from './visits.service';

@ApiTags('visits')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('visits')
export class VisitsController {
  // NestJS entrega una instancia del servicio; el controller no ejecuta SQL.
  constructor(private readonly visitsService: VisitsService) {}

  @Get('clients')
  @ApiOperation({ summary: 'Clientes con registros de visita por ruta y fecha' })
  @ApiQuery({ name: 'route', required: true, example: 'S08' })
  @ApiQuery({ name: 'date', required: true, example: '2026-11-02' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 50 })
  listClients(@Req() req: any, @Query() query: Record<string, unknown>) {
    // req.user lo establece JwtStrategy después de verificar la firma del token.
    return this.visitsService.listClients(Number(req.user?.userId), query);
  }
}
