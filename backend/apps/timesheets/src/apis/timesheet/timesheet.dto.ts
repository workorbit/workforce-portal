import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TimesheetEntryStatus, TimesheetPeriodType, TimesheetStatus } from '@app/shared';

export class TimesheetEntryDto {
  @ApiProperty({ example: '2026-07-14' })
  @IsString()
  date!: string;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @Min(0)
  hours!: number;

  @ApiPropertyOptional({ example: 'Sprint planning + code review' })
  @IsOptional()
  @IsString()
  task?: string;

  @ApiProperty({ enum: TimesheetEntryStatus })
  @IsEnum(TimesheetEntryStatus)
  status!: TimesheetEntryStatus;
}

export class SaveDraftRequestDto {
  @ApiProperty({ example: '2026-07-14' })
  @IsString()
  period!: string;

  @ApiProperty({ enum: TimesheetPeriodType })
  @IsEnum(TimesheetPeriodType)
  periodType!: TimesheetPeriodType;

  @ApiProperty({ type: [TimesheetEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TimesheetEntryDto)
  entries!: TimesheetEntryDto[];

  @ApiPropertyOptional({ example: 'Out on approved leave Thursday.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateStatusRequestDto {
  @ApiProperty({ enum: [TimesheetStatus.APPROVED, TimesheetStatus.REJECTED, TimesheetStatus.PENDING] })
  @IsEnum(TimesheetStatus)
  status!: TimesheetStatus;

  @ApiPropertyOptional({
    description: 'Required when rejecting (doc §3.3) — optional otherwise.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ListTimesheetsQueryDto {
  @ApiPropertyOptional({ enum: TimesheetStatus })
  @IsOptional()
  @IsEnum(TimesheetStatus)
  status?: TimesheetStatus;

  @ApiPropertyOptional({
    enum: TimesheetEntryStatus,
    description: 'Only return periods that contain at least one day with this status.',
  })
  @IsOptional()
  @IsEnum(TimesheetEntryStatus)
  entryStatus?: TimesheetEntryStatus;

  @ApiPropertyOptional({ example: '2026-07-01', description: "Inclusive lower bound on the period's start date." })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-07-31', description: "Inclusive upper bound on the period's start date." })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: TimesheetPeriodType })
  @IsOptional()
  @IsEnum(TimesheetPeriodType)
  periodType?: TimesheetPeriodType;

  @ApiPropertyOptional({
    example: 'sprint',
    description: 'Case-insensitive substring match against the period, its comment, or any day\'s note.',
  })
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

export class TimesheetStatusEventResponseDto {
  @ApiProperty({ enum: TimesheetStatus })
  status!: TimesheetStatus;

  @ApiPropertyOptional()
  remarks?: string;

  @ApiProperty()
  changedBy!: string;

  @ApiPropertyOptional({ description: 'Resolved display name for changedBy, when resolvable.' })
  changedByName?: string;

  @ApiProperty()
  changedAt!: Date;
}

export class TimesheetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  period!: string;

  @ApiProperty({ enum: TimesheetPeriodType })
  periodType!: TimesheetPeriodType;

  @ApiProperty({ type: [TimesheetEntryDto] })
  entries!: TimesheetEntryDto[];

  @ApiPropertyOptional()
  comment?: string;

  @ApiProperty()
  totalHours!: number;

  @ApiProperty({ enum: TimesheetStatus })
  status!: TimesheetStatus;

  @ApiProperty({ type: [TimesheetStatusEventResponseDto] })
  statusHistory!: TimesheetStatusEventResponseDto[];

  @ApiPropertyOptional({ description: 'The employer/company display name, used as "Bill To".' })
  companyName?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedTimesheetResponseDto {
  @ApiProperty({ type: [TimesheetResponseDto] })
  items!: TimesheetResponseDto[];

  @ApiProperty({ description: 'Total matches before pagination was applied.' })
  total!: number;
}
