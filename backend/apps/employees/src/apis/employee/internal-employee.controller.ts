import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalApiGuard } from '@app/shared';
import { EmployeeService } from './employee.service';

// No JwtAuthGuard here on purpose — this is a service-to-service call from
// timesheets/payroll/feedback (which have no other way to resolve an
// employee's name/email/pay details), not something a browser ever hits
// directly. It is served on the same public port as everything else, though,
// so InternalApiGuard is what actually keeps browsers out — being absent
// from the Swagger doc never did. This response includes salary.
@ApiExcludeController()
@UseGuards(InternalApiGuard)
@Controller('employees/internal')
export class InternalEmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const employee = await this.employeeService.findOwn(id);
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      companyId: employee.companyId,
      salary: employee.salary,
      payType: employee.payType,
    };
  }
}
