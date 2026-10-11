import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './apis/health/health.module';
import { EmployeeFeatureModule } from './apis/employee/employee.module';

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
    EmployeeFeatureModule,
  ],
})
export class EmployeesModule {}
