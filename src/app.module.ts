import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';

import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

import { Role } from './roles/role.entity';
import { RolesModule } from './roles/roles.module';

import { ChatModule } from './chat/chat.module';
import { PerfilModule } from './perfil/perfil.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Conserva compatibilidad con el legacy (src/.env), pero permite usar
      // la ubicacion convencional backend_chatbot/.env.
      envFilePath: ['.env', 'src/.env'],
    }),

    // ======================================================
    // CONEXIÓN PRINCIPAL CHATBOT
    // ======================================================
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const toBool = (value?: string, fallback = false) => {
          if (value === undefined || value === null) {
            return fallback;
          }

          return ['true', '1', 'yes', 'y'].includes(
            value.toLowerCase(),
          );
        };

        return {
          type: 'mssql',

          host: configService.get<string>('DB_HOST'),

          port: Number(
            configService.get<string>('DB_PORT') ?? 1433,
          ),

          username: configService.get<string>('DB_USER'),

          password: configService.get<string>('DB_PASSWORD'),

          database: configService.get<string>('DB_NAME'),

          schema:
            configService.get<string>('DB_SCHEMA') ?? undefined,

          entities: [User, Role],

          synchronize: false,

          autoLoadEntities: true,

          logging:
            configService.get<string>('DB_LOGGING') === 'true',

          options: {
            encrypt: toBool(
              configService.get<string>('DB_ENCRYPT'),
              false,
            ),

            trustServerCertificate: toBool(
              configService.get<string>(
                'DB_TRUST_SERVER_CERTIFICATE',
              ),
              true,
            ),
          },
        };
      },
    }),

    // ======================================================
    // CONEXIÓN PRODUCCIÓN / DW_ISTMA
    // ======================================================
    TypeOrmModule.forRootAsync({
      name: 'prodConnection',

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const toBool = (value?: string, fallback = false) => {
          if (value === undefined || value === null) {
            return fallback;
          }

          return ['true', '1', 'yes', 'y'].includes(
            value.toLowerCase(),
          );
        };

        const prodHost =
          configService.get<string>('PROD_DB_HOST') ||
          configService.get<string>('DB_HOST2') ||
          configService.get<string>('DB_HOSTprod') ||
          configService.get<string>('DB_HOST');

        if (!prodHost) {
          throw new Error(
            'Falta PROD_DB_HOST (o DB_HOST) en el .env',
          );
        }

        return {
          name: 'prodConnection',

          type: 'mssql',

          host: prodHost,

          port: Number(
            configService.get<string>('PROD_DB_PORT') ||
              configService.get<string>('DB_PORT2') ||
              configService.get<string>('DB_PORTprod') ||
              1433,
          ),

          username:
            configService.get<string>('PROD_DB_USER') ||
            configService.get<string>('DB_USER2') ||
            configService.get<string>('DB_USERprod') ||
            configService.get<string>('DB_USER'),

          password:
            configService.get<string>('PROD_DB_PASSWORD') ||
            configService.get<string>('DB_PASSWORD2') ||
            configService.get<string>('DB_PASSWORDprod') ||
            configService.get<string>('DB_PASSWORD'),

          database:
            configService.get<string>('PROD_DB_NAME') ||
            configService.get<string>('DB_NAME2') ||
            configService.get<string>('DB_NAMEprod') ||
            configService.get<string>('DB_NAME'),

          schema:
            configService.get<string>('PROD_DB_SCHEMA') ||
            configService.get<string>('DB_SCHEMA2') ||
            configService.get<string>('DB_SCHEMAprod') ||
            configService.get<string>('DB_SCHEMA') ||
            undefined,

          synchronize: false,

          autoLoadEntities: false,

          logging: false,

          options: {
            encrypt: toBool(
              configService.get<string>('PROD_DB_ENCRYPT') ||
                configService.get<string>('DB_ENCRYPT2') ||
                configService.get<string>('DB_ENCRYPTprod'),
              false,
            ),

            trustServerCertificate: toBool(
              configService.get<string>(
                'PROD_DB_TRUST_SERVER_CERTIFICATE',
              ) ||
                configService.get<string>(
                  'DB_TRUST_SERVER_CERTIFICATE2',
                ) ||
                configService.get<string>(
                  'DB_TRUST_SERVER_CERTIFICATEprod',
                ),
              true,
            ),
          },
        };
      },
    }),

    RolesModule,
    UsersModule,
    AuthModule,
    ChatModule,
    PerfilModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
