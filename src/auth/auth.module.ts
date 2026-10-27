import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';


@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresInRaw =
          configService.get<string>('JWT_EXPIRATION') ??
          configService.get<string>('JWT_EXPIRES_IN');
        let expiresIn: string | number;

        if (expiresInRaw) {
          const parsed = Number(expiresInRaw);
          expiresIn =
            Number.isFinite(parsed) && expiresInRaw.trim() === String(parsed)
              ? parsed
              : expiresInRaw.trim();
        } else {
          expiresIn = 3600;
        }
        const signOptions = {
          expiresIn,
        } as JwtModuleOptions['signOptions'];
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions,
        };
      },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
