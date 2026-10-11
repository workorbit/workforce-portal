import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@app/shared';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackRepository } from './feedback.repository';
import { Feedback, FeedbackSchema } from './feedback.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Feedback.name, schema: FeedbackSchema }]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackRepository, JwtStrategy],
})
export class FeedbackFeatureModule {}
