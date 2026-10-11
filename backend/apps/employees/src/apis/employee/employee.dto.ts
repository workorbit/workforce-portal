import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployeeRequestDto {
  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'priya.sharma@company.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsString()
  joiningDate!: string;

  @ApiProperty({ example: 75000 })
  @IsNumber()
  @Min(0)
  salary!: number;

  @ApiPropertyOptional({ enum: ['hourly', 'fixed'], default: 'fixed' })
  @IsOptional()
  @IsIn(['hourly', 'fixed'])
  payType?: 'hourly' | 'fixed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportingManagerId?: string;

  @ApiPropertyOptional({
    description:
      'Auto-generate a temporary password when omitted; if set, the employer typed it directly (doc §3.1).',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  initialPassword?: string;
}

export class UpdateEmployeeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportingManagerId?: string;
}

export class UpdateOwnEmployeeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;
}

export class UpdateEmployeeStatusRequestDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}

export class EmployeeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiPropertyOptional()
  designation?: string;

  @ApiProperty()
  joiningDate!: Date;

  @ApiProperty()
  salary!: number;

  @ApiProperty({ enum: ['hourly', 'fixed'] })
  payType!: 'hourly' | 'fixed';

  @ApiPropertyOptional()
  reportingManagerId?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
