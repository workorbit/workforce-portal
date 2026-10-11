import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './apis/health/health.module';
import { FeedbackFeatureModule } from './apis/feedback/feedback.module';

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
    FeedbackFeatureModule,
  ],
})
export class FeedbackAppModule {}
