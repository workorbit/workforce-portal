import { UserRole } from './user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  // Scopes every query in every service to the employer that owns this
  // account — read off the verified token, never trusted from the request
  // body (doc §7.6). For an EMPLOYER_ADMIN, companyId === their own user id.
  companyId: string;
  // Only present for EMPLOYEE tokens; lets services filter to "my own
  // records only" without a second lookup.
  employeeId?: string;
  // The company's monthly pay-cycle start day (1-28, default 1 = plain
  // calendar month). Resolved off the employer's own User doc at token
  // issuance — for an EMPLOYEE this is their employer's value, not their own.
  payCycleStartDay: number;
}
