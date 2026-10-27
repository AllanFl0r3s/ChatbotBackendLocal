import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpdatePerfilDto } from './dto/update-perfil.dto';

@Injectable()
export class PerfilService {
  constructor(private readonly dataSource: DataSource) {}

  async getPerfil() {
    const result = await this.dataSource.query(`
      SELECT TOP 1 * 
      FROM TBL_PERFIL
      ORDER BY ID ASC
    `);

    const perfil = result[0] ?? null;

    if (!perfil) {
      return null;
    }

    // Generar link directo de WhatsApp
    const whatsapp = perfil.WhatsApp || perfil.whatsapp;

    if (whatsapp) {
      let numero = whatsapp.replace(/\D/g, '');

      // Agrega código de Honduras si no existe
      if (!numero.startsWith('504')) {
        numero = `504${numero}`;
      }

      perfil.WhatsAppLink = `https://wa.me/${numero}`;
    } else {
      perfil.WhatsAppLink = null;
    }

    return perfil;
  }

  async updatePerfil(dto: UpdatePerfilDto) {
    await this.dataSource.query(
      `
      UPDATE TBL_PERFIL
      SET
        Nombre = @0,
        Telefono = @1,
        WhatsApp = @2,
        Correo = @3,
        Direccion1 = @4,
        Direccion2 = @5,
        Horario = @6,
        Imagen = @7,
        Fecha_Modificacion = SYSDATETIME()
      WHERE ID = 1
      `,
      [
        dto.nombre,
        dto.telefono,
        dto.whatsapp,
        dto.correo,
        dto.direccion1,
        dto.direccion2,
        dto.horario,
        dto.imagen,
      ],
    );

    return { message: 'Perfil actualizado correctamente' };
  }
}