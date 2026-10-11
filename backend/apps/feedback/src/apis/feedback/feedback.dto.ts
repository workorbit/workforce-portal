import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { FeedbackCategory, FeedbackStatus } from '@app/shared';

export class CreateFeedbackRequestDto {
  @ApiProperty({ enum: FeedbackCategory })
  @IsEnum(FeedbackCategory)
  category!: FeedbackCategory;

  @ApiProperty({ example: 'My approved hours for last week show as 38 instead of 42 on the payslip.' })
  @IsString()
  @MinLength(1)
  description!: string;
}

export class ReplyFeedbackRequestDto {
  @ApiProperty({ enum: [FeedbackStatus.IN_REVIEW, FeedbackStatus.RESOLVED] })
  @IsEnum(FeedbackStatus)
  status!: FeedbackStatus;

  @ApiProperty({ example: 'Fixed — this will show correctly on your next payslip.' })
  @IsString()
  @MinLength(1)
  message!: string;
}

export class FeedbackReplyResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty()
  byUserId!: string;

  @ApiProperty()
  at!: Date;
}

export class FeedbackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty({ enum: FeedbackCategory })
  category!: FeedbackCategory;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: FeedbackStatus })
  status!: FeedbackStatus;

  @ApiProperty({ type: [FeedbackReplyResponseDto] })
  replies!: FeedbackReplyResponseDto[];

  @ApiProperty()
  createdAt!: Date;
}
