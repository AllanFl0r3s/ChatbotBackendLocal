import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class RecoveryRateGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();
    for (const [key, item] of this.attempts) if (item.until <= now) this.attempts.delete(key);
    // IP del socket, nunca X-Forwarded-For no verificado. Detrás de proxy es un límite compartido.
    const keys = [`ip:${request.socket.remoteAddress ?? 'unknown'}`];
    if (typeof request.body?.email === 'string') keys.push('email:' + createHash('sha256')
      .update(request.body.email.trim().toLowerCase()).digest('hex'));
    for (const key of keys) {
      const limit = key.startsWith('email:') ? 3 : 20;
      const item = this.attempts.get(key);
      if ((item?.count ?? 0) >= limit || (!item && this.attempts.size >= 10000)) {
        throw new HttpException('Demasiados intentos. Espera 15 minutos.', 429);
      }
    }
    for (const key of keys) {
      const item = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
      item.count++; this.attempts.set(key, item);
    }
    return true;
  }
}
