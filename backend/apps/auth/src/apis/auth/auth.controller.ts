import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import ms from 'ms';
import type { StringValue } from 'ms';
import {
  CurrentUser,
  InternalApiGuard,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserRole,
} from '@app/shared';
import type { JwtPayload } from '@app/shared';
import { AuthService } from './auth.service';
import type { UserDocument } from './auth.schema';
import {
  AuthUserDto,
  ChangePasswordRequestDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LoginResponseDto,
  MessageResponseDto,
  ProvisionAccountRequestDto,
  ProvisionAccountResponseDto,
  RefreshResponseDto,
  ResetPasswordRequestDto,
  UpdateCompanySettingsDto,
} from './auth.dto';
import { JwtRefreshGuard } from './jwt-refresh.guard';
import type { JwtRefreshPayload } from './jwt-refresh.strategy';
import {
  LEGACY_REFRESH_COOKIE,
  PORTAL_HEADER,
  parsePortal,
  portalForRole,
  refreshCookieName,
} from './portal';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  // Stricter than the app-wide default — this is a password-guessing target.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginRequestDto,
    // Optional: identifies the calling portal so a role that portal doesn't
    // serve is rejected *before* any token is issued or cookie set. Absent
    // for Swagger/curl, which then get the old unrestricted behaviour.
    @Headers(PORTAL_HEADER) portalHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { user, tokens } = await this.authService.login(dto, parsePortal(portalHeader));
    this.attachRefreshCookie(res, tokens.refreshToken, user.role);
    return { accessToken: tokens.accessToken, user: await this.toAuthUser(user) };
  }

  @ApiOperation({ summary: 'Rotate the access token using the refresh_token cookie' })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, expired, or revoked refresh token' })
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @CurrentUser() user: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const tokens = await this.authService.refresh(user.sub, user.refreshToken);
    this.attachRefreshCookie(res, tokens.refreshToken, user.role);
    return { accessToken: tokens.accessToken };
  }

  @ApiOperation({ summary: 'Log out — revokes the refresh token and clears the cookie' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: MessageResponseDto })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    await this.authService.logout(user.sub);
    res.clearCookie(refreshCookieName(portalForRole(user.role)), this.cookieOptions());
    // Also drop any cookie left behind by a build that predates per-portal
    // naming — otherwise it survives logout and gets picked up on refresh.
    res.clearCookie(LEGACY_REFRESH_COOKIE, this.cookieOptions());
    return { message: 'Logged out' };
  }

  @ApiOperation({ summary: 'Get the current user from the access token' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }

  @ApiOperation({ summary: "Change the current user's password" })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: MessageResponseDto })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<MessageResponseDto> {
    await this.authService.changePassword(user.sub, dto);
    return { message: 'Password updated' };
  }

  @ApiOperation({ summary: 'Request a password-reset OTP by email' })
  @ApiOkResponse({ type: MessageResponseDto })
  // Stricter than the app-wide default — prevents OTP-request spam.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('password/forgot')
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto.email);
    // Always the same response — do not reveal whether the email exists.
    return { message: 'If that email exists, a verification code has been sent' };
  }

  @ApiOperation({ summary: 'Reset the password using the emailed OTP' })
  @ApiOkResponse({ type: MessageResponseDto })
  // Stricter than the app-wide default — this is an OTP-guessing target.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<MessageResponseDto> {
    await this.authService.resetPassword(dto);
    return { message: 'Password updated' };
  }

  @ApiOperation({ summary: "Update the company's monthly pay-cycle start day" })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: MessageResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch('company-settings')
  async updateCompanySettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCompanySettingsDto,
  ): Promise<MessageResponseDto> {
    await this.authService.updateCompanySettings(user.sub, dto);
    return { message: 'Company settings updated' };
  }

  @ApiOperation({
    summary: 'Internal — provision a new employee login (called by the employees app only)',
  })
  @ApiOkResponse({ type: ProvisionAccountResponseDto })
  // The only caller is EmployeeService.create, which already runs behind
  // JwtAuthGuard + @Roles(EMPLOYER_ADMIN) and takes companyId off the
  // employer's verified token — so an employee login only ever comes into
  // existence because an employer created that employee. InternalApiGuard is
  // what enforces that: without it this route is openly callable, and anyone
  // could mint a working login for any companyId they named.
  @UseGuards(InternalApiGuard)
  // Not a public brute-force target — and bulk employee imports can
  // legitimately burst well past the public default.
  @SkipThrottle()
  @Post('internal/provision')
  async provision(
    @Body() dto: ProvisionAccountRequestDto,
  ): Promise<ProvisionAccountResponseDto> {
    return this.authService.provisionAccount(dto);
  }

  private async toAuthUser(user: UserDocument): Promise<AuthUserDto> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
      payCycleStartDay: await this.authService.resolvePayCycleStartDay(user.companyId),
    };
  }

  /** The cookie name is derived from the account's own role, so the two
   * portals never write to the same cookie — see portal.ts. */
  private attachRefreshCookie(res: Response, refreshToken: string, role: UserRole): void {
    res.cookie(refreshCookieName(portalForRole(role)), refreshToken, {
      ...this.cookieOptions(),
      // Kept in lockstep with the refresh JWT's own expiry (issueTokens in
      // auth.service.ts) — otherwise the cookie could outlive the token it
      // carries, or expire early and strand a still-valid token.
      maxAge: ms((this.config.get<string>('JWT_REFRESH_EXPIRY') ?? '2d') as StringValue),
    });
  }

  private cookieOptions() {
    const domain = this.config.get<string>('AUTH_DOMAIN_URL');
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      // A bare `localhost` Domain attribute isn't portable — browsers differ
      // on whether they accept it, and a dropped cookie means every refresh
      // 401s. Omitting it makes the cookie host-only, which is exactly what
      // a single-host dev setup wants anyway.
      ...(domain && domain !== 'localhost' ? { domain } : {}),
      path: '/',
    };
  }
}
