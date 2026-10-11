import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '@app/shared';

// ---------- Requests ----------

export class LoginRequestDto {
  @ApiProperty({ example: 'jane.doe@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngPassword!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'NewStr0ngPassword!', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'jane.doe@company.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'jane.doe@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;

  @ApiProperty({ example: 'NewStr0ngPassword!', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

// Internal — called only by the `employees` app, never by a frontend.
export class ProvisionAccountRequestDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  companyId!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description:
      'Set only when the employer typed a password directly on the create-employee form. Left empty, auth generates a random temporary password instead.',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  initialPassword?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateCompanySettingsDto {
  @ApiProperty({
    description: 'Monthly pay-cycle start day (1-28). 1 = plain calendar month.',
    minimum: 1,
    maximum: 28,
    example: 16,
  })
  @IsInt()
  @Min(1)
  @Max(28)
  payCycleStartDay!: number;
}

// ---------- Responses ----------

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  employeeId?: string | null;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({ minimum: 1, maximum: 28 })
  payCycleStartDay!: number;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class RefreshResponseDto {
  @ApiProperty()
  accessToken!: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Done' })
  message!: string;
}

export class ProvisionAccountResponseDto {
  @ApiProperty({
    description:
      'Only meaningful when auth generated it (no initialPassword was supplied) — the caller does not need to store it, it has already been emailed.',
  })
  temporaryPassword!: string;
}
