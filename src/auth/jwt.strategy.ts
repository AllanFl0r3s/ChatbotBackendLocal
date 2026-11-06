import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { credentialVersion } from './credential-version';

type JwtPayload = { sub: number; purpose?: string; credentialVersion?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'), algorithms: ['HS256'] });
  }

  async validate(payload: JwtPayload) {
    if (payload.purpose !== 'access' || !Number.isSafeInteger(payload.sub)) {
      throw new UnauthorizedException();
    }
    // Permisos y estado vigentes: no confiar en el rol que traiga un JWT antiguo.
    const user = await this.users.findOne({ where: { id: payload.sub }, relations: ['role'] });
    if (!user?.estado || !user.role?.estado || !user.passwordHash
      || payload.credentialVersion !== credentialVersion(user.passwordHash,
        this.config.getOrThrow<string>('JWT_SECRET'))) throw new UnauthorizedException();
    return { userId: user.id, username: user.usuario, roleId: user.roleId };
  }
}
