import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, UserRole } from '@app/shared';
import type { JwtPayload } from '@app/shared';
import { EmployeeService } from './employee.service';
import { EmployeeDocument } from './employee.schema';
import {
  CreateEmployeeRequestDto,
  EmployeeResponseDto,
  UpdateEmployeeRequestDto,
  UpdateEmployeeStatusRequestDto,
  UpdateOwnEmployeeRequestDto,
} from './employee.dto';

@ApiTags('Employees')
@Controller('employees')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @ApiOperation({ summary: 'The logged-in employee\'s own record (for the Profile screen)' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.findOwn(user.employeeId!);
    return this.toResponse(employee);
  }

  @ApiOperation({ summary: 'Update the logged-in employee\'s own editable profile fields' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Patch('me')
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOwnEmployeeRequestDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.updateOwn(user.employeeId!, dto);
    return this.toResponse(employee);
  }

  @ApiOperation({ summary: 'Searchable/filterable employee directory (doc §3.1)' })
  @ApiOkResponse({ type: [EmployeeResponseDto] })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('department') department?: string,
    @Query('isActive') isActive?: string,
  ): Promise<EmployeeResponseDto[]> {
    const employees = await this.employeeService.findAll(user.companyId, {
      department,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
    return employees.map((employee) => this.toResponse(employee));
  }

  @ApiOperation({ summary: 'Create an employee — provisions their login too (doc §3.1)' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEmployeeRequestDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.create(user.companyId, dto);
    return this.toResponse(employee);
  }

  @ApiOperation({ summary: 'Edit an employee\'s details' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeRequestDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.update(id, user.companyId, dto);
    return this.toResponse(employee);
  }

  @ApiOperation({ summary: 'Set an employee Active / Inactive (doc §3.2)' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeStatusRequestDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.updateStatus(id, user.companyId, dto.isActive);
    return this.toResponse(employee);
  }

  private toResponse(employee: EmployeeDocument): EmployeeResponseDto {
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      designation: employee.designation,
      joiningDate: employee.joiningDate,
      salary: employee.salary,
      payType: employee.payType,
      reportingManagerId: employee.reportingManagerId,
      isActive: employee.isActive,
      createdAt: employee.createdAt!,
    };
  }
}
