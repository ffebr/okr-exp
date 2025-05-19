import { Schema, model, Types } from 'mongoose';

const OKRStatsSchema = new Schema({
  okr: { type: Types.ObjectId, ref: 'OKR', required: true, unique: true },
  team: { type: Types.ObjectId, ref: 'Team', required: true },
  progress: { type: Number, min: 0, max: 100 },
  keyResultsStats: [{
    index: { type: Number, required: true },
    title: { type: String, required: true },
    progress: { type: Number, min: 0, max: 100 },
    actualValue: { type: Number },
    targetValue: { type: Number },
    metricType: { type: String, enum: ['number', 'percentage', 'currency', 'custom'] },
    unit: String
  }],
  progressHistory: [{
    date: { type: Date, required: true },
    value: { type: Number, required: true },
    keyResultsProgress: [{
      index: { type: Number, required: true },
      value: { type: Number, required: true }
    }]
  }],
  totalCheckIns: { type: Number, default: 0 },
  lastCheckIn: { type: Date },
  checkInFrequency: { type: Number },
  uniqueContributors: [{ type: Types.ObjectId, ref: 'User' }],
  activeContributors: [{ type: Types.ObjectId, ref: 'User' }],
  status: { 
    type: String, 
    enum: ['on_track', 'at_risk', 'completed'],
    default: 'on_track'
  },
  isFrozen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  deadline: { type: Date },
  parentOKR: { type: Types.ObjectId, ref: 'CorporateOKR' },
  parentKRIndex: { type: Number }
}, { timestamps: true });

// Индексы для оптимизации запросов
OKRStatsSchema.index({ team: 1, createdAt: -1 });
OKRStatsSchema.index({ parentOKR: 1, parentKRIndex: 1 });
OKRStatsSchema.index({ status: 1 });
OKRStatsSchema.index({ isFrozen: 1 });

export const OKRStats = model('OKRStats', OKRStatsSchema);
