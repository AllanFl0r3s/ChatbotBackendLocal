import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authorizeVisitsRoute, VisitsAccessError } from '../visits/visits.core';

@Injectable()
export class AcademicRouteService {
  constructor(private readonly config: ConfigService) {}

  resolve(userId: number, requested?: string): string {
    const raw = this.config.get<string>('VISITS_ROUTE_ACCESS') ?? '{}';
    try {
      const routes: unknown = JSON.parse(raw)?.[String(userId)];
      // La primera ruta autorizada es la principal del chat; las otras requieren indicarlas.
      const route = (requested ?? (Array.isArray(routes) ? routes[0] : '') ?? '').trim().toUpperCase();
      authorizeVisitsRoute(userId, route, raw);
      return route;
    } catch (error) {
      if (error instanceof VisitsAccessError)
        throw new ForbiddenException('No tienes permiso para esa ruta o no tienes una ruta asignada.');
      throw new ServiceUnavailableException('La configuración de rutas académicas no es válida.');
    }
  }
}
