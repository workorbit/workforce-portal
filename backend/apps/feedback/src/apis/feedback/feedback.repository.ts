import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedbackCategory } from '@app/shared';
import { Feedback, FeedbackDocument } from './feedback.schema';

@Injectable()
export class FeedbackRepository {
  constructor(
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
  ) {}

  create(
    employeeId: string,
    companyId: string,
    category: FeedbackCategory,
    description: string,
  ): Promise<FeedbackDocument> {
    return this.feedbackModel.create({ employeeId, companyId, category, description });
  }

  findByIdForEmployee(id: string, employeeId: string): Promise<FeedbackDocument | null> {
    return this.feedbackModel.findOne({ _id: id, employeeId }).exec();
  }

  findByIdForCompany(id: string, companyId: string): Promise<FeedbackDocument | null> {
    return this.feedbackModel.findOne({ _id: id, companyId }).exec();
  }

  findForEmployee(employeeId: string): Promise<FeedbackDocument[]> {
    return this.feedbackModel.find({ employeeId }).sort({ createdAt: -1 }).exec();
  }

  findForCompany(companyId: string): Promise<FeedbackDocument[]> {
    return this.feedbackModel.find({ companyId }).sort({ createdAt: -1 }).exec();
  }

  save(document: FeedbackDocument): Promise<FeedbackDocument> {
    return document.save();
  }
}
