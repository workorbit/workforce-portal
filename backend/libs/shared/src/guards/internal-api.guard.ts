import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

export const INTERNAL_API_KEY_HEADER = 'x-internal-key';

/**
 * Guards the service-to-service endpoints (`/auth/internal/*`,
 * `/employees/internal/*`, all of `notifications`).
 *
 * Those routes carry no user context by design, but they are served on the
 * same port the browser talks to — so "no browser ever calls this directly"
 * was an assumption, not a control. Unguarded, `/auth/internal/provision`
 * let anyone mint a working login for any companyId they cared to name.
 *
 * Callers prove they are one of our own apps with a shared secret; see
 * http-client.util.ts, which attaches it to every cross-app request.
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected) {
      // Fail closed. A missing key must never read as "nothing to check".
      throw new ServiceUnavailableException('INTERNAL_API_KEY is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = request.headers[INTERNAL_API_KEY_HEADER];
    const presented = Array.isArray(raw) ? raw[0] : raw;

    if (!presented || !this.matches(presented, expected)) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }

  private matches(presented: string, expected: string): boolean {
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      // Compare anyway so a wrong-length key doesn't return faster than a
      // right-length one.
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
