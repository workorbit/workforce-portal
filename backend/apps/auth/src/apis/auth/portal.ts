import { UserRole } from '@app/shared';

/**
 * Which frontend a request came from.
 *
 * Both portals run on the same host in development (localhost:4200 and
 * localhost:4300) and cookies are scoped by host, NOT by port — a single
 * `refresh_token` cookie is therefore shared between them, so signing into
 * one portal silently overwrites the other's session. The overwritten portal
 * then refreshes with the *other* account's token, fails its role check, and
 * bounces the user back to /login. Naming the cookie per portal keeps the two
 * sessions independent.
 */
export enum Portal {
  EMPLOYER = 'employer',
  EMPLOYEE = 'employee',
}

/** Sent by both frontends on login/refresh/logout — see AuthApiService. */
export const PORTAL_HEADER = 'x-portal';

/** The cookie name used before portals were separated. Still cleared on
 * logout so a session created by an older build can't linger. */
export const LEGACY_REFRESH_COOKIE = 'refresh_token';

export function roleForPortal(portal: Portal): UserRole {
  return portal === Portal.EMPLOYER ? UserRole.EMPLOYER_ADMIN : UserRole.EMPLOYEE;
}

export function portalForRole(role: UserRole): Portal {
  return role === UserRole.EMPLOYER_ADMIN ? Portal.EMPLOYER : Portal.EMPLOYEE;
}

export function refreshCookieName(portal: Portal): string {
  return `refresh_token_${portal}`;
}

/** Null for anything that isn't one of the two known portals — including a
 * missing header, so Swagger/curl calls still work unrestricted. */
export function parsePortal(value: string | string[] | undefined): Portal | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === Portal.EMPLOYER || raw === Portal.EMPLOYEE ? raw : null;
}
