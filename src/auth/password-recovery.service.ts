import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { credentialVersion } from './credential-version';
import { RecoveryMailService } from './recovery-mail.service';

const invalid = () => new BadRequestException('El enlace es inválido, ya se utilizó o venció. Solicita otro.');

@Injectable()
export class PasswordRecoveryService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService, private readonly mail: RecoveryMailService) {}

  async forgot(email: string) {
    const { secret } = this.mail.configuration();
    const user = await this.users.createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role').where('LOWER(user.email) = :email', { email }).getOne();
    if (user?.estado && user.role?.estado && user.passwordHash) {
      const token = this.jwt.sign({ sub: user.id, purpose: 'password-reset',
        credentialVersion: credentialVersion(user.passwordHash, secret) },
      { secret, algorithm: 'HS256', expiresIn: '15m', audience: 'password-reset', jwtid: randomUUID() });
      await this.mail.send(user.email, token);
    }
    // Mismo mensaje para correos inexistentes e inactivos: no enumerar cuentas.
    return { message: 'Si el correo corresponde a una cuenta activa, recibirás un enlace de recuperación.' };
  }

  async reset(token: string, password: string) {
    const { secret } = this.mail.configuration();
    let claims: { sub: number; purpose: string; credentialVersion: string };
    try {
      claims = this.jwt.verify(token, { secret, algorithms: ['HS256'], audience: 'password-reset' });
    } catch { throw invalid(); }
    if (claims.purpose !== 'password-reset' || !Number.isSafeInteger(claims.sub)) throw invalid();
    const user = await this.users.findOne({ where: { id: claims.sub }, relations: ['role'] });
    if (!user?.estado || !user.role?.estado || !user.passwordHash
      || claims.credentialVersion !== credentialVersion(user.passwordHash, secret)) throw invalid();
    if (await bcrypt.compare(password, user.passwordHash)) {
      throw new BadRequestException('Elige una contraseña distinta de la actual.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // Comparación y cambio atómicos en SQL: dos usos simultáneos no pueden ganar.
    // La intercalación binaria evita comparar hashes sensibles a mayúsculas con reglas CI.
    const changed = await this.users.createQueryBuilder().update(User).set({ passwordHash })
      .where('[ID_USUARIO] = :id AND [Estado] = 1', { id: user.id })
      .andWhere('[PasswordHash] COLLATE Latin1_General_100_BIN2 = :previous', { previous: user.passwordHash })
      .execute();
    if (changed.affected !== 1) throw invalid();
    // No iniciar sesión automáticamente. Los JWT y enlaces anteriores ya no coinciden.
    return { message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' };
  }
}
