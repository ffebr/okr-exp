// OKR.ts  
import { Schema, model, Types, Document } from 'mongoose';
import { CorporateOKR, recalculateKRProgress } from './CorporateOKR';
import { OKRStats } from './OKRStats';

export interface KeyResult {
  title:        string;
  description?: string;
  metricType:   'number'|'percentage'|'currency'|'custom';
  startValue:   number;
  targetValue:  number;
  unit?:        string;
  actualValue:  number;
  progress:     number; // 0–100
}

export interface IOKR extends Document {
  team:         Types.ObjectId;
  createdBy:    Types.ObjectId;
  objective:    string;
  description?: string;
  parentOKR?:   Types.ObjectId;
  parentKRIndex?: number;
  deadline?:    Date;
  isFrozen:     boolean;
  keyResults:   KeyResult[];
  progress:     number;
  createdAt:    Date;
  updatedAt:    Date;
}

const KeyResultSchema = new Schema<KeyResult>({
  title:        { type: String, required: true },
  description:  String,
  metricType:   { type: String, enum: ['number','percentage','currency','custom'], required: true },
  startValue:   { type: Number, default: 0 },
  targetValue:  { type: Number, required: true },
  unit:         { type: String, default: '' },
  actualValue:  { type: Number, default: 0 },
  progress:     { type: Number, min: 0, max: 100, default: 0 }
}, { _id: false });

const OKRSchema = new Schema<IOKR>({
  team:         { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  objective:    { type: String, required: true },
  description:  { type: String },
  parentOKR:    { type: Types.ObjectId, ref: 'CorporateOKR' },
  parentKRIndex:{ type: Number },
  deadline: {
      type: Date,
      validate: {
        validator(this: IOKR, v: Date) {
          return !this.createdAt || v > this.createdAt;
        },
        message: 'Deadline must be after creation date'
      }
    },
  isFrozen:     { type: Boolean, default: false },
  keyResults:   { type: [KeyResultSchema], required: true },
  progress:     { type: Number, min: 0, max: 100, default: 0 },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
}, { timestamps: true });

// Пересчёт прогресса командного OKR и проброс в корпоративный KR
OKRSchema.pre('save', async function(this: IOKR, next) {
  // 1) пересчитываем каждый KR по actualValue
  this.keyResults.forEach(kr => {
    let raw;
    if (kr.metricType === 'percentage') {
      // Для процентных метрик считаем прогресс как разницу между текущим и начальным значением
      // относительно разницы между целевым и начальным значением
      const span = kr.targetValue - kr.startValue;
      const currentProgress = kr.actualValue - kr.startValue;
      raw = span === 0 ? 100 : (currentProgress / span) * 100;
    } else {
      // Для остальных метрик считаем как раньше
      const span = kr.targetValue - kr.startValue;
      raw = span === 0 ? 100 : ((kr.actualValue - kr.startValue) / span) * 100;
    }
    kr.progress = Math.min(100, Math.max(0, Math.round(raw)));
  });
  // 2) общий прогресс команды
  const total = this.keyResults.reduce((s, k) => s + k.progress, 0);
  this.progress = this.keyResults.length
    ? Math.round(total / this.keyResults.length)
    : 0;

  // 3) если привязано к CorporateOKR → пересчитываем его KR
  if (this.parentOKR != null && this.parentKRIndex != null) {
    await recalculateKRProgress(this.parentKRIndex, this.parentOKR);
  }

  // 4) Синхронизируем статус заморозки и информацию о родительском OKR с OKRStats
  if (this.isModified('isFrozen') || this.isModified('parentOKR') || this.isModified('parentKRIndex')) {
    const okrStats = await OKRStats.findOne({ okr: this._id });
    if (okrStats) {
      okrStats.isFrozen = this.isFrozen;
      okrStats.parentOKR = this.parentOKR;
      okrStats.parentKRIndex = this.parentKRIndex;
      await okrStats.save();
    }
  }

  next();
});

OKRSchema.pre('findOneAndUpdate', async function(next) {
  const upd = this.getUpdate() as any;
  const okr = await this.model.findOne(this.getQuery());
  
  if (!okr) {
    return next();
  }

  if (upd?.$set?.keyResults || upd?.$set?.progress) {
    if (okr.parentOKR != null && okr.parentKRIndex != null) {
      await recalculateKRProgress(okr.parentKRIndex, okr.parentOKR);
    }
  }

  // Синхронизируем статус заморозки и информацию о родительском OKR при обновлении через findOneAndUpdate
  if (upd?.$set?.isFrozen !== undefined || upd?.$set?.parentOKR !== undefined || upd?.$set?.parentKRIndex !== undefined) {
    const okrStats = await OKRStats.findOne({ okr: okr._id });
    if (okrStats) {
      if (upd.$set.isFrozen !== undefined) {
        okrStats.isFrozen = upd.$set.isFrozen;
      }
      if (upd.$set.parentOKR !== undefined) {
        okrStats.parentOKR = upd.$set.parentOKR;
      }
      if (upd.$set.parentKRIndex !== undefined) {
        okrStats.parentKRIndex = upd.$set.parentKRIndex;
      }
      await okrStats.save();
    }
  }

  next();
});

export const OKR = model<IOKR>('OKR', OKRSchema);
