import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '@app/shared';

export type UserDocument = HydratedDocument<User>;

// `auth` owns this collection exclusively — no other app writes to a user's
// credentials directly. Employees/companies data itself lives in the
// `employees` app; this schema only holds what login/session needs.
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  // Bcrypt hash, never the plaintext. Hidden by default; the repository
  // selects it explicitly for login.
  @Prop({ required: true, type: String, select: false })
  passwordHash!: string;

  @Prop({ type: String, enum: UserRole, required: true })
  role!: UserRole;

  // For an EMPLOYER_ADMIN this is their own user id (set after creation);
  // for an EMPLOYEE it's the id of the employer/admin who created them.
  // Every cross-app query is scoped by this (doc §7.6).
  @Prop({ type: String, required: true })
  companyId!: string;

  // Only set for EMPLOYEE accounts — the `employees` app's Employee._id,
  // so services can filter "my own records only" straight off the JWT.
  @Prop({ type: String, default: null })
  employeeId!: string | null;

  // True until the employee completes the "keep or change password" step on
  // first activation (doc §4.3). Employer-created accounts only.
  @Prop({ type: Boolean, default: false })
  mustChangePassword: boolean = false;

  // Company-wide monthly pay-cycle start day (1-28). Only meaningful on an
  // EMPLOYER_ADMIN's own doc — employees' periods resolve it via their
  // companyId, which points back to this same field on the employer's doc.
  // Capped at 28 so "day before the cycle start, next month" is always a
  // valid calendar date (even in February) with no leap-year edge cases.
  @Prop({ type: Number, default: 1, min: 1, max: 28 })
  payCycleStartDay: number = 1;

  // Hashed OTP + expiry for the login-verification flow. Hidden by default.
  @Prop({ type: String, default: null, select: false })
  otpHash: string | null = null;

  @Prop({ type: Date, default: null, select: false })
  otpExpiresAt: Date | null = null;

  @Prop({ type: String, default: null, select: false })
  currentHashedRefreshToken: string | null = null;

  // The token `currentHashedRefreshToken` replaced, plus when the swap
  // happened. Refresh accepts it for a short grace window so that several
  // tabs refreshing at the same instant don't invalidate each other — see
  // REFRESH_ROTATION_GRACE_MS in auth.service.ts.
  @Prop({ type: String, default: null, select: false })
  previousHashedRefreshToken: string | null = null;

  @Prop({ type: Date, default: null, select: false })
  refreshTokenRotatedAt: Date | null = null;

  createdAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
