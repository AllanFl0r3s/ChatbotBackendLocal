import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthSessionsService } from './auth-sessions.service';
import { credentialVersion } from './credential-version';

type JwtPayload = { sub: number; purpose?: string; credentialVersion?: string; sid?: string; exp?: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly sessions: AuthSessionsService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'), algorithms: ['HS256'] });
  }

  async validate(payload: JwtPayload) {
    if (payload.purpose !== 'access' || !Number.isSafeInteger(payload.sub)
      || typeof payload.sid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sid)
      || !Number.isSafeInteger(payload.exp)) {
      throw new UnauthorizedException();
    }
    // Permisos y estado vigentes: no confiar en el rol que traiga un JWT antiguo.
    const user = await this.users.findOne({ where: { id: payload.sub }, relations: ['role'] });
    if (!user?.estado || !user.role?.estado || !user.passwordHash
      || payload.credentialVersion !== credentialVersion(user.passwordHash,
        this.config.getOrThrow<string>('JWT_SECRET'))) throw new UnauthorizedException();
    await this.sessions.assertActive(user.id, payload.sid!, payload.exp!);
    return { userId: user.id, username: user.usuario, roleId: user.roleId,
      sessionId: payload.sid!, expiresAt: payload.exp! };
  }
}
