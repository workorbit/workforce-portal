import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { findEmployeeById, sendFeedbackReplyEmail } from '@app/shared';
import { FeedbackRepository } from './feedback.repository';
import { FeedbackDocument } from './feedback.schema';
import { CreateFeedbackRequestDto, ReplyFeedbackRequestDto } from './feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly feedbackRepository: FeedbackRepository) {}

  create(
    employeeId: string,
    companyId: string,
    dto: CreateFeedbackRequestDto,
  ): Promise<FeedbackDocument> {
    return this.feedbackRepository.create(employeeId, companyId, dto.category, dto.description);
  }

  findForEmployee(employeeId: string): Promise<FeedbackDocument[]> {
    return this.feedbackRepository.findForEmployee(employeeId);
  }

  findForCompany(companyId: string): Promise<FeedbackDocument[]> {
    return this.feedbackRepository.findForCompany(companyId);
  }

  async findOneForEmployee(id: string, employeeId: string): Promise<FeedbackDocument> {
    const feedback = await this.feedbackRepository.findByIdForEmployee(id, employeeId);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }
    return feedback;
  }

  async findOneForCompany(id: string, companyId: string): Promise<FeedbackDocument> {
    const feedback = await this.feedbackRepository.findByIdForCompany(id, companyId);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }
    return feedback;
  }

  async reply(
    id: string,
    companyId: string,
    actingUserId: string,
    dto: ReplyFeedbackRequestDto,
  ): Promise<FeedbackDocument> {
    const feedback = await this.feedbackRepository.findByIdForCompany(id, companyId);
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    feedback.status = dto.status;
    feedback.replies.push({ message: dto.message, byUserId: actingUserId, at: new Date() });
    const saved = await this.feedbackRepository.save(feedback);

    this.notifyEmployeeSafely(saved);
    return saved;
  }

  private notifyEmployeeSafely(feedback: FeedbackDocument): void {
    findEmployeeById(feedback.employeeId)
      .then((employee) => {
        if (!employee) return;
        return sendFeedbackReplyEmail({
          to: employee.email,
          name: employee.name,
          status: feedback.status,
          reply: feedback.replies.at(-1)?.message ?? '',
        });
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to send feedback-reply email for feedback ${feedback.id}`,
          error.stack,
        );
      });
  }
}
