import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PayrollClaimStatus } from '@app/shared';

export class SaveDraftRequestDto {
  @ApiProperty({ example: '2026-07' })
  @IsString()
  period!: string;

  @ApiProperty({ example: 60000, description: 'Prefillable from the employee salary, but editable' })
  @IsNumber()
  @Min(0)
  basicPay!: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @ApiPropertyOptional({ example: 1500, description: 'Expenses bundled into this pay cycle' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reimbursement?: number;

  @ApiPropertyOptional({ example: 'Includes July travel reimbursement.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStatusRequestDto {
  @ApiProperty({ enum: [PayrollClaimStatus.APPROVED, PayrollClaimStatus.REJECTED, PayrollClaimStatus.PENDING] })
  @IsEnum(PayrollClaimStatus)
  status!: PayrollClaimStatus;

  @ApiPropertyOptional({ description: 'Required when rejecting — optional otherwise.' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ListPayrollClaimsQueryDto {
  @ApiPropertyOptional({ enum: PayrollClaimStatus })
  @IsOptional()
  @IsEnum(PayrollClaimStatus)
  status?: PayrollClaimStatus;

  @ApiPropertyOptional({
    example: '2026-01',
    description: "Inclusive lower bound on the period ('YYYY-MM' strings sort lexically).",
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive substring match against the period or notes.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, description: 'Omit both page and limit to get every match, unpaginated.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PayrollClaimStatusEventResponseDto {
  @ApiProperty({ enum: PayrollClaimStatus })
  status!: PayrollClaimStatus;

  @ApiPropertyOptional()
  remarks?: string;

  @ApiProperty()
  changedBy!: string;

  @ApiPropertyOptional({ description: 'Resolved display name for changedBy, when resolvable.' })
  changedByName?: string;

  @ApiProperty()
  changedAt!: Date;
}

export class PayrollClaimResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  period!: string;

  @ApiProperty()
  basicPay!: number;

  @ApiProperty()
  bonus!: number;

  @ApiProperty()
  deductions!: number;

  @ApiProperty()
  reimbursement!: number;

  @ApiProperty()
  netPay!: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ enum: PayrollClaimStatus })
  status!: PayrollClaimStatus;

  @ApiProperty({ type: [PayrollClaimStatusEventResponseDto] })
  statusHistory!: PayrollClaimStatusEventResponseDto[];

  @ApiPropertyOptional({ description: 'The employer/company display name.' })
  companyName?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedPayrollClaimResponseDto {
  @ApiProperty({ type: [PayrollClaimResponseDto] })
  items!: PayrollClaimResponseDto[];

  @ApiProperty({ description: 'Total matches before pagination was applied.' })
  total!: number;
}
