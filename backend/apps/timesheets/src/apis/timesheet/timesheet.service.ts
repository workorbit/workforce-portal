import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  findEmployeeById,
  sendTimesheetStatusEmail,
  TimesheetEntryStatus,
  TimesheetPeriodType,
  TimesheetStatus,
} from '@app/shared';
import { TimesheetRepository } from './timesheet.repository';
import { TimesheetDocument } from './timesheet.schema';
import { SaveDraftRequestDto, UpdateStatusRequestDto } from './timesheet.dto';

export interface ListTimesheetsFilters {
  status?: TimesheetStatus;
  entryStatus?: TimesheetEntryStatus;
  periodType?: TimesheetPeriodType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

@Injectable()
export class TimesheetService {
  private readonly logger = new Logger(TimesheetService.name);

  constructor(private readonly timesheetRepository: TimesheetRepository) {}

  saveDraft(
    employeeId: string,
    companyId: string,
    dto: SaveDraftRequestDto,
  ): Promise<TimesheetDocument> {
    return this.timesheetRepository.create({
      employeeId,
      companyId,
      period: dto.period,
      periodType: dto.periodType,
      entries: dto.entries,
      comment: dto.comment,
    });
  }

  async updateDraft(
    id: string,
    employeeId: string,
    dto: SaveDraftRequestDto,
  ): Promise<TimesheetDocument> {
    const timesheet = await this.timesheetRepository.findByIdForEmployee(id, employeeId);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }
    if (timesheet.status !== TimesheetStatus.DRAFT && timesheet.status !== TimesheetStatus.REJECTED) {
      throw new BadRequestException('Only draft or rejected timesheets can be edited');
    }

    timesheet.period = dto.period;
    timesheet.periodType = dto.periodType;
    timesheet.entries = dto.entries;
    timesheet.comment = dto.comment;
    return this.timesheetRepository.save(timesheet);
  }

  async submit(id: string, employeeId: string): Promise<TimesheetDocument> {
    const timesheet = await this.timesheetRepository.findByIdForEmployee(id, employeeId);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }
    if (timesheet.status !== TimesheetStatus.DRAFT && timesheet.status !== TimesheetStatus.REJECTED) {
      throw new BadRequestException('Timesheet has already been submitted');
    }

    timesheet.status = TimesheetStatus.PENDING;
    timesheet.statusHistory.push({
      status: TimesheetStatus.PENDING,
      changedBy: employeeId,
      changedAt: new Date(),
    });
    return this.timesheetRepository.save(timesheet);
  }

  async findForEmployee(
    employeeId: string,
    filters: ListTimesheetsFilters = {},
  ): Promise<ListResult<TimesheetDocument>> {
    const all = await this.timesheetRepository.findForEmployee(
      employeeId,
      filters.status,
      filters.entryStatus,
      filters.periodType,
    );
    return this.applyRemainingFilters(all, filters);
  }

  async findForCompany(
    companyId: string,
    filters: ListTimesheetsFilters = {},
  ): Promise<ListResult<TimesheetDocument>> {
    const all = await this.timesheetRepository.findForCompany(
      companyId,
      filters.status,
      filters.entryStatus,
      filters.periodType,
    );
    return this.applyRemainingFilters(all, filters);
  }

  // dateFrom/dateTo, free-text search, and pagination are applied here, in
  // application code, after the DB fetch — matching the existing house
  // style (see TimesheetController.approvedHours) rather than pushing
  // every condition into the Mongo query. One employee's/company's
  // timesheet count is always small enough that this stays simple without
  // costing anything.
  private applyRemainingFilters(
    timesheets: TimesheetDocument[],
    { dateFrom, dateTo, search, page, limit }: ListTimesheetsFilters,
  ): ListResult<TimesheetDocument> {
    const periodStart = (timesheet: TimesheetDocument): string =>
      timesheet.periodType === TimesheetPeriodType.MONTHLY
        ? `${timesheet.period}-01`
        : timesheet.period;

    let filtered = timesheets;
    if (dateFrom) filtered = filtered.filter((t) => periodStart(t) >= dateFrom);
    if (dateTo) filtered = filtered.filter((t) => periodStart(t) <= dateTo);
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.period.toLowerCase().includes(query) ||
          (t.comment ?? '').toLowerCase().includes(query) ||
          t.entries.some((entry) => (entry.task ?? '').toLowerCase().includes(query)),
      );
    }

    const total = filtered.length;
    if (page && limit) {
      const start = (page - 1) * limit;
      filtered = filtered.slice(start, start + limit);
    }
    return { items: filtered, total };
  }

  async findOneForEmployee(id: string, employeeId: string): Promise<TimesheetDocument> {
    const timesheet = await this.timesheetRepository.findByIdForEmployee(id, employeeId);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }
    return timesheet;
  }

  async findOneForCompany(id: string, companyId: string): Promise<TimesheetDocument> {
    const timesheet = await this.timesheetRepository.findByIdForCompany(id, companyId);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }
    return timesheet;
  }

  async updateStatus(
    id: string,
    companyId: string,
    actingUserId: string,
    dto: UpdateStatusRequestDto,
  ): Promise<TimesheetDocument> {
    if (dto.status === TimesheetStatus.REJECTED && !dto.remarks) {
      throw new BadRequestException('Remarks are required when rejecting a timesheet');
    }

    const timesheet = await this.timesheetRepository.findByIdForCompany(id, companyId);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }
    if (timesheet.status === TimesheetStatus.DRAFT) {
      throw new ForbiddenException('Draft timesheets are not yet submitted for review');
    }

    timesheet.status = dto.status;
    timesheet.statusHistory.push({
      status: dto.status,
      remarks: dto.remarks,
      changedBy: actingUserId,
      changedAt: new Date(),
    });
    const saved = await this.timesheetRepository.save(timesheet);

    this.notifyEmployeeSafely(saved);
    return saved;
  }

  private notifyEmployeeSafely(timesheet: TimesheetDocument): void {
    findEmployeeById(timesheet.employeeId)
      .then((employee) => {
        if (!employee) return;
        return sendTimesheetStatusEmail({
          to: employee.email,
          name: employee.name,
          status: timesheet.status as 'approved' | 'rejected' | 'pending',
          period: timesheet.period,
          remarks: timesheet.statusHistory.at(-1)?.remarks,
        });
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to send timesheet status email for timesheet ${timesheet.id}`,
          error.stack,
        );
      });
  }
}
