import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalApiGuard } from '@app/shared';
import { MailerService } from '../../mailer/mailer.service';
import {
  AccountCreatedEmailRequestDto,
  FeedbackReplyEmailRequestDto,
  OtpEmailRequestDto,
  PasswordChangedEmailRequestDto,
  PayrollPaidEmailRequestDto,
  PayrollStatusEmailRequestDto,
  TimesheetStatusEmailRequestDto,
} from './notification.dto';

// This whole app is service-to-service only (doc §7.3: "Stateless — uses
// Email Provider") — no browser ever calls it directly, so none of these
// need JwtAuthGuard. They do need InternalApiGuard: the port is reachable
// like any other, and these routes send mail from our own account to any
// address, with the recipient name and (for account-created) a password
// taken straight from the request body — an open relay for phishing.
@ApiExcludeController()
@UseGuards(InternalApiGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly mailerService: MailerService) {}

  @HttpCode(HttpStatus.OK)
  @Post('otp')
  async otp(@Body() dto: OtpEmailRequestDto): Promise<void> {
    await this.mailerService.sendOtpEmail(dto.to, dto.name, dto.otp);
  }

  @HttpCode(HttpStatus.OK)
  @Post('account-created')
  async accountCreated(@Body() dto: AccountCreatedEmailRequestDto): Promise<void> {
    await this.mailerService.sendAccountCreatedEmail(dto.to, dto.name, dto.temporaryPassword, dto.loginUrl);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-changed')
  async passwordChanged(@Body() dto: PasswordChangedEmailRequestDto): Promise<void> {
    await this.mailerService.sendPasswordChangedEmail(dto.to, dto.name);
  }

  @HttpCode(HttpStatus.OK)
  @Post('timesheet-status')
  async timesheetStatus(@Body() dto: TimesheetStatusEmailRequestDto): Promise<void> {
    await this.mailerService.sendTimesheetStatusEmail(dto.to, dto.name, dto.status, dto.period, dto.remarks);
  }

  @HttpCode(HttpStatus.OK)
  @Post('feedback-reply')
  async feedbackReply(@Body() dto: FeedbackReplyEmailRequestDto): Promise<void> {
    await this.mailerService.sendFeedbackReplyEmail(dto.to, dto.name, dto.status, dto.reply);
  }

  @HttpCode(HttpStatus.OK)
  @Post('payroll-status')
  async payrollStatus(@Body() dto: PayrollStatusEmailRequestDto): Promise<void> {
    await this.mailerService.sendPayrollStatusEmail(dto.to, dto.name, dto.status, dto.period, dto.remarks);
  }

  @HttpCode(HttpStatus.OK)
  @Post('payroll-paid')
  async payrollPaid(@Body() dto: PayrollPaidEmailRequestDto): Promise<void> {
    await this.mailerService.sendPayrollPaidEmail(dto.to, dto.name, dto.period, dto.netPay);
  }
}
