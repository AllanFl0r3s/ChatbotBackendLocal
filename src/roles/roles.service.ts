import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  findAll() {
    return this.rolesRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number) {
    const rol = await this.rolesRepository.findOne({
      where: { id },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    return rol;
  }

  async create(body: {
    nombre?: string;
    descripcion?: string | null;
    estado?: boolean;
  }) {
    const nombre = body.nombre?.trim();

    if (!nombre) {
      throw new BadRequestException('El nombre del rol es obligatorio');
    }

    const existe = await this.rolesRepository.findOne({
      where: { nombre },
    });

    if (existe) {
      throw new BadRequestException('Ya existe un rol con ese nombre');
    }

    const nuevoRol = this.rolesRepository.create({
      nombre,
      descripcion: body.descripcion?.trim() || null,
      estado: body.estado ?? true,
      fechaCreacion: new Date(),
    });

    return this.rolesRepository.save(nuevoRol);
  }

  async update(
    id: number,
    body: {
      nombre?: string;
      descripcion?: string | null;
      estado?: boolean;
    },
  ) {
    const rol = await this.findOne(id);

    const esAdmin = this.esRolAdministrador(rol);

    if (esAdmin && body.nombre !== undefined) {
      const nuevoNombre = body.nombre.trim();

      if (nuevoNombre.toLowerCase() !== rol.nombre.toLowerCase()) {
        throw new BadRequestException(
          'No se puede cambiar el nombre del rol administrador',
        );
      }
    }

    if (esAdmin && body.estado === false) {
      throw new BadRequestException(
        'No se puede desactivar el rol administrador',
      );
    }

    if (body.nombre !== undefined) {
      const nombre = body.nombre.trim();

      if (!nombre) {
        throw new BadRequestException('El nombre del rol es obligatorio');
      }

      const existe = await this.rolesRepository.findOne({
        where: {
          nombre,
          id: Not(id),
        },
      });

      if (existe) {
        throw new BadRequestException('Ya existe otro rol con ese nombre');
      }

      rol.nombre = nombre;
    }

    if (body.descripcion !== undefined) {
      rol.descripcion = body.descripcion?.trim() || null;
    }

    if (body.estado !== undefined) {
      rol.estado = body.estado;
    }

    return this.rolesRepository.save(rol);
  }

  async remove(id: number) {
    const rol = await this.findOne(id);

    if (this.esRolAdministrador(rol)) {
      throw new BadRequestException(
        'No se puede eliminar el rol administrador',
      );
    }

    await this.rolesRepository.remove(rol);

    return {
      message: 'Rol eliminado correctamente',
    };
  }

  private esRolAdministrador(rol: Role): boolean {
    return (
      rol.id === 1 ||
      rol.nombre?.trim().toLowerCase() === 'administrador'
    );
  }
}