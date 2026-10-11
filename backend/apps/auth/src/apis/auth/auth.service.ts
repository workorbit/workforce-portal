import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { StringValue } from 'ms';
import {
  JwtPayload,
  UserRole,
  sendAccountCreatedEmail,
  sendOtpEmail,
  sendPasswordChangedEmail,
} from '@app/shared';
import { AuthRepository } from './auth.repository';
import { UserDocument } from './auth.schema';
import {
  ChangePasswordRequestDto,
  LoginRequestDto,
  ProvisionAccountRequestDto,
  ResetPasswordRequestDto,
  UpdateCompanySettingsDto,
} from './auth.dto';
import { Portal, roleForPortal } from './portal';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const OTP_TTL_MS = 10 * 60 * 1000;

/** How long the refresh token replaced by the most recent rotation stays
 * usable. Tabs of the same portal re-check their session simultaneously (a
 * login broadcasts "re-check" to the others), so several /auth/refresh calls
 * can legitimately arrive holding the same token within a few milliseconds of
 * each other. Without this window the first one rotates and every other one
 * 401s — bouncing perfectly valid sessions to /login. */
const REFRESH_ROTATION_GRACE_MS = 30_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Login (password step) ----------

  async login(
    dto: LoginRequestDto,
    portal: Portal | null,
  ): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Rejected before any token is issued or cookie set. The portals used to
    // check this themselves *after* a successful login, which meant the
    // browser had already stored a refresh cookie for an account that portal
    // won't serve — one they then had to undo with a follow-up logout call.
    if (portal && user.role !== roleForPortal(portal)) {
      throw new ForbiddenException(
        portal === Portal.EMPLOYER
          ? 'This account is not supported here. Employees should use the Employee Portal.'
          : 'This account should sign in through the Employer Portal instead.',
      );
    }

    const tokens = await this.issueAndStoreTokens(user);
    return { user, tokens };
  }

  // ---------- Session ----------

  async refresh(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.authRepository.findByIdWithRefreshToken(userId);
    if (!user?.currentHashedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isMatch = await bcrypt.compare(
      refreshToken,
      user.currentHashedRefreshToken,
    );
    if (!isMatch && !(await this.matchesRecentlyRotatedToken(user, refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueAndStoreTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.clearRefreshTokens(userId);
  }

  // ---------- Password ----------

  async changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.authRepository.setPasswordHash(userId, passwordHash, false);
    this.sendPasswordChangedEmailSafely(user.email, user.name);
  }

  async forgotPassword(email: string): Promise<{ userId: string } | null> {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      // Do not reveal whether the email exists.
      return null;
    }
    await this.issueAndSendOtp(user);
    return { userId: user.id };
  }

  async resetPassword(dto: ResetPasswordRequestDto): Promise<void> {
    const user = await this.authRepository.findByEmailWithOtp(dto.email);
    if (!user?.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('No verification code was requested');
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired');
    }
    const isMatch = await bcrypt.compare(dto.otp, user.otpHash);
    if (!isMatch) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.authRepository.clearOtp(user.id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.authRepository.setPasswordHash(user.id, passwordHash, false);
    this.sendPasswordChangedEmailSafely(user.email, user.name);
  }

  // ---------- Provisioning (called by the `employees` app) ----------

  async provisionAccount(
    dto: ProvisionAccountRequestDto,
  ): Promise<{ temporaryPassword: string }> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const temporaryPassword = dto.initialPassword ?? randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.authRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: UserRole.EMPLOYEE,
      companyId: dto.companyId,
      employeeId: dto.employeeId,
      mustChangePassword: dto.mustChangePassword ?? true,
    });

    const loginUrl = this.config.get<string>('EMPLOYEE_PORTAL_URL') || 'http://localhost:4300';
    sendAccountCreatedEmail({
      to: user.email,
      name: user.name,
      temporaryPassword,
      loginUrl,
    }).catch((error: Error) => {
      this.logger.error(`Failed to send account-created email to ${user.email}`, error.stack);
    });

    return { temporaryPassword };
  }

  // ---------- Internal (called by the `timesheets` app) ----------

  async findInternal(userId: string): Promise<{ id: string; name: string; email: string; role: UserRole } | null> {
    const user = await this.authRepository.findById(userId);
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  // ---------- Company settings ----------

  // companyId is self-referential for an EMPLOYER_ADMIN and points at the
  // employer's own doc for an EMPLOYEE — either way this resolves to the
  // one place payCycleStartDay is actually stored.
  async resolvePayCycleStartDay(companyId: string): Promise<number> {
    const company = await this.authRepository.findById(companyId);
    return company?.payCycleStartDay ?? 1;
  }

  async updateCompanySettings(employerId: string, dto: UpdateCompanySettingsDto): Promise<void> {
    await this.authRepository.updatePayCycleStartDay(employerId, dto.payCycleStartDay);
  }

  // ---------- Internals ----------

  private async issueAndSendOtp(user: UserDocument): Promise<void> {
    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.authRepository.setOtp(user.id, otpHash, expiresAt);

    sendOtpEmail({ to: user.email, name: user.name, otp }).catch((error: Error) => {
      this.logger.error(`Failed to send OTP email to ${user.email}`, error.stack);
    });
  }

  private sendPasswordChangedEmailSafely(to: string, name: string): void {
    sendPasswordChangedEmail({ to, name }).catch((error: Error) => {
      this.logger.error(`Failed to send password-changed email to ${to}`, error.stack);
    });
  }

  /** True when the caller presented the token the *previous* refresh replaced,
   * and that rotation was recent enough to still be in flight elsewhere. The
   * grace token is itself rotated forward on every call, so a cluster of
   * simultaneous refreshes all succeed instead of cannibalising each other. */
  private async matchesRecentlyRotatedToken(
    user: UserDocument,
    refreshToken: string,
  ): Promise<boolean> {
    if (!user.previousHashedRefreshToken || !user.refreshTokenRotatedAt) {
      return false;
    }
    if (Date.now() - user.refreshTokenRotatedAt.getTime() > REFRESH_ROTATION_GRACE_MS) {
      return false;
    }
    return bcrypt.compare(refreshToken, user.previousHashedRefreshToken);
  }

  private async issueAndStoreTokens(user: UserDocument): Promise<AuthTokens> {
    const tokens = await this.issueTokens(user);
    const currentHashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.authRepository.rotateRefreshTokenHash(
      user.id,
      currentHashedRefreshToken,
      // Undefined on the login path (findByEmail doesn't select it), which is
      // correct — a fresh login has no earlier token worth honouring.
      user.currentHashedRefreshToken ?? null,
    );
    return tokens;
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const payCycleStartDay = await this.resolvePayCycleStartDay(user.companyId);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId ?? undefined,
      payCycleStartDay,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '15m') as StringValue,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRY') ?? '2d') as StringValue,
    });

    return { accessToken, refreshToken };
  }
}
