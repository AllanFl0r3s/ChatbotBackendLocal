import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { authorizeVisitsRoute, VisitsAccessError } from '../visits/visits.core';

export const USER_ROUTES = Array.from({ length: 10 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);

@Injectable()
export class RouteAccessService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>, private readonly config: ConfigService) {}

  routesFor(user: User): string[] {
    if (user.rutaGestionada) {
      if (user.rutaCodigo == null) return [];
      if (!USER_ROUTES.includes(user.rutaCodigo)) throw new ServiceUnavailableException('La ruta asignada no es válida.');
      return [user.rutaCodigo];
    }
    // Conserva los accesos existentes hasta que el administrador cambie la ruta.
    const raw = this.config.get<string>('VISITS_ROUTE_ACCESS') ?? '{}';
    try {
      const routes = JSON.parse(raw)?.[String(user.id)];
      authorizeVisitsRoute(user.id, Array.isArray(routes) && routes.length ? String(routes[0]).trim().toUpperCase() : 'S01', raw);
      return routes.map((route: string) => route.trim().toUpperCase());
    } catch (error) {
      if (error instanceof VisitsAccessError) return [];
      throw new ServiceUnavailableException('La configuración de rutas no es válida.');
    }
  }

  async resolve(userId: number, requested?: string): Promise<string> {
    let user: User | null;
    try { user = await this.users.findOne({ where: { id: userId } }); }
    catch { throw new ServiceUnavailableException('No fue posible verificar la ruta asignada.'); }
    if (!user?.estado) throw new ForbiddenException('La cuenta no está disponible.');
    const routes = this.routesFor(user);
    const route = (requested ?? routes[0] ?? '').trim().toUpperCase();
    if (!route || !routes.includes(route)) throw new ForbiddenException('No tienes permiso para esa ruta o no tienes una ruta asignada.');
    return route;
  }
}
