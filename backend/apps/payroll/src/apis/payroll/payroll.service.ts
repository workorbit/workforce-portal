import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  findEmployeeById,
  PayrollClaimStatus,
  sendPayrollPaidEmail,
  sendPayrollStatusEmail,
} from '@app/shared';
import { PayrollRepository } from './payroll.repository';
import { PayrollClaimDocument } from './payroll.schema';
import { SaveDraftRequestDto, UpdateStatusRequestDto } from './payroll.dto';

export interface ListPayrollClaimsFilters {
  status?: PayrollClaimStatus;
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
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private readonly payrollRepository: PayrollRepository) {}

  private computeNetPay(basicPay: number, bonus: number, deductions: number, reimbursement: number): number {
    return basicPay + bonus + reimbursement - deductions;
  }

  saveDraft(employeeId: string, companyId: string, dto: SaveDraftRequestDto): Promise<PayrollClaimDocument> {
    const bonus = dto.bonus ?? 0;
    const deductions = dto.deductions ?? 0;
    const reimbursement = dto.reimbursement ?? 0;
    return this.payrollRepository.create({
      employeeId,
      companyId,
      period: dto.period,
      basicPay: dto.basicPay,
      bonus,
      deductions,
      reimbursement,
      netPay: this.computeNetPay(dto.basicPay, bonus, deductions, reimbursement),
      notes: dto.notes,
    });
  }

  async updateDraft(
    id: string,
    employeeId: string,
    dto: SaveDraftRequestDto,
  ): Promise<PayrollClaimDocument> {
    const claim = await this.payrollRepository.findByIdForEmployee(id, employeeId);
    if (!claim) {
      throw new NotFoundException('Payroll claim not found');
    }
    if (claim.status !== PayrollClaimStatus.DRAFT && claim.status !== PayrollClaimStatus.REJECTED) {
      throw new BadRequestException('Only draft or rejected claims can be edited');
    }

    const bonus = dto.bonus ?? 0;
    const deductions = dto.deductions ?? 0;
    const reimbursement = dto.reimbursement ?? 0;
    claim.period = dto.period;
    claim.basicPay = dto.basicPay;
    claim.bonus = bonus;
    claim.deductions = deductions;
    claim.reimbursement = reimbursement;
    claim.netPay = this.computeNetPay(dto.basicPay, bonus, deductions, reimbursement);
    claim.notes = dto.notes;
    return this.payrollRepository.save(claim);
  }

  async submit(id: string, employeeId: string): Promise<PayrollClaimDocument> {
    const claim = await this.payrollRepository.findByIdForEmployee(id, employeeId);
    if (!claim) {
      throw new NotFoundException('Payroll claim not found');
    }
    if (claim.status !== PayrollClaimStatus.DRAFT && claim.status !== PayrollClaimStatus.REJECTED) {
      throw new BadRequestException('Claim has already been submitted');
    }

    claim.status = PayrollClaimStatus.PENDING;
    claim.statusHistory.push({
      status: PayrollClaimStatus.PENDING,
      changedBy: employeeId,
      changedAt: new Date(),
    });
    return this.payrollRepository.save(claim);
  }

  async findForEmployee(
    employeeId: string,
    filters: ListPayrollClaimsFilters = {},
  ): Promise<ListResult<PayrollClaimDocument>> {
    const all = await this.payrollRepository.findForEmployee(employeeId, filters.status);
    return this.applyRemainingFilters(all, filters);
  }

  async findForCompany(
    companyId: string,
    filters: ListPayrollClaimsFilters = {},
  ): Promise<ListResult<PayrollClaimDocument>> {
    const all = await this.payrollRepository.findForCompany(companyId, filters.status);
    return this.applyRemainingFilters(all, filters);
  }

  // dateFrom/dateTo, free-text search, and pagination are applied here, in
  // application code, after the DB fetch — same house style as
  // TimesheetService.applyRemainingFilters, justified by the fact that a
  // claim is at most one per employee per month, so per-employee/company
  // counts stay small.
  private applyRemainingFilters(
    claims: PayrollClaimDocument[],
    { dateFrom, dateTo, search, page, limit }: ListPayrollClaimsFilters,
  ): ListResult<PayrollClaimDocument> {
    let filtered = claims;
    if (dateFrom) filtered = filtered.filter((c) => c.period >= dateFrom);
    if (dateTo) filtered = filtered.filter((c) => c.period <= dateTo);
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (c) => c.period.toLowerCase().includes(query) || (c.notes ?? '').toLowerCase().includes(query),
      );
    }

    const total = filtered.length;
    if (page && limit) {
      const start = (page - 1) * limit;
      filtered = filtered.slice(start, start + limit);
    }
    return { items: filtered, total };
  }

  async findOneForEmployee(id: string, employeeId: string): Promise<PayrollClaimDocument> {
    const claim = await this.payrollRepository.findByIdForEmployee(id, employeeId);
    if (!claim) {
      throw new NotFoundException('Payroll claim not found');
    }
    return claim;
  }

  async findOneForCompany(id: string, companyId: string): Promise<PayrollClaimDocument> {
    const claim = await this.payrollRepository.findByIdForCompany(id, companyId);
    if (!claim) {
      throw new NotFoundException('Payroll claim not found');
    }
    return claim;
  }

  async updateStatus(
    id: string,
    companyId: string,
    actingUserId: string,
    dto: UpdateStatusRequestDto,
  ): Promise<PayrollClaimDocument> {
    if (dto.status === PayrollClaimStatus.REJECTED && !dto.remarks) {
      throw new BadRequestException('Remarks are required when rejecting a payroll claim');
    }

    const claim = await this.payrollRepository.findByIdForCompany(id, companyId);
    if (!claim) {
      throw new NotFoundException('Payroll claim not found');
    }
    if (claim.status === PayrollClaimStatus.DRAFT) {
      throw new ForbiddenException('Draft claims are not yet submitted for review');
    }

    claim.status = dto.status;
    claim.statusHistory.push({
      status: dto.status,
      remarks: dto.remarks,
      changedBy: actingUserId,
      changedAt: new Date(),
    });
    const saved = await this.payrollRepository.save(claim);

    this.notifyStatusSafely(saved);
    return saved;
  }

  // Separate from updateStatus: PAID is a one-way follow-up action only
  // available once APPROVED, with no remarks concept and a different guard
  // condition — not one of the reviewer's three approve/reject/keep-pending
  // decision buttons.
  async markPaid(id: string, companyId: string, actingUserId: string): Promise<PayrollClaimDocument> {
    const claim = await this.payrollRepository.findByIdForCompany(id, companyId);
    if (!claim) {
      throw new NotFoundException('Payroll claim not found');
    }
    if (claim.status !== PayrollClaimStatus.APPROVED) {
      throw new BadRequestException('Only approved claims can be marked as paid');
    }

    claim.status = PayrollClaimStatus.PAID;
    claim.statusHistory.push({
      status: PayrollClaimStatus.PAID,
      changedBy: actingUserId,
      changedAt: new Date(),
    });
    const saved = await this.payrollRepository.save(claim);

    this.notifyPaidSafely(saved);
    return saved;
  }

  private notifyStatusSafely(claim: PayrollClaimDocument): void {
    findEmployeeById(claim.employeeId)
      .then((employee) => {
        if (!employee) return;
        return sendPayrollStatusEmail({
          to: employee.email,
          name: employee.name,
          status: claim.status as 'approved' | 'rejected' | 'pending',
          period: claim.period,
          remarks: claim.statusHistory.at(-1)?.remarks,
        });
      })
      .catch((error: Error) => {
        this.logger.error(`Failed to send payroll status email for claim ${claim.id}`, error.stack);
      });
  }

  private notifyPaidSafely(claim: PayrollClaimDocument): void {
    findEmployeeById(claim.employeeId)
      .then((employee) => {
        if (!employee) return;
        return sendPayrollPaidEmail({
          to: employee.email,
          name: employee.name,
          period: claim.period,
          netPay: claim.netPay,
        });
      })
      .catch((error: Error) => {
        this.logger.error(`Failed to send payroll paid email for claim ${claim.id}`, error.stack);
      });
  }
}
