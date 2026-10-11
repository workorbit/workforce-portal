import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Shared CORS policy for every app.
 *
 * Only the two portals may call these APIs from a browser. The previous
 * `origin: true` reflected whatever Origin the caller sent — so any page on
 * the internet got `Access-Control-Allow-Origin: <itself>` plus
 * `Allow-Credentials: true` back.
 *
 * Note `origin: '*'` is not an option here: the spec forbids pairing a
 * wildcard with credentials, and the portals send `withCredentials` on
 * login/refresh/logout, so the browser would reject every one of those
 * responses. An explicit allowlist is the only form that works.
 *
 * @param extraAllowedHeaders request headers beyond the defaults this app
 *   accepts from a browser. Anything not listed fails preflight — which is
 *   why `X-Portal` has to be declared by the auth app.
 */
export function corsOptions(extraAllowedHeaders: string[] = []): CorsOptions {
  const allowlist = [
    process.env.EMPLOYER_PORTAL_URL,
    process.env.EMPLOYEE_PORTAL_URL,
  ].filter((url): url is string => !!url);

  return {
    origin: (origin, callback) => {
      // No Origin header at all: same-origin navigations, curl, and the
      // service-to-service axios calls in http-client.util.ts. CORS isn't
      // what protects those — InternalApiGuard and JwtAuthGuard are.
      if (!origin || allowlist.includes(origin)) {
        callback(null, true);
        return;
      }
      // Refuse by withholding the headers rather than throwing, so a
      // disallowed origin gets a clean browser-side CORS block instead of a
      // 500 in our logs.
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', ...extraAllowedHeaders],
    credentials: true,
  };
}
