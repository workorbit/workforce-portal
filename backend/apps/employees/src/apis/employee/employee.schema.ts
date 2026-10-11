import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

// Soft-delete only (doc §3.2/§7.5) — `isActive` gates login + directory
// visibility, but the record (and every timesheet/payroll history tied to
// it) is never removed.
@Schema({ timestamps: true })
export class Employee {
  // The employer/admin's user id (from the auth app's JWT `companyId`) —
  // every query in this app is scoped by this (doc §7.6).
  @Prop({ required: true })
  companyId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ trim: true })
  department?: string;

  @Prop({ trim: true })
  designation?: string;

  @Prop({ type: Date, required: true })
  joiningDate!: Date;

  @Prop({ type: Number, required: true, min: 0 })
  salary!: number;

  @Prop({ type: String, enum: ['hourly', 'fixed'], default: 'fixed' })
  payType: 'hourly' | 'fixed' = 'fixed';

  @Prop({ type: String, default: null })
  reportingManagerId?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean = true;

  createdAt?: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
