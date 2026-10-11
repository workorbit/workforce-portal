import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { corsOptions } from '@app/shared';
import { PayrollAppModule } from './payroll.module';

async function bootstrap() {
  const app = await NestFactory.create(PayrollAppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors(corsOptions());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Payroll Service')
    .setDescription('Pay runs from approved timesheets, processing, and payslip history (doc §3.4, §4.5).')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = config.get<number>('PAYROLL_PORT') || 3004;
  await app.listen(port);
  console.log(`Payroll app running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
