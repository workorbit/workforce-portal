import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: Transporter;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const user = this.config.get<string>('USER_EMAIL');
    this.configured = !!user;

    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        service: this.config.get<string>('EMAIL_SERVICE'),
        auth: {
          user,
          pass: this.config.get<string>('USER_PASSWORD'),
        },
      });
    } else {
      this.logger.warn('USER_EMAIL is not set — emails will be logged to the console instead of sent.');
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.configured) {
      this.logger.log(`[console-mail] to=${options.to} subject="${options.subject}"\n${options.text ?? options.html}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('USER_EMAIL'),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  async sendOtpEmail(to: string, name: string, otp: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your login verification code',
      html: `<p>Hi ${name},</p><p>Your login verification code is:</p><h2>${otp}</h2><p>This code expires in 10 minutes.</p>`,
      text: `Hi ${name}, your login verification code is ${otp}. This code expires in 10 minutes.`,
    });
  }

  async sendAccountCreatedEmail(
    to: string,
    name: string,
    temporaryPassword: string,
    loginUrl: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your Workforce Portal account is ready',
      html: `<p>Hi ${name},</p><p>Your employer has created your employee account.</p><p><b>Login:</b> ${to}<br/><b>Temporary password:</b> ${temporaryPassword}</p><p><a href="${loginUrl}">Log in here</a> — you'll be asked to verify your email with a one-time code, and can then keep or change this password.</p>`,
      text: `Hi ${name}, your account has been created. Login: ${to} / Temporary password: ${temporaryPassword}. Log in at ${loginUrl}`,
    });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your password was changed',
      html: `<p>Hi ${name},</p><p>Your password was just changed. If this wasn't you, contact your employer immediately.</p>`,
      text: `Hi ${name}, your password was just changed. If this wasn't you, contact your employer immediately.`,
    });
  }

  async sendTimesheetStatusEmail(
    to: string,
    name: string,
    status: string,
    period: string,
    remarks?: string,
  ): Promise<void> {
    const remarksLine = remarks ? `<p><b>Remarks:</b> ${remarks}</p>` : '';
    await this.sendMail({
      to,
      subject: `Your timesheet for ${period} was ${status}`,
      html: `<p>Hi ${name},</p><p>Your timesheet for <b>${period}</b> was marked <b>${status}</b>.</p>${remarksLine}`,
      text: `Hi ${name}, your timesheet for ${period} was ${status}.${remarks ? ` Remarks: ${remarks}` : ''}`,
    });
  }

  async sendFeedbackReplyEmail(to: string, name: string, status: string, reply: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Update on your feedback submission',
      html: `<p>Hi ${name},</p><p>Your feedback status is now <b>${status}</b>.</p><p>${reply}</p>`,
      text: `Hi ${name}, your feedback status is now ${status}. ${reply}`,
    });
  }

  async sendPayrollStatusEmail(
    to: string,
    name: string,
    status: string,
    period: string,
    remarks?: string,
  ): Promise<void> {
    const remarksLine = remarks ? `<p><b>Remarks:</b> ${remarks}</p>` : '';
    await this.sendMail({
      to,
      subject: `Your payroll claim for ${period} was ${status}`,
      html: `<p>Hi ${name},</p><p>Your payroll claim for <b>${period}</b> was marked <b>${status}</b>.</p>${remarksLine}`,
      text: `Hi ${name}, your payroll claim for ${period} was ${status}.${remarks ? ` Remarks: ${remarks}` : ''}`,
    });
  }

  async sendPayrollPaidEmail(to: string, name: string, period: string, netPay: number): Promise<void> {
    await this.sendMail({
      to,
      subject: `Your payslip for ${period} is ready`,
      html: `<p>Hi ${name},</p><p>Your payroll for <b>${period}</b> has been marked paid. Net pay: <b>${netPay}</b>.</p>`,
      text: `Hi ${name}, your payroll for ${period} has been marked paid. Net pay: ${netPay}.`,
    });
  }
}
