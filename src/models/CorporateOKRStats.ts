import { Schema, model, Types } from 'mongoose';

const CorporateOKRStatsSchema = new Schema({
  corporateOKR: { type: Types.ObjectId, ref: 'CorporateOKR', required: true, unique: true },
  company: { type: Types.ObjectId, ref: 'Company', required: true },

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
    unit: String,
    teams: [{ type: Types.ObjectId, ref: 'Team' }]
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

  // Активность команд
  totalTeamOKRs: { type: Number, default: 0 },
  activeTeamOKRs: { type: Number, default: 0 },
  frozenTeamOKRs: { type: Number, default: 0 },
  lastTeamUpdate: { type: Date },

  // Вовлеченность команд
  involvedTeams: [{ type: Types.ObjectId, ref: 'Team' }],
  activeTeams: [{ type: Types.ObjectId, ref: 'Team' }], // Команды с активными OKR за последние 30 дней

  // Статус и временные метки
  status: { 
    type: String, 
    enum: ['draft', 'active', 'done'],
    default: 'active'
  },
  isFrozen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  deadline: { type: Date }
}, { timestamps: true });

// Индексы для оптимизации запросов
CorporateOKRStatsSchema.index({ company: 1, createdAt: -1 });
CorporateOKRStatsSchema.index({ status: 1 });
CorporateOKRStatsSchema.index({ isFrozen: 1 });

// Middleware для синхронизации с CorporateOKR
CorporateOKRStatsSchema.pre('save', async function(next) {
  if (this.isModified('isFrozen')) {
    const { CorporateOKR } = await import('./CorporateOKR');
    await CorporateOKR.findByIdAndUpdate(
      this.corporateOKR,
      { $set: { isFrozen: this.isFrozen } }
    );
  }
  next();
});

export const CorporateOKRStats = model('CorporateOKRStats', CorporateOKRStatsSchema); 