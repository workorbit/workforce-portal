import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { provisionEmployeeAccount } from '@app/shared';
import { EmployeeRepository } from './employee.repository';
import { EmployeeDocument } from './employee.schema';
import {
  CreateEmployeeRequestDto,
  UpdateEmployeeRequestDto,
  UpdateOwnEmployeeRequestDto,
} from './employee.dto';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async create(companyId: string, dto: CreateEmployeeRequestDto): Promise<EmployeeDocument> {
    const existing = await this.employeeRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An employee with this email already exists');
    }

    const employee = await this.employeeRepository.create({
      companyId,
      name: dto.name,
      email: dto.email,
      department: dto.department,
      designation: dto.designation,
      joiningDate: new Date(dto.joiningDate),
      salary: dto.salary,
      payType: dto.payType,
      reportingManagerId: dto.reportingManagerId,
    });

    // Employer is the source of truth for the employee record (doc §1); the
    // `auth` app owns the login credential itself. If provisioning fails,
    // the employee record still exists — the employer can be told to retry
    // (kept fire-and-forget here to not block the create-employee response
    // on the auth app being up).
    provisionEmployeeAccount({
      employeeId: employee.id,
      companyId,
      email: employee.email,
      name: employee.name,
      initialPassword: dto.initialPassword,
    }).catch((error: Error) => {
      this.logger.error(
        `Failed to provision login for employee ${employee.email}`,
        error.stack,
      );
    });

    return employee;
  }

  async findAll(
    companyId: string,
    filters: { department?: string; isActive?: boolean },
  ): Promise<EmployeeDocument[]> {
    return this.employeeRepository.findAll({ companyId, ...filters });
  }

  async findOne(id: string, companyId: string): Promise<EmployeeDocument> {
    const employee = await this.employeeRepository.findByIdScoped(id, companyId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async findOwn(employeeId: string): Promise<EmployeeDocument> {
    const employee = await this.employeeRepository.findById(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee record not found');
    }
    return employee;
  }

  async updateOwn(
    employeeId: string,
    dto: UpdateOwnEmployeeRequestDto,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeRepository.updateOwn(employeeId, dto);
    if (!employee) {
      throw new NotFoundException('Employee record not found');
    }
    return employee;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateEmployeeRequestDto,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeRepository.update(id, companyId, dto);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async updateStatus(
    id: string,
    companyId: string,
    isActive: boolean,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeRepository.updateStatus(id, companyId, isActive);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }
}
