import { Schema, model, Types } from 'mongoose';

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

const OKRSchema = new Schema({
  team: { type: Types.ObjectId, ref: 'Team', required: true },
  createdBy: { type: Types.ObjectId, ref: 'User', required: true },
  objective: { type: String, required: true },
  description: String,

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
OKRSchema.pre('save', function (next) {
  try {
    console.log('Saving OKR with keyResults:', this.keyResults);
    if (this.keyResults.length > 0) {
      const total = this.keyResults.reduce((sum, kr) => sum + (kr.progress || 0), 0);
      this.progress = Math.round(total / this.keyResults.length);
      console.log('Calculated progress:', this.progress);
    } else {
      this.progress = 0;
      console.log('No key results, setting progress to 0');
    }
    next();
  } catch (error) {
    console.error('Error in OKR save middleware:', error);
    next(error as Error);
  }
});

export const OKR = model('OKR', OKRSchema);
