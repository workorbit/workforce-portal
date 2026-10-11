import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PayrollClaimStatus } from '@app/shared';

export type PayrollClaimDocument = HydratedDocument<PayrollClaim>;

// Same audit-thread pattern as TimesheetStatusEvent — appended, never
// overwritten, so the full approve/reject/pending/paid history survives
// resubmissions.
@Schema({ _id: false })
export class PayrollClaimStatusEvent {
  @Prop({ type: String, enum: PayrollClaimStatus, required: true })
  status!: PayrollClaimStatus;

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ required: true })
  changedBy!: string;

  @Prop({ type: Date, default: Date.now })
  changedAt!: Date;
}
export const PayrollClaimStatusEventSchema = SchemaFactory.createForClass(PayrollClaimStatusEvent);

@Schema({ timestamps: true })
export class PayrollClaim {
  @Prop({ required: true })
  employeeId!: string;

  @Prop({ required: true })
  companyId!: string;

  // Always "YYYY-MM" — payroll periods are always a calendar month.
  @Prop({ required: true })
  period!: string;

  @Prop({ required: true, min: 0 })
  basicPay!: number;

  @Prop({ required: true, min: 0, default: 0 })
  bonus!: number;

  @Prop({ required: true, min: 0, default: 0 })
  deductions!: number;

  @Prop({ required: true, min: 0, default: 0 })
  reimbursement!: number;

  // Computed = basicPay + bonus + reimbursement - deductions, stored (not
  // independently editable) so history and the review screen always show
  // exactly what was true at submit time.
  @Prop({ required: true, min: 0 })
  netPay!: number;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: PayrollClaimStatus, default: PayrollClaimStatus.DRAFT })
  status!: PayrollClaimStatus;

  @Prop({ type: [PayrollClaimStatusEventSchema], default: [] })
  statusHistory!: PayrollClaimStatusEvent[];

  // Soft-delete flag, same convention as Timesheet.isWithdrawn — retained for
  // audit rather than actually deleted.
  @Prop({ type: Boolean, default: false })
  isWithdrawn: boolean = false;

  createdAt?: Date;
}

export const PayrollClaimSchema = SchemaFactory.createForClass(PayrollClaim);
