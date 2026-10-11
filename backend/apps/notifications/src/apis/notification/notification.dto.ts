import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class OtpEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() otp!: string;
}

export class AccountCreatedEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() temporaryPassword!: string;
  @ApiProperty() @IsString() loginUrl!: string;
}

export class PasswordChangedEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
}

export class TimesheetStatusEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: ['approved', 'rejected', 'pending'] })
  @IsIn(['approved', 'rejected', 'pending'])
  status!: 'approved' | 'rejected' | 'pending';
  @ApiProperty() @IsString() period!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class FeedbackReplyEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() status!: string;
  @ApiProperty() @IsString() reply!: string;
}

export class PayrollStatusEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: ['approved', 'rejected', 'pending'] })
  @IsIn(['approved', 'rejected', 'pending'])
  status!: 'approved' | 'rejected' | 'pending';
  @ApiProperty() @IsString() period!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class PayrollPaidEmailRequestDto {
  @ApiProperty() @IsEmail() to!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() period!: string;
  @ApiProperty() @IsNumber() netPay!: number;
}
