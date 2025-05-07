import { Schema, model, Types } from 'mongoose';

const OKRStatsSchema = new Schema({
  okr: { type: Types.ObjectId, ref: 'OKR', required: true, unique: true },

  // Общий прогресс
  progress: { type: Number, min: 0, max: 100 },

  // Динамика прогресса
  progressHistory: [{
    date: { type: Date, required: true },
    value: { type: Number, required: true }
  }],

  // Количество чек-инов
  totalCheckIns: { type: Number, default: 0 },

  // Вовлеченность
  uniqueContributors: [{ type: Types.ObjectId, ref: 'User' }],

  // Даты создания и завершения (если релевантно)
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },

  // Статус OKR на момент агрегации
  status: { type: String, enum: ['draft', 'active', 'done'], required: true }
});

export const OKRStats = model('OKRStats', OKRStatsSchema);
