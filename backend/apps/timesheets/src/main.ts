import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { corsOptions } from '@app/shared';
import { TimesheetsModule } from './timesheets.module';

async function bootstrap() {
  const app = await NestFactory.create(TimesheetsModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors(corsOptions());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Timesheets Service')
    .setDescription('Draft/submit timesheets and employer approve/reject/pending with remarks (doc §3.3, §4.4).')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = config.get<number>('TIMESHEETS_PORT') || 3003;
  await app.listen(port);
  console.log(`Timesheets app running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
