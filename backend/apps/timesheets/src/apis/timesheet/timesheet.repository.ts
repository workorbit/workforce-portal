import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TimesheetEntryStatus, TimesheetPeriodType, TimesheetStatus } from '@app/shared';
import { Timesheet, TimesheetDocument, TimesheetEntry } from './timesheet.schema';

export interface CreateTimesheetInput {
  employeeId: string;
  companyId: string;
  period: string;
  periodType: TimesheetPeriodType;
  entries: TimesheetEntry[];
  comment?: string;
}

@Injectable()
export class TimesheetRepository {
  constructor(
    @InjectModel(Timesheet.name) private readonly timesheetModel: Model<TimesheetDocument>,
  ) {}

  findByIdForEmployee(id: string, employeeId: string): Promise<TimesheetDocument | null> {
    return this.timesheetModel.findOne({ _id: id, employeeId, isWithdrawn: false }).exec();
  }

  findByIdForCompany(id: string, companyId: string): Promise<TimesheetDocument | null> {
    return this.timesheetModel.findOne({ _id: id, companyId, isWithdrawn: false }).exec();
  }

  findForEmployee(
    employeeId: string,
    status?: TimesheetStatus,
    entryStatus?: TimesheetEntryStatus,
    periodType?: TimesheetPeriodType,
  ): Promise<TimesheetDocument[]> {
    const query: Record<string, unknown> = { employeeId, isWithdrawn: false };
    if (status) query.status = status;
    if (entryStatus) query['entries.status'] = entryStatus;
    if (periodType) query.periodType = periodType;
    return this.timesheetModel.find(query).sort({ createdAt: -1 }).exec();
  }

  findForCompany(
    companyId: string,
    status?: TimesheetStatus,
    entryStatus?: TimesheetEntryStatus,
    periodType?: TimesheetPeriodType,
  ): Promise<TimesheetDocument[]> {
    const query: Record<string, unknown> = { companyId, isWithdrawn: false };
    if (status) query.status = status;
    if (entryStatus) query['entries.status'] = entryStatus;
    if (periodType) query.periodType = periodType;
    return this.timesheetModel.find(query).sort({ createdAt: -1 }).exec();
  }

  create(data: CreateTimesheetInput): Promise<TimesheetDocument> {
    return this.timesheetModel.create({ ...data, status: TimesheetStatus.DRAFT });
  }

  save(document: TimesheetDocument): Promise<TimesheetDocument> {
    return document.save();
  }
}
