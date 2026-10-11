import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './auth.schema';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: User['role'];
  companyId: string;
  employeeId?: string | null;
  mustChangePassword?: boolean;
}

@Injectable()
export class AuthRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIdWithOtp(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+otpHash +otpExpiresAt').exec();
  }

  findByEmailWithOtp(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+otpHash +otpExpiresAt')
      .exec();
  }

  findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+currentHashedRefreshToken +previousHashedRefreshToken +refreshTokenRotatedAt')
      .exec();
  }

  create(data: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async setOtp(userId: string, otpHash: string, expiresAt: Date): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { otpHash, otpExpiresAt: expiresAt })
      .exec();
  }

  async clearOtp(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { otpHash: null, otpExpiresAt: null })
      .exec();
  }

  /** Stores the new token hash and keeps the one it replaced (with the time of
   * the swap) so concurrent refreshes can still be honoured briefly. */
  async rotateRefreshTokenHash(
    userId: string,
    hash: string,
    previousHash: string | null,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        currentHashedRefreshToken: hash,
        previousHashedRefreshToken: previousHash,
        refreshTokenRotatedAt: new Date(),
      })
      .exec();
  }

  async clearRefreshTokens(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        currentHashedRefreshToken: null,
        previousHashedRefreshToken: null,
        refreshTokenRotatedAt: null,
      })
      .exec();
  }

  async setPasswordHash(
    userId: string,
    passwordHash: string,
    mustChangePassword = false,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { passwordHash, mustChangePassword })
      .exec();
  }

  async updatePayCycleStartDay(userId: string, payCycleStartDay: number): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { payCycleStartDay }).exec();
  }
}
