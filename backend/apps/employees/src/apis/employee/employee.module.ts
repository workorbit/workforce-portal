import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@app/shared';
import { EmployeeController } from './employee.controller';
import { InternalEmployeeController } from './internal-employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { Employee, EmployeeSchema } from './employee.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [EmployeeController, InternalEmployeeController],
  providers: [EmployeeService, EmployeeRepository, JwtStrategy],
})
export class EmployeeFeatureModule {}
