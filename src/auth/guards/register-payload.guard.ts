import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RegisterPayloadGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const body: unknown = context.switchToHttp().getRequest().body;
    const allowed = new Set(['nombre', 'usuario', 'email', 'password']);
    // Las guardas corren antes de ValidationPipe: se rechazan campos inesperados
    // antes de que el whitelist global los borre silenciosamente.
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !allowed.has(key))) {
      throw new BadRequestException('Envía solo nombre, usuario, email y password.');
    }
    return true;
  }
}
