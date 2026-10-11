import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './apis/health/health.module';
import { PayrollFeatureModule } from './apis/payroll/payroll.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('APP_MONGODB_URI'),
      }),
    }),
    HealthModule,
    PayrollFeatureModule,
  ],
})
export class PayrollAppModule {}
