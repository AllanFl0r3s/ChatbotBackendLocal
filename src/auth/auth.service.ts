import { Injectable, UnauthorizedException, ForbiddenException, ConflictException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
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

    if (!user.estado || !user.role?.estado) {
      throw new ForbiddenException('Cuenta o rol inactivo');
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

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    try {
      // Siempre se comprueba el rol de la instalación académica, no uno elegido por el cliente.
      const role = await this.rolesRepository.findOne({ where: { id: 2 } });
      if (!role || !role.estado || role.nombre.trim().toUpperCase() !== 'USUARIO') {
        throw new ServiceUnavailableException('El registro de usuarios no está disponible.');
      }
      const identifiers = [dto.email, dto.usuario];
      const existing = await this.usersRepository.createQueryBuilder('user')
        .where('LOWER(user.email) IN (:...identifiers)', { identifiers })
        .orWhere('LOWER(user.usuario) IN (:...identifiers)', { identifiers })
        .getOne();
      if (existing) throw new ConflictException('El correo o usuario no está disponible.');

      const passwordHash = await bcrypt.hash(dto.password, 12);
      // Asignación explícita: no propagar dto con spread hacia una entidad privilegiada.
      const user = this.usersRepository.create({
        nombre: dto.nombre, usuario: dto.usuario, email: dto.email,
        passwordHash, roleId: 2, role, estado: true, fechaRegistro: new Date(),
      });
      await this.usersRepository.save(user);
      // Registrarse no crea un JWT ni expone el hash: se inicia sesión por el flujo normal.
      return { message: 'Cuenta creada. Ya puedes iniciar sesión.' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // El índice UNIQUE es la protección final si dos registros compiten.
      const failure = error as { number?: number; driverError?: {
        number?: number; originalError?: { info?: { number?: number } };
      } };
      const sqlNumber = failure?.driverError?.number
        ?? failure?.driverError?.originalError?.info?.number ?? failure?.number;
      if (sqlNumber === 2601 || sqlNumber === 2627) {
        throw new ConflictException('El correo o usuario no está disponible.');
      }
      throw new ServiceUnavailableException('No fue posible crear la cuenta. Intenta más tarde.');
    }
  }
}