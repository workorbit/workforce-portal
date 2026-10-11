import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

// Registers Passport's 'jwt' strategy — required by JwtAuthGuard (which is
// just AuthGuard('jwt')). Each app is a separate process with its own DI
// container, so every app that uses JwtAuthGuard must provide this itself
// (register it in that app's root module); it can't be inherited from the
// auth app at runtime. Only needs JWT_SECRET, which every app already has
// via the shared root .env.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
