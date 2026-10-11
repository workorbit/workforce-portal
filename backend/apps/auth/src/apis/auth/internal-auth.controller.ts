import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InternalApiGuard } from '@app/shared';
import { AuthService } from './auth.service';

// No JwtAuthGuard here on purpose — this is a service-to-service call from
// timesheets (which has no other way to resolve an employer_admin's display
// name for "Bill To"/"Approved By"), not something a browser ever hits
// directly. It is served on the same public port as everything else, though,
// so InternalApiGuard is what actually keeps browsers out — being absent
// from the Swagger doc never did.
// Also exempt from the app's rate limiting: a single timesheet-list request
// can legitimately fan out into several of these calls (one per distinct
// approver id), which isn't the brute-force pattern throttling targets.
@ApiExcludeController()
@SkipThrottle()
@UseGuards(InternalApiGuard)
@Controller('auth/internal/users')
export class InternalAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findInternal(id);
  }
}
