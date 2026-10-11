// The employer is the source of truth for every employee account — there is
// no employee self-registration, only these two roles (see doc §2).
export enum UserRole {
  EMPLOYER_ADMIN = 'employer_admin',
  EMPLOYEE = 'employee',
}
