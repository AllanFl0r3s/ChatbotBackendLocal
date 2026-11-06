import { Body, Controller, HttpCode, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-recovery.dto';
import { PasswordRecoveryService } from './password-recovery.service';
import { RecoveryRateGuard } from './guards/recovery-rate.guard';
import { AuthSessionsService } from './auth-sessions.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterPayloadGuard } from './guards/register-payload.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService,
    private readonly recovery: PasswordRecoveryService,
    private readonly sessions: AuthSessionsService) {}

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidar únicamente la sesión autenticada actual' })
  @ApiResponse({ status: 204, description: 'Sesión invalidada en SQL' })
  @ApiResponse({ status: 401, description: 'Sesión inválida, vencida o cerrada' })
  @ApiResponse({ status: 503, description: 'No se pudo confirmar el cierre' })
  async logout(@Req() request: { user: { userId: number; sessionId: string; expiresAt: number } }) {
    await this.sessions.revoke(request.user.userId, request.user.sessionId, request.user.expiresAt);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(RecoveryRateGuard)
  @ApiOperation({ summary: 'Solicitar enlace de recuperación por correo (15 minutos)' })
  forgot(@Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ForgotPasswordDto) {
    return this.recovery.forgot(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(RecoveryRateGuard)
  @ApiOperation({ summary: 'Cambiar contraseña con enlace de recuperación de un solo uso' })
  reset(@Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ResetPasswordDto) {
    return this.recovery.reset(dto.token, dto.password);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with Email and password' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('register')
  @UseGuards(RegisterPayloadGuard)
  @ApiOperation({ summary: 'Crear una cuenta de usuario, sin permisos administrativos ni rutas asignadas' })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o campos no permitidos' })
  @ApiResponse({ status: 409, description: 'Correo o usuario no disponible' })
  @ApiResponse({ status: 503, description: 'No se pudo completar el registro' })
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }
}
