import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { deploymentConfig } from './deployment.config';

async function bootstrap() {
  // Validar antes de que Nest abra las conexiones de las dos bases.
  const deployment = deploymentConfig(process.env);
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Solo el frontend autorizado recibe cabeceras CORS. No concede permisos de usuario.
  app.enableCors({
    origin: deployment.origins,
  });

  const config = new DocumentBuilder()
    .setTitle('Manda API')
    .setDescription('Auth and users endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Swagger sigue disponible localmente; se desactiva por defecto en producción.
  if (deployment.swagger) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // ESCUCHAR EN RED
  await app.listen(process.env.PORT ?? 3020, '0.0.0.0');
}

bootstrap();
