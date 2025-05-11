import { Schema, model, Types } from 'mongoose';

const OKRStatsSchema = new Schema({
  okr: { type: Types.ObjectId, ref: 'OKR', required: true, unique: true },
  team: { type: Types.ObjectId, ref: 'Team', required: true },

  // Общий прогресс
  progress: { type: Number, min: 0, max: 100 },

  // Детальная статистика по Key Results
  keyResultsStats: [{
    index: { type: Number, required: true },
    title: { type: String, required: true },
    progress: { type: Number, min: 0, max: 100 },
    actualValue: { type: Number },
    targetValue: { type: Number },
    metricType: { type: String, enum: ['number', 'percentage', 'currency', 'custom'] },
    unit: String
  }],

  // Динамика прогресса
  progressHistory: [{
    date: { type: Date, required: true },
    value: { type: Number, required: true },
    keyResultsProgress: [{
      index: { type: Number, required: true },
      value: { type: Number, required: true }
    }]
  }],

  // Активность
  totalCheckIns: { type: Number, default: 0 },
  lastCheckIn: { type: Date },
  checkInFrequency: { type: Number }, // Среднее количество дней между чек-инами

  // Вовлеченность
  uniqueContributors: [{ type: Types.ObjectId, ref: 'User' }],
  activeContributors: [{ type: Types.ObjectId, ref: 'User' }], // Пользователи, которые делали чек-ины за последние 30 дней

  // Статус и временные метки
  status: { 
    type: String, 
    enum: ['on_track', 'at_risk', 'off_track', 'completed'],
    default: 'on_track'
  },
  isFrozen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  deadline: { type: Date },

  // Связь с корпоративным OKR
  parentOKR: { type: Types.ObjectId, ref: 'CorporateOKR' },
  parentKRIndex: { type: Number }
}, { timestamps: true });

// Индексы для оптимизации запросов
OKRStatsSchema.index({ team: 1, createdAt: -1 });
OKRStatsSchema.index({ parentOKR: 1, parentKRIndex: 1 });
OKRStatsSchema.index({ status: 1 });
OKRStatsSchema.index({ isFrozen: 1 });

export const OKRStats = model('OKRStats', OKRStatsSchema);
