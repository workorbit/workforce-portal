import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './apis/health/health.module';
import { NotificationFeatureModule } from './apis/notification/notification.module';
import { MailerModule } from './mailer/mailer.module';

// No MongooseModule here on purpose — this app is stateless (doc §7.3),
// it only sends email, it never persists anything.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailerModule,
    HealthModule,
    NotificationFeatureModule,
  ],
})
export class NotificationsModule {}
