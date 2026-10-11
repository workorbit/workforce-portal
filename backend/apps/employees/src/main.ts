import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { corsOptions } from '@app/shared';
import { EmployeesModule } from './employees.module';

async function bootstrap() {
  const app = await NestFactory.create(EmployeesModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors(corsOptions());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Employees Service')
    .setDescription('Employee directory, create/edit, and active/inactive status (doc §3.1-3.2).')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = config.get<number>('EMPLOYEES_PORT') || 3002;
  await app.listen(port);
  console.log(`Employees app running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
