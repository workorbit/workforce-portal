import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TimesheetEntryStatus, TimesheetPeriodType, TimesheetStatus } from '@app/shared';

export type TimesheetDocument = HydratedDocument<Timesheet>;

@Schema({ _id: false })
export class TimesheetEntry {
  @Prop({ required: true })
  date!: string;

  @Prop({ required: true, min: 0 })
  hours!: number;

  @Prop({ trim: true })
  task?: string;

  @Prop({ type: String, enum: TimesheetEntryStatus, default: TimesheetEntryStatus.PRESENT })
  status!: TimesheetEntryStatus;
}
export const TimesheetEntrySchema = SchemaFactory.createForClass(TimesheetEntry);

// Every approve/reject/pending decision is appended here, never overwritten —
// so the employee and employer can see the full back-and-forth thread across
// resubmissions (doc §3.3 design note).
@Schema({ _id: false })
export class TimesheetStatusEvent {
  @Prop({ type: String, enum: TimesheetStatus, required: true })
  status!: TimesheetStatus;

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ required: true })
  changedBy!: string;

  @Prop({ type: Date, default: Date.now })
  changedAt!: Date;
}
export const TimesheetStatusEventSchema = SchemaFactory.createForClass(TimesheetStatusEvent);

@Schema({ timestamps: true })
export class Timesheet {
  @Prop({ required: true })
  employeeId!: string;

  @Prop({ required: true })
  companyId!: string;

  // e.g. "2026-07-14" (week-start) or "2026-07" (month) — company-level
  // cycle setting, not per-employee (doc §8 assumption 3).
  @Prop({ required: true })
  period!: string;

  @Prop({ type: String, enum: TimesheetPeriodType, required: true })
  periodType!: TimesheetPeriodType;

  @Prop({ type: [TimesheetEntrySchema], default: [] })
  entries!: TimesheetEntry[];

  // Period-level note from the employee (distinct from a per-entry `task`).
  @Prop({ trim: true })
  comment?: string;

  @Prop({ type: String, enum: TimesheetStatus, default: TimesheetStatus.DRAFT })
  status!: TimesheetStatus;

  @Prop({ type: [TimesheetStatusEventSchema], default: [] })
  statusHistory!: TimesheetStatusEvent[];

  // Soft-delete flag (doc §7.5) — withdrawn/superseded entries are hidden
  // from the active list but retained for audit.
  @Prop({ type: Boolean, default: false })
  isWithdrawn: boolean = false;

  createdAt?: Date;
}

export const TimesheetSchema = SchemaFactory.createForClass(Timesheet);
