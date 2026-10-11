import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PayrollClaimStatus } from '@app/shared';
import { PayrollClaim, PayrollClaimDocument } from './payroll.schema';

export interface CreatePayrollClaimInput {
  employeeId: string;
  companyId: string;
  period: string;
  basicPay: number;
  bonus: number;
  deductions: number;
  reimbursement: number;
  netPay: number;
  notes?: string;
}

@Injectable()
export class PayrollRepository {
  constructor(
    @InjectModel(PayrollClaim.name) private readonly payrollClaimModel: Model<PayrollClaimDocument>,
  ) {}

  findByIdForEmployee(id: string, employeeId: string): Promise<PayrollClaimDocument | null> {
    return this.payrollClaimModel.findOne({ _id: id, employeeId, isWithdrawn: false }).exec();
  }

  findByIdForCompany(id: string, companyId: string): Promise<PayrollClaimDocument | null> {
    return this.payrollClaimModel.findOne({ _id: id, companyId, isWithdrawn: false }).exec();
  }

  findForEmployee(employeeId: string, status?: PayrollClaimStatus): Promise<PayrollClaimDocument[]> {
    const query: Record<string, unknown> = { employeeId, isWithdrawn: false };
    if (status) query.status = status;
    return this.payrollClaimModel.find(query).sort({ createdAt: -1 }).exec();
  }

  findForCompany(companyId: string, status?: PayrollClaimStatus): Promise<PayrollClaimDocument[]> {
    const query: Record<string, unknown> = { companyId, isWithdrawn: false };
    if (status) query.status = status;
    return this.payrollClaimModel.find(query).sort({ createdAt: -1 }).exec();
  }

  create(data: CreatePayrollClaimInput): Promise<PayrollClaimDocument> {
    return this.payrollClaimModel.create({ ...data, status: PayrollClaimStatus.DRAFT });
  }

  save(document: PayrollClaimDocument): Promise<PayrollClaimDocument> {
    return document.save();
  }
}
