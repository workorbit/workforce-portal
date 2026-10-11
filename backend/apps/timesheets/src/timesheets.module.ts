import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './apis/health/health.module';
import { TimesheetFeatureModule } from './apis/timesheet/timesheet.module';

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
    TimesheetFeatureModule,
  ],
})
export class TimesheetsModule {}
