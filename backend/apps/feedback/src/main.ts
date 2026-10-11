import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { corsOptions } from '@app/shared';
import { FeedbackAppModule } from './feedback.module';

async function bootstrap() {
  const app = await NestFactory.create(FeedbackAppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors(corsOptions());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Feedback Service')
    .setDescription('Employee concerns/issues, status tracking, and employer replies (doc §3.6, §4.6).')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = config.get<number>('FEEDBACK_PORT') || 3005;
  await app.listen(port);
  console.log(`Feedback app running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
