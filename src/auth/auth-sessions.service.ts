import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sesion } from '../chat/entities/sesion.entity';

type AccessContext = { version: 1; expiresAt: number; revokedAt: string | null };

@Injectable()
export class AuthSessionsService {
  constructor(@InjectRepository(Sesion) private readonly sessions: Repository<Sesion>) {}

  async open(userId: number, sessionId: string, expiresAt: number) {
    const now = new Date();
    const context: AccessContext = { version: 1, expiresAt, revokedAt: null };
    try {
      // AUTH usa registros propios. Nunca reutiliza ni sobrescribe conversaciones WEB/WHATSAPP.
      await this.sessions.save(this.sessions.create({ idUsuario: userId, canal: 'AUTH',
        canalRef: sessionId, fechaInicio: now, ultimaActividad: now,
        contexto: JSON.stringify(context) }));
    } catch {
      // No devolver el JWT si no se pudo persistir su sesión.
      throw new ServiceUnavailableException('No fue posible abrir la sesión. Intenta más tarde.');
    }
  }

  async assertActive(userId: number, sessionId: string, expiresAt: number) {
    let row: Sesion | null;
    try {
      row = await this.sessions.findOne({
        where: { idUsuario: userId, canal: 'AUTH', canalRef: sessionId }, order: { id: 'DESC' },
      });
    } catch { throw new ServiceUnavailableException('No fue posible comprobar la sesión.'); }
    let context: AccessContext | undefined;
    try { context = JSON.parse(row?.contexto ?? 'null') ?? undefined; } catch { /* Denegar si está dañado. */ }
    if (!row || context?.version !== 1 || context.revokedAt !== null
      || context.expiresAt !== expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException();
    }
  }

  async revoke(userId: number, sessionId: string, expiresAt: number) {
    const now = new Date();
    const context: AccessContext = { version: 1, expiresAt, revokedAt: now.toISOString() };
    try {
      // Identidad y sesión proceden exclusivamente del JWT validado, nunca del cuerpo del cliente.
      await this.sessions.update({ idUsuario: userId, canal: 'AUTH', canalRef: sessionId },
        { contexto: JSON.stringify(context), ultimaActividad: now });
      // Dos cierres ya autorizados y concurrentes son seguros; no se reabre la sesión.
    } catch { throw new ServiceUnavailableException('No fue posible cerrar la sesión. Reintenta.'); }
  }
}
