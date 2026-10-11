import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  findUserById,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserRole,
} from '@app/shared';
import type { JwtPayload } from '@app/shared';
import { TimesheetService } from './timesheet.service';
import { TimesheetDocument } from './timesheet.schema';
import {
  ListTimesheetsQueryDto,
  PaginatedTimesheetResponseDto,
  SaveDraftRequestDto,
  TimesheetResponseDto,
  UpdateStatusRequestDto,
} from './timesheet.dto';

@ApiTags('Timesheets')
@Controller('timesheets')
export class TimesheetController {
  private readonly logger = new Logger(TimesheetController.name);

  constructor(private readonly timesheetService: TimesheetService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Save a timesheet as a draft (doc §4.4)' })
  @ApiOkResponse({ type: TimesheetResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Post()
  async saveDraft(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveDraftRequestDto,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.timesheetService.saveDraft(user.employeeId!, user.companyId, dto);
    return this.toResponse(timesheet);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Edit a draft or rejected timesheet' })
  @ApiOkResponse({ type: TimesheetResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Put(':id')
  async updateDraft(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SaveDraftRequestDto,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.timesheetService.updateDraft(id, user.employeeId!, dto);
    return this.toResponse(timesheet);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Submit a timesheet for employer review' })
  @ApiOkResponse({ type: TimesheetResponseDto })
  @Roles(UserRole.EMPLOYEE)
  @Post(':id/submit')
  async submit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.timesheetService.submit(id, user.employeeId!);
    return this.toResponse(timesheet);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary:
      'List timesheets — own history for an employee, the approval queue for an employer. ' +
      'Omit page/limit to get every match unpaginated.',
  })
  @ApiOkResponse({ type: PaginatedTimesheetResponseDto })
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListTimesheetsQueryDto,
  ): Promise<PaginatedTimesheetResponseDto> {
    const { items, total } =
      user.role === UserRole.EMPLOYEE
        ? await this.timesheetService.findForEmployee(user.employeeId!, query)
        : await this.timesheetService.findForCompany(user.companyId, query);
    return { items: await Promise.all(items.map((timesheet) => this.toResponse(timesheet))), total };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Timesheet detail, including the full remarks/status thread' })
  @ApiOkResponse({ type: TimesheetResponseDto })
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<TimesheetResponseDto> {
    const timesheet =
      user.role === UserRole.EMPLOYEE
        ? await this.timesheetService.findOneForEmployee(id, user.employeeId!)
        : await this.timesheetService.findOneForCompany(id, user.companyId);
    return this.toResponse(timesheet);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Approve, reject, or keep-pending a timesheet, with remarks (doc §3.3)' })
  @ApiOkResponse({ type: TimesheetResponseDto })
  @Roles(UserRole.EMPLOYER_ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusRequestDto,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.timesheetService.updateStatus(id, user.companyId, user.sub, dto);
    return this.toResponse(timesheet);
  }

  private async toResponse(timesheet: TimesheetDocument): Promise<TimesheetResponseDto> {
    // Resolve the employer's own display name (used as "Bill To") and every
    // distinct approver id in the history thread (used as "Approved By") in
    // one deduped batch. A lookup failure never breaks the read — it just
    // falls back to leaving the name unresolved, same convention as
    // notifyEmployeeSafely below.
    const idsToResolve = new Set([timesheet.companyId, ...timesheet.statusHistory.map((e) => e.changedBy)]);
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
      id: timesheet.id,
      employeeId: timesheet.employeeId,
      companyId: timesheet.companyId,
      period: timesheet.period,
      periodType: timesheet.periodType,
      entries: timesheet.entries,
      comment: timesheet.comment,
      totalHours: timesheet.entries.reduce((sum, entry) => sum + entry.hours, 0),
      status: timesheet.status,
      statusHistory: timesheet.statusHistory.map((event) => ({
        status: event.status,
        remarks: event.remarks,
        changedBy: event.changedBy,
        changedByName: names.get(event.changedBy),
        changedAt: event.changedAt,
      })),
      companyName: names.get(timesheet.companyId),
      createdAt: timesheet.createdAt!,
    };
  }
}
