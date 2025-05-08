import { Schema, model, Types, Document, Model } from 'mongoose';
import { CorporateOKR } from './CorporateOKR';
import { recalculateKRProgress } from './CorporateOKR';

const KeyResultSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

export interface IOKR extends Document {
  _id: Types.ObjectId;
  team: Types.ObjectId;
  createdBy: Types.ObjectId;
  objective: string;
  description?: string;
  parentOKR?: Types.ObjectId;
  parentKRIndex?: number;
  keyResults: Array<{
    title: string;
    description?: string;
    progress: number;
  }>;
  progress: number;
  status: 'draft' | 'active' | 'done';
}

const OKRSchema = new Schema({
  team: { type: Types.ObjectId, ref: 'Team', required: true },
  createdBy: { type: Types.ObjectId, ref: 'User', required: true },
  objective: { type: String, required: true },
  description: String,

  parentOKR:       { type: Types.ObjectId, ref: 'CorporateOKR' },
  parentKRIndex:   { type: Number },

  keyResults: {
    type: [KeyResultSchema],
  },

  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  status: {
    type: String,
    enum: ['draft', 'active', 'done'],
    default: 'active'
  }
}, { timestamps: true });

// Middleware: пересчитываем общий прогресс по keyResults
OKRSchema.pre('save', async function(this: IOKR, next) {
  try {
    if (this.keyResults.length > 0) {
      const total = this.keyResults.reduce((sum, kr) => sum + (kr.progress || 0), 0);
      this.progress = Math.round(total / this.keyResults.length);
    } else {
      this.progress = 0;
    }

    // Если OKR привязан к корпоративному KR, обновляем его прогресс
    if (this.parentOKR && this.parentKRIndex !== undefined) {
      const corporateOKR = await CorporateOKR.findById(this.parentOKR);
      if (corporateOKR && corporateOKR.keyResults[this.parentKRIndex]) {
        // Находим все OKR, привязанные к этому KR
        const linkedOKRs = await OKR.find({
          parentOKR: this.parentOKR,
          parentKRIndex: this.parentKRIndex
        });

        // Считаем средний прогресс всех привязанных OKR
        const totalProgress = linkedOKRs.reduce((sum: number, okr: IOKR) => sum + okr.progress, 0);
        const averageProgress = Math.round(totalProgress / linkedOKRs.length);

        // Обновляем прогресс корпоративного KR
        if (corporateOKR.keyResults[this.parentKRIndex]) {
          corporateOKR.keyResults[this.parentKRIndex].progress = averageProgress;
          await corporateOKR.save();
        }
      }
    }

    // Middleware для обновления прогресса корпоративного KR при изменении прогресса OKR
    if (this.isModified('progress') && this.parentOKR && this.parentKRIndex !== undefined) {
      await recalculateKRProgress(this.parentKRIndex, this.parentOKR);
    }

    next();
  } catch (error) {
    console.error('Error in OKR save middleware:', error);
    next(error as Error);
  }
});

OKRSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update && '$set' in update && (update.$set as any).progress !== undefined) {
    const okr = await this.model.findOne(this.getQuery());
    if (okr && okr.parentOKR && okr.parentKRIndex !== undefined) {
      await recalculateKRProgress(okr.parentKRIndex, okr.parentOKR);
    }
  }
  next();
});

export const OKR = model<IOKR>('OKR', OKRSchema);
