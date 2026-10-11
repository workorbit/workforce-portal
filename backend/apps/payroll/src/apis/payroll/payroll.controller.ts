import { Body, Controller, Get, Logger, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, findUserById, JwtAuthGuard, Roles, RolesGuard, UserRole } from '@app/shared';
import type { JwtPayload } from '@app/shared';
import { PayrollService } from './payroll.service';
import { PayrollClaimDocument } from './payroll.schema';
import {
  ListPayrollClaimsQueryDto,
  PaginatedPayrollClaimResponseDto,
  PayrollClaimResponseDto,
  SaveDraftRequestDto,
  UpdateStatusRequestDto,
} from './payroll.dto';

@ApiTags('Payroll')
@Controller('payroll')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  private readonly logger = new Logger(PayrollController.name);

  constructor(private readonly payrollService: PayrollService) {}

  @ApiOperation({ summary: 'Save a payroll claim as a draft' })
  @ApiOkResponse({ type: PayrollClaimResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Post()
  async saveDraft(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveDraftRequestDto,
  ): Promise<PayrollClaimResponseDto> {
    const claim = await this.payrollService.saveDraft(user.employeeId!, user.companyId, dto);
    return this.toResponse(claim);
  }

  @ApiOperation({ summary: 'Edit a draft or rejected payroll claim' })
  @ApiOkResponse({ type: PayrollClaimResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Put(':id')
  async updateDraft(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SaveDraftRequestDto,
  ): Promise<PayrollClaimResponseDto> {
    const claim = await this.payrollService.updateDraft(id, user.employeeId!, dto);
    return this.toResponse(claim);
  }

  @ApiOperation({ summary: 'Submit a payroll claim for employer review' })
  @ApiOkResponse({ type: PayrollClaimResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Post(':id/submit')
  async submit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PayrollClaimResponseDto> {
    const claim = await this.payrollService.submit(id, user.employeeId!);
    return this.toResponse(claim);
  }

  @ApiOperation({
    summary:
      'List payroll claims — own history for an employee, the approval queue for an employer. ' +
      'Omit page/limit to get every match unpaginated.',
  })
  @ApiOkResponse({ type: PaginatedPayrollClaimResponseDto })
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListPayrollClaimsQueryDto,
  ): Promise<PaginatedPayrollClaimResponseDto> {
    const { items, total } =
      user.role === UserRole.EMPLOYEE
        ? await this.payrollService.findForEmployee(user.employeeId!, query)
        : await this.payrollService.findForCompany(user.companyId, query);
    return { items: await Promise.all(items.map((claim) => this.toResponse(claim))), total };
  }

  @ApiOperation({ summary: 'Payroll claim detail, including the full remarks/status thread' })
  @ApiOkResponse({ type: PayrollClaimResponseDto })
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PayrollClaimResponseDto> {
    const claim =
      user.role === UserRole.EMPLOYEE
        ? await this.payrollService.findOneForEmployee(id, user.employeeId!)
        : await this.payrollService.findOneForCompany(id, user.companyId);
    return this.toResponse(claim);
  }

  @ApiOperation({ summary: 'Approve, reject, or keep-pending a payroll claim, with remarks' })
  @ApiOkResponse({ type: PayrollClaimResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusRequestDto,
  ): Promise<PayrollClaimResponseDto> {
    const claim = await this.payrollService.updateStatus(id, user.companyId, user.sub, dto);
    return this.toResponse(claim);
  }

  @ApiOperation({ summary: 'Mark an approved payroll claim as paid' })
  @ApiOkResponse({ type: PayrollClaimResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Patch(':id/mark-paid')
  async markPaid(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PayrollClaimResponseDto> {
    const claim = await this.payrollService.markPaid(id, user.companyId, user.sub);
    return this.toResponse(claim);
  }

  private async toResponse(claim: PayrollClaimDocument): Promise<PayrollClaimResponseDto> {
    // Resolve the employer's own display name (used as "Bill To") and every
    // distinct actor id in the history thread in one deduped batch. A lookup
    // failure never breaks the read — same convention as
    // TimesheetController.toResponse.
    const idsToResolve = new Set([claim.companyId, ...claim.statusHistory.map((e) => e.changedBy)]);
    const names = new Map<string, string>();
    await Promise.all(
      Array.from(idsToResolve).map(async (id) => {
        try {
          const user = await findUserById(id);
          if (user) names.set(id, user.name);
        } catch (error) {
          this.logger.warn(`Failed to resolve display name for user ${id}`);
        }
      }),
    );

    return {
      id: claim.id,
      employeeId: claim.employeeId,
      companyId: claim.companyId,
      period: claim.period,
      basicPay: claim.basicPay,
      bonus: claim.bonus,
      deductions: claim.deductions,
      reimbursement: claim.reimbursement,
      netPay: claim.netPay,
      notes: claim.notes,
      status: claim.status,
      statusHistory: claim.statusHistory.map((event) => ({
        status: event.status,
        remarks: event.remarks,
        changedBy: event.changedBy,
        changedByName: names.get(event.changedBy),
        changedAt: event.changedAt,
      })),
      companyName: names.get(claim.companyId),
      createdAt: claim.createdAt!,
    };
  }
}
