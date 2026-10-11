import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { corsOptions } from '@app/shared';
import { AuthModule } from './auth.module';
import { PORTAL_HEADER } from './apis/auth/portal';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // PORTAL_HEADER must be declared here or the browser's preflight rejects
  // every login/refresh/logout the portals send.
  app.enableCors(corsOptions([PORTAL_HEADER]));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription(
      'Login, OTP verification, password reset, and account provisioning for the Workforce Portal.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie', name: 'refresh_token' })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = config.get<number>('AUTH_PORT') || 3001;
  await app.listen(port);
  console.log(`Auth app running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
