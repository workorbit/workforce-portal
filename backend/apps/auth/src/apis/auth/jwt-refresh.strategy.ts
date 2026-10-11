import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@app/shared';
import {
  LEGACY_REFRESH_COOKIE,
  PORTAL_HEADER,
  Portal,
  parsePortal,
  refreshCookieName,
} from './portal';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

/**
 * Each portal has its own refresh cookie (see portal.ts). When the caller
 * identifies itself we read exactly that one — critical when both portals are
 * signed in on the same host, where both cookies are present and picking the
 * wrong one would refresh the wrong account's session.
 */
function extractFromCookie(req: Request): string | null {
  const cookies: Record<string, string> = req?.cookies ?? {};
  const portal = parsePortal(req?.headers?.[PORTAL_HEADER]);
  if (portal) {
    return cookies[refreshCookieName(portal)] ?? null;
  }
  return (
    cookies[refreshCookieName(Portal.EMPLOYER)] ??
    cookies[refreshCookieName(Portal.EMPLOYEE)] ??
    cookies[LEGACY_REFRESH_COOKIE] ??
    null
  );
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const refreshToken = extractFromCookie(req);
    return { ...payload, refreshToken: refreshToken! };
  }
}
