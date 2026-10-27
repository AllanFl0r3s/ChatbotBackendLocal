import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      roleId: user.roleId,
      roleName: user.role?.nombre ?? '',
      nombre: user.nombre,
      usuario: user.usuario ?? null,
      email: user.email,
      telefonoNumero: user.telefonoNumero ?? null,
      estado: user.estado,
      fechaRegistro: user.fechaRegistro,
      ultimoContacto: user.ultimoContacto ?? null,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeUsuario(usuario: string): string {
    return usuario.trim().toLowerCase();
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      relations: { role: true },
    });

    return users.map((u) => this.toResponse(u));
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const usuario = this.normalizeUsuario(dto.usuario);

    const existing = await this.usersRepository.findOne({
      where: [{ email }, { usuario }],
    });

    if (existing) {
      throw new ConflictException('Email or username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      roleId: dto.roleId,
      nombre: dto.nombre,
      usuario,
      email,
      passwordHash,
      telefonoNumero: dto.telefonoNumero ?? null,
      estado: dto.estado ?? true,
      fechaRegistro: new Date(),
    });

    const saved = await this.usersRepository.save(user);

    const savedWithRole = await this.usersRepository.findOne({
      where: { id: saved.id },
      relations: { role: true },
    });

    return this.toResponse(savedWithRole ?? saved);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.nombre !== undefined) {
      user.nombre = dto.nombre;
    }

    if (dto.usuario !== undefined) {
      const usuario = this.normalizeUsuario(dto.usuario);

      if (usuario !== (user.usuario ?? '').toLowerCase()) {
        const existing = await this.usersRepository.findOne({
          where: { usuario },
        });

        if (existing && existing.id !== user.id) {
          throw new ConflictException('Username already exists');
        }
      }

      user.usuario = usuario;
    }

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);

      if (email !== user.email.toLowerCase()) {
        const existing = await this.usersRepository.findOne({
          where: { email },
        });

        if (existing && existing.id !== user.id) {
          throw new ConflictException('Email already exists');
        }
      }

      user.email = email;
    }

    if (dto.password !== undefined && dto.password.trim() !== '') {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.roleId !== undefined) {
      user.roleId = dto.roleId;
    }

    if (dto.telefonoNumero !== undefined) {
      user.telefonoNumero = dto.telefonoNumero ?? null;
    }

    if (dto.estado !== undefined) {
      user.estado = dto.estado;
    }

    await this.usersRepository.save(user);

    const updatedWithRole = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });

    return this.toResponse(updatedWithRole ?? user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.remove(user);
  }
}