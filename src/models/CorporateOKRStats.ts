import { Schema, model, Types } from 'mongoose';

const CorporateOKRStatsSchema = new Schema({
  corporateOKR: { type: Types.ObjectId, ref: 'CorporateOKR', required: true, unique: true },
  company: { type: Types.ObjectId, ref: 'Company', required: true },
  progress: { type: Number, min: 0, max: 100 },
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
  progressHistory: [{
    date: { type: Date, required: true },
    value: { type: Number, required: true },
    keyResultsProgress: [{
      index: { type: Number, required: true },
      value: { type: Number, required: true }
    }]
  }],
  totalTeamOKRs: { type: Number, default: 0 },
  activeTeamOKRs: { type: Number, default: 0 },
  frozenTeamOKRs: { type: Number, default: 0 },
  lastTeamUpdate: { type: Date },
  involvedTeams: [{ type: Types.ObjectId, ref: 'Team' }],
  status: { 
    type: String, 
    enum: ['on_track', 'at_risk', 'completed'],
    default: 'on_track'
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

// Middleware для обновления статистики при изменении прогресса
CorporateOKRStatsSchema.pre('save', async function(next) {
  if (this.isModified('progress') && typeof this.progress === 'number') {
    // Обновляем статус на основе прогресса
    if (this.progress === 100) {
      this.status = 'completed';
      this.completedAt = new Date();
    } else if (this.progress >= 75) {
      this.status = 'on_track';
    } else if (this.progress < 50 && this.deadline instanceof Date) {
      // Проверяем, осталось ли до дедлайна 5 дней или меньше
      const daysUntilDeadline = Math.ceil((this.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline <= 5) {
        this.status = 'at_risk';
      } else {
        this.status = 'on_track';
      }
    } else {
      this.status = 'on_track';
    }

    // Добавляем запись в историю прогресса
    this.progressHistory.push({
      date: new Date(),
      value: this.progress,
      keyResultsProgress: this.keyResultsStats.map(kr => ({
        index: kr.index,
        value: kr.progress
      }))
    });
  }
  next();
});

export const CorporateOKRStats = model('CorporateOKRStats', CorporateOKRStatsSchema); 