import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  private toResponse(user: User) {
    return {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role?.nombre ?? '',
      telefonoNumero: user.telefonoNumero,
      fechaRegistro: user.fechaRegistro,
      ultimoContacto: user.ultimoContacto,
      estado: user.estado,
    };
  }

  private async validateUser(identifier: string, password: string): Promise<User> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const user = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.email) = :identifier', {
        identifier: normalizedIdentifier,
      })
      .orWhere('LOWER(user.usuario) = :identifier', {
        identifier: normalizedIdentifier,
      })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!user.estado) {
      throw new ForbiddenException('Usuario inactivo');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return user;
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(dto.identifier, dto.password);

    const payload = {
      sub: user.id,
      email: user.email,
      usuario: user.usuario,
      roleId: user.roleId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toResponse(user),
    };
  }
}