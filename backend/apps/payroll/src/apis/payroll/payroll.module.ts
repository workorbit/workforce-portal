import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@app/shared';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { PayrollClaim, PayrollClaimSchema } from './payroll.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PayrollClaim.name, schema: PayrollClaimSchema }]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRepository, JwtStrategy],
})
export class PayrollFeatureModule {}
