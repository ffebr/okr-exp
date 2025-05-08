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

    // Обновляем прогресс корпоративного KR если:
    // 1. OKR привязан к KR (parentOKR и parentKRIndex установлены)
    // 2. Изменился прогресс OKR
    // 3. Изменилась привязка к KR (добавили или изменили parentOKR/parentKRIndex)
    if (this.parentOKR && this.parentKRIndex !== undefined && 
        (this.isModified('progress') || this.isModified('parentOKR') || this.isModified('parentKRIndex'))) {
      await recalculateKRProgress(this.parentKRIndex, this.parentOKR);
    }

    next();
  } catch (error) {
    console.error('Error in OKR save middleware:', error);
    next(error as Error);
  }
});

OKRSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate();
    if (update && '$set' in update) {
      const setUpdate = update.$set as any;
      const okr = await this.model.findOne(this.getQuery());
      
      // Проверяем, изменился ли прогресс или привязка к KR
      if (okr && 
          ((setUpdate.progress !== undefined) || 
           (setUpdate.parentOKR !== undefined) || 
           (setUpdate.parentKRIndex !== undefined))) {
        
        // Используем новые значения из update или существующие из okr
        const parentOKR = setUpdate.parentOKR || okr.parentOKR;
        const parentKRIndex = setUpdate.parentKRIndex !== undefined ? setUpdate.parentKRIndex : okr.parentKRIndex;
        
        if (parentOKR && parentKRIndex !== undefined) {
          await recalculateKRProgress(parentKRIndex, parentOKR);
        }
      }
    }
    next();
  } catch (error) {
    console.error('Error in OKR findOneAndUpdate middleware:', error);
    next(error as Error);
  }
});

export const OKR = model<IOKR>('OKR', OKRSchema);
