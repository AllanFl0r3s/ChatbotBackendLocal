import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS abierto para pruebas
  app.enableCors({
    origin: true,
  });

  console.log('CORS habilitado para todas las conexiones');

  const config = new DocumentBuilder()
    .setTitle('Manda API')
    .setDescription('Auth and users endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ESCUCHAR EN RED
  await app.listen(process.env.PORT ?? 3020, '0.0.0.0');
}

bootstrap();