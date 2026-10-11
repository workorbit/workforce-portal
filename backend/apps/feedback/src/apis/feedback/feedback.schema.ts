import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FeedbackCategory, FeedbackStatus } from '@app/shared';

export type FeedbackDocument = HydratedDocument<Feedback>;

@Schema({ _id: false })
export class FeedbackReply {
  @Prop({ required: true })
  message!: string;

  @Prop({ required: true })
  byUserId!: string;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}
export const FeedbackReplySchema = SchemaFactory.createForClass(FeedbackReply);

@Schema({ timestamps: true })
export class Feedback {
  @Prop({ required: true })
  employeeId!: string;

  @Prop({ required: true })
  companyId!: string;

  @Prop({ type: String, enum: FeedbackCategory, required: true })
  category!: FeedbackCategory;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: String, enum: FeedbackStatus, default: FeedbackStatus.OPEN })
  status!: FeedbackStatus;

  // Employer replies appear alongside the original submission so the
  // conversation stays together (doc §4.6).
  @Prop({ type: [FeedbackReplySchema], default: [] })
  replies!: FeedbackReply[];

  // Resolved/old items move to an archived view instead of being removed
  // (doc §7.5) — history stays visible to the employee either way (doc §4.6).
  @Prop({ type: Boolean, default: false })
  isArchived: boolean = false;

  createdAt?: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
