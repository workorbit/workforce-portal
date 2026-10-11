import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@app/shared';
import { AuthController } from './auth.controller';
import { InternalAuthController } from './internal-auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { User, UserSchema } from './auth.schema';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController, InternalAuthController],
  providers: [AuthService, AuthRepository, JwtStrategy, JwtRefreshStrategy],
})
export class AuthFeatureModule {}
