import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PerfilService } from './perfil.service';
import { UpdatePerfilDto } from './dto/update-perfil.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Get()
  async getPerfil() {
    return this.perfilService.getPerfil();
  }

  @Put()
  async updatePerfil(@Req() req, @Body() dto: UpdatePerfilDto) {
    if (req.user.roleId !== 1) {
      throw new ForbiddenException('No autorizado');
    }

    return this.perfilService.updatePerfil(dto);
  }
}