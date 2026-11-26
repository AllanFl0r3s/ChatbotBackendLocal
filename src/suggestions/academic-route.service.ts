import { Injectable } from '@nestjs/common';
import { RouteAccessService } from '../route-access/route-access.service';

@Injectable()
export class AcademicRouteService {
  constructor(private readonly access: RouteAccessService) {}

  resolve(userId: number, requested?: string): Promise<string> {
    return this.access.resolve(userId, requested);
  }
}
