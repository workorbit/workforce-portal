import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, UserRole } from '@app/shared';
import type { JwtPayload } from '@app/shared';
import { FeedbackService } from './feedback.service';
import { FeedbackDocument } from './feedback.schema';
import { CreateFeedbackRequestDto, FeedbackResponseDto, ReplyFeedbackRequestDto } from './feedback.dto';

@ApiTags('Feedback')
@Controller('feedback')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @ApiOperation({ summary: 'Raise a concern/issue/feedback item (doc §4.6)' })
  @ApiOkResponse({ type: FeedbackResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFeedbackRequestDto,
  ): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackService.create(user.employeeId!, user.companyId, dto);
    return this.toResponse(feedback);
  }

  @ApiOperation({ summary: 'List feedback — own submissions for an employee, the inbox for an employer' })
  @ApiOkResponse({ type: [FeedbackResponseDto] })
  @Get()
  async findAll(@CurrentUser() user: JwtPayload): Promise<FeedbackResponseDto[]> {
    const items =
      user.role === UserRole.EMPLOYEE
        ? await this.feedbackService.findForEmployee(user.employeeId!)
        : await this.feedbackService.findForCompany(user.companyId);
    return items.map((item) => this.toResponse(item));
  }

  @ApiOperation({ summary: 'Feedback detail, including the reply thread' })
  @ApiOkResponse({ type: FeedbackResponseDto })
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<FeedbackResponseDto> {
    const feedback =
      user.role === UserRole.EMPLOYEE
        ? await this.feedbackService.findOneForEmployee(id, user.employeeId!)
        : await this.feedbackService.findOneForCompany(id, user.companyId);
    return this.toResponse(feedback);
  }

  @ApiOperation({ summary: 'Reply to a feedback item and update its status (doc §3.6)' })
  @ApiOkResponse({ type: FeedbackResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Patch(':id/status')
  async reply(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReplyFeedbackRequestDto,
  ): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackService.reply(id, user.companyId, user.sub, dto);
    return this.toResponse(feedback);
  }

  private toResponse(feedback: FeedbackDocument): FeedbackResponseDto {
    return {
      id: feedback.id,
      employeeId: feedback.employeeId,
      companyId: feedback.companyId,
      category: feedback.category,
      description: feedback.description,
      status: feedback.status,
      replies: feedback.replies,
      createdAt: feedback.createdAt!,
    };
  }
}
