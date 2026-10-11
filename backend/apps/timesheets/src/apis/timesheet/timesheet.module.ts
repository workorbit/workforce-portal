import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@app/shared';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';
import { TimesheetRepository } from './timesheet.repository';
import { Timesheet, TimesheetSchema } from './timesheet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Timesheet.name, schema: TimesheetSchema }]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [TimesheetController],
  providers: [TimesheetService, TimesheetRepository, JwtStrategy],
})
export class TimesheetFeatureModule {}
