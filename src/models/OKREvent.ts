import { Schema, model, Types, Model } from 'mongoose';

// Типы событий для OKR
export enum OKREventType {
  CREATED = 'created',
  PROGRESS_UPDATED = 'progress_updated',
  KR_PROGRESS_UPDATED = 'kr_progress_updated',
  FROZEN = 'frozen',
  UNFROZEN = 'unfrozen',
  COMPLETED = 'completed',
  DEADLINE_SET = 'deadline_set',
  DEADLINE_APPROACHING = 'deadline_approaching',
  DEADLINE_PASSED = 'deadline_passed',
  CHECK_IN_CREATED = 'check_in_created',
  CHECK_IN_UPDATED = 'check_in_updated'
}

const OKREventSchema = new Schema({
  okr: { type: Schema.Types.ObjectId, ref: 'OKR', required: true },
  corporateOKR: { type: Schema.Types.ObjectId, ref: 'CorporateOKR' },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  type: { 
    type: String, 
    enum: Object.values(OKREventType),
    required: true 
  },
  description: { type: String, required: true },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  }],
  metadata: {
    previousValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    changes: [{
      field: String,
      oldValue: Schema.Types.Mixed,
      newValue: Schema.Types.Mixed
    }]
  },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  notificationSentAt: { type: Date }
}, { timestamps: true });

// Индексы для оптимизации запросов
OKREventSchema.index({ okr: 1, createdAt: -1 });
OKREventSchema.index({ corporateOKR: 1, createdAt: -1 });
OKREventSchema.index({ team: 1, createdAt: -1 });
OKREventSchema.index({ company: 1, createdAt: -1 });
OKREventSchema.index({ type: 1, createdAt: -1 });
OKREventSchema.index({ 'recipients.user': 1, 'recipients.read': 1 });

interface IOKREvent {
  okr: Types.ObjectId;
  corporateOKR?: Types.ObjectId;
  team: Types.ObjectId;
  company: Types.ObjectId;
  type: OKREventType;
  description: string;
  createdBy: Types.ObjectId;
  data?: any;
  metadata?: {
    previousValue?: any;
    newValue?: any;
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  };
  recipients?: Array<{ user: Types.ObjectId }>;
}

interface IOKREventModel extends Model<IOKREvent> {
  createOKREvent(data: {
    okr: Types.ObjectId;
    corporateOKR?: Types.ObjectId;
    team: Types.ObjectId;
    company: Types.ObjectId;
    type: OKREventType;
    description: string;
    createdBy: Types.ObjectId;
    data?: any;
    metadata?: {
      previousValue?: any;
      newValue?: any;
      changes?: Array<{
        field: string;
        oldValue: any;
        newValue: any;
      }>;
    };
    recipients?: Types.ObjectId[];
  }): Promise<IOKREvent>;
}

// Статические методы для создания событий
OKREventSchema.statics.createOKREvent = async function(data: {
  okr: Types.ObjectId;
  corporateOKR?: Types.ObjectId;
  team: Types.ObjectId;
  company: Types.ObjectId;
  type: OKREventType;
  description: string;
  createdBy: Types.ObjectId;
  data?: any;
  metadata?: {
    previousValue?: any;
    newValue?: any;
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  };
  recipients?: Types.ObjectId[];
}) {
  const event = new this({
    ...data,
    recipients: data.recipients?.map(userId => ({ user: userId })) || []
  });
  await event.save();
  return event;
};

// Middleware для OKR
export const createOKREvent = async (data: {
  okr: Types.ObjectId;
  corporateOKR?: Types.ObjectId;
  team: Types.ObjectId;
  company: Types.ObjectId;
  type: OKREventType;
  description: string;
  createdBy: Types.ObjectId;
  data?: any;
  metadata?: {
    previousValue?: any;
    newValue?: any;
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  };
  recipients?: Types.ObjectId[];
}) => {
  return OKREvent.createOKREvent(data);
};

export const OKREvent = model<IOKREvent, IOKREventModel>('OKREvent', OKREventSchema); 