import { Schema, model, Types } from 'mongoose';

// Типы событий для OKR
export enum OKREventType {
  // События создания
  CREATED = 'created',
  
  // События прогресса
  PROGRESS_UPDATED = 'progress_updated',
  KR_PROGRESS_UPDATED = 'kr_progress_updated',
  
  // События статуса
  FROZEN = 'frozen',
  UNFROZEN = 'unfrozen',
  COMPLETED = 'completed',
  
  // События дедлайна
  DEADLINE_SET = 'deadline_set',
  DEADLINE_APPROACHING = 'deadline_approaching',
  DEADLINE_PASSED = 'deadline_passed',
  
  // События чек-инов
  CHECK_IN_CREATED = 'check_in_created',
  CHECK_IN_UPDATED = 'check_in_updated'
}

const OKREventSchema = new Schema({
  // Связи
  okr: { type: Schema.Types.ObjectId, ref: 'OKR', required: true },
  corporateOKR: { type: Schema.Types.ObjectId, ref: 'CorporateOKR' },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },

  // Информация о событии
  type: { 
    type: String, 
    enum: Object.values(OKREventType),
    required: true 
  },
  description: { type: String, required: true },
  
  // Данные события
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },

  // Информация о пользователе
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Получатели уведомлений
  recipients: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date }
  }],

  // Метаданные
  metadata: {
    previousValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    changes: [{
      field: String,
      oldValue: Schema.Types.Mixed,
      newValue: Schema.Types.Mixed
    }]
  },

  // Временные метки
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

export const OKREvent = model('OKREvent', OKREventSchema); 