import {
  BadRequestException, ForbiddenException, Injectable, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  authorizeVisitsRoute, buildVisitsResponse, parseVisitsQuery,
  VISITED_CLIENTS_SQL, visitsSqlParameters, VisitsAccessError, VisitsInputError,
} from './visits.core';
import type { VisitsDbRow } from './visits.core';

@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name);

  constructor(
    // Reutiliza la segunda conexión: PROD_DB_* o DB_*2 apuntan a DW_ISTMA.
    // No usar la conexión principal, que almacena los datos internos de CHATBOT.
    @InjectDataSource('prodConnection') private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async listClients(userId: number, rawQuery: Record<string, unknown>) {
    let query: ReturnType<typeof parseVisitsQuery>;
    try {
      query = parseVisitsQuery(rawQuery);
      // Asignación explícita en el servidor hasta definir integración con PACO.
      // Sin configuración, ninguna cuenta tiene acceso, tampoco el administrador.
      authorizeVisitsRoute(userId, query.route, this.config.get<string>('VISITS_ROUTE_ACCESS') ?? '{}');
    } catch (error) {
      if (error instanceof VisitsInputError) throw new BadRequestException(error.message);
      if (error instanceof VisitsAccessError) throw new ForbiddenException(error.message);
      throw new ServiceUnavailableException('El acceso a visitas aún no está configurado correctamente.');
    }

    try {
      const rows: VisitsDbRow[] = await this.dataSource.query(
        VISITED_CLIENTS_SQL, visitsSqlParameters(query),
      );
      return buildVisitsResponse(query, rows, new Date().toISOString());
    } catch {
      // Un fallo SQL no equivale a cero visitas: responder 503 y no fabricar resultados.
      // Evitar devolver mensajes del proveedor que expongan infraestructura o credenciales.
      this.logger.error('No se pudo consultar la fuente de registros de visita.');
      throw new ServiceUnavailableException('No fue posible consultar las visitas. Intenta más tarde.');
    }
  }
}
