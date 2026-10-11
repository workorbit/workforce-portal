import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from './employee.schema';

export interface CreateEmployeeInput {
  companyId: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  joiningDate: Date;
  salary: number;
  payType?: 'hourly' | 'fixed';
  reportingManagerId?: string;
}

export interface UpdateOwnInput {
  name?: string;
  department?: string;
  designation?: string;
}

export interface ListEmployeesFilter {
  companyId: string;
  department?: string;
  isActive?: boolean;
}

@Injectable()
export class EmployeeRepository {
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  findByEmail(email: string): Promise<EmployeeDocument | null> {
    return this.employeeModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<EmployeeDocument | null> {
    return this.employeeModel.findById(id).exec();
  }

  // Scoped to the requesting employer's own company — never returns another
  // company's employees (doc §7.6).
  findByIdScoped(id: string, companyId: string): Promise<EmployeeDocument | null> {
    return this.employeeModel.findOne({ _id: id, companyId }).exec();
  }

  findAll(filter: ListEmployeesFilter): Promise<EmployeeDocument[]> {
    const query: Record<string, unknown> = { companyId: filter.companyId };
    if (filter.department) query.department = filter.department;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    return this.employeeModel.find(query).sort({ createdAt: -1 }).exec();
  }

  create(data: CreateEmployeeInput): Promise<EmployeeDocument> {
    return this.employeeModel.create(data);
  }

  update(
    id: string,
    companyId: string,
    data: Partial<CreateEmployeeInput>,
  ): Promise<EmployeeDocument | null> {
    return this.employeeModel
      .findOneAndUpdate({ _id: id, companyId }, data, { new: true })
      .exec();
  }

  // Self-service update (Profile screen) — scoped by id alone, no companyId
  // filter, since the caller is the employee themself (doc: employee owns
  // their own record for editable fields only; salary/payType/isActive stay
  // employer-controlled via the scoped `update` method above).
  updateOwn(id: string, data: UpdateOwnInput): Promise<EmployeeDocument | null> {
    return this.employeeModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  updateStatus(
    id: string,
    companyId: string,
    isActive: boolean,
  ): Promise<EmployeeDocument | null> {
    return this.employeeModel
      .findOneAndUpdate({ _id: id, companyId }, { isActive }, { new: true })
      .exec();
  }
}
