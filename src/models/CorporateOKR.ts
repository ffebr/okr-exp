// CorporateOKR.ts  
import { Schema, model, Types, Document } from 'mongoose';

export interface CorporateKR {
  title:        string;
  description?: string;
  metricType:   'number'|'percentage'|'currency'|'custom';
  startValue:   number;
  targetValue:  number;
  unit?:        string;
  actualValue:  number;
  progress:     number; // 0–100
  teams?:       Types.ObjectId[];
}

export interface CorporateOKRDocument extends Document {
  company:    Types.ObjectId;
  createdBy:  Types.ObjectId;
  objective:  string;
  description?: string;
  deadline?:  Date;
  isFrozen:   boolean;
  keyResults: CorporateKR[];
  progress:   number; // 0–100
  status:     'draft'|'active'|'done';
  createdAt:  Date;
  updatedAt:  Date;
}

const CorporateKRSchema = new Schema<CorporateKR>({
  title:        { type: String, required: true },
  description:  String,
  metricType:   { type: String, enum: ['number','percentage','duration','custom'], required: true },
  startValue:   { type: Number, default: 0 },
  targetValue:  { type: Number, required: true },
  unit:         { type: String, default: '' },
  actualValue:  { type: Number, default: 0 },
  progress:     { type: Number, min: 0, max: 100, default: 0 },
  teams:        [{ type: Types.ObjectId, ref: 'Team' }]
}, { _id: false });

const CorporateOKRSchema = new Schema<CorporateOKRDocument>({
  company:     { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  objective:   { type: String, required: true },
  description: String,
  deadline: {
        type: Date,
        validate: {
          validator(this: CorporateOKRDocument, v: Date) {
            // если есть createdAt (timestamps), дедлайн должен быть позже
            return !this.createdAt || v > this.createdAt;
          },
          message: 'Deadline must be after creation date'
        }
      },
  isFrozen:    { type: Boolean, default: false },
  keyResults:  { type: [CorporateKRSchema], required: true },
  progress:    { type: Number, min: 0, max: 100, default: 0 },
  status:      { type: String, enum: ['draft','active','done'], default: 'active' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
}, { timestamps: true });

// Функция агрегации actualValue и пересчёта progress по связям команд → CorporateOKR
export async function recalculateKRProgress(krIndex: number, corporateOKRId: Types.ObjectId) {
  const { OKR } = await import('./OKR');
  const CorporateOKR = model('CorporateOKR');

  const linkedOKRs = await OKR.find({
    parentOKR: corporateOKRId,
    parentKRIndex: krIndex
  });

  if (linkedOKRs.length > 0) {
    // Normalize progress values to ensure they stay within 0-100 range and are valid numbers
    const normalizedProgresses = linkedOKRs.map(okr => {
      const progress = okr.progress || 0;
      return Math.min(Math.max(Number(progress), 0), 100);
    }).filter(progress => !isNaN(progress));

    if (normalizedProgresses.length > 0) {
      const totalProgress = normalizedProgresses.reduce((sum, progress) => sum + progress, 0);
      const averageProgress = Math.round(totalProgress / normalizedProgresses.length);

      // Обновляем прогресс конкретного KR
      await CorporateOKR.updateOne(
        { _id: corporateOKRId },
        { $set: { [`keyResults.${krIndex}.progress`]: averageProgress } }
      );

      // Получаем обновленный документ для пересчета общего прогресса
      const corporateOKR = await CorporateOKR.findById(corporateOKRId);
      if (corporateOKR && corporateOKR.keyResults.length > 0) {
        // Считаем средний прогресс по всем KR, нормализуя значения
        const totalKRProgress = corporateOKR.keyResults.reduce((sum: number, kr: { progress: number }) => {
          const progress = kr.progress || 0;
          const normalizedProgress = Math.min(Math.max(Number(progress), 0), 100);
          return sum + (isNaN(normalizedProgress) ? 0 : normalizedProgress);
        }, 0);
        const overallProgress = Math.round(totalKRProgress / corporateOKR.keyResults.length);

        // Обновляем общий прогресс OKR
        await CorporateOKR.updateOne(
          { _id: corporateOKRId },
          { $set: { progress: overallProgress } }
        );
      }
    }
  }
}

// Middleware для пересчета прогресса при сохранении
CorporateOKRSchema.pre('save', async function(this: any, next) {
  if (this.keyResults.length > 0) {
    // Пересчитываем прогресс для каждого KR
    for (let i = 0; i < this.keyResults.length; i++) {
      await recalculateKRProgress(i, this._id);
    }

    // Пересчитываем общий прогресс
    const total = (this.keyResults as Array<{ progress: number }>)
      .reduce((sum, kr) => {
        const progress = kr.progress || 0;
        const normalizedProgress = Math.min(Math.max(Number(progress), 0), 100);
        return sum + (isNaN(normalizedProgress) ? 0 : normalizedProgress);
      }, 0);
    this.progress = Math.round(total / this.keyResults.length);
  } else {
    this.progress = 0;
  }
  next();
});

// Middleware для пересчета прогресса при обновлении
CorporateOKRSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update && '$set' in update) {
    const setUpdate = update.$set as any;
    if (setUpdate && 'keyResults' in setUpdate) {
      const keyResults = setUpdate.keyResults;
      if (Array.isArray(keyResults)) {
        const total = keyResults.reduce((sum: number, kr: any) => {
          const progress = kr.progress || 0;
          const normalizedProgress = Math.min(Math.max(Number(progress), 0), 100);
          return sum + (isNaN(normalizedProgress) ? 0 : normalizedProgress);
        }, 0);
        setUpdate.progress = Math.round(total / keyResults.length);
      }
    }
  }
  next();
});

// после сохранения, если сменилось isFrozen — каскадим на все team OKR
CorporateOKRSchema.post('save', async function(this: CorporateOKRDocument) {
    if (this.isModified('isFrozen')) {
      console.log(`CorporateOKR ${this._id} isFrozen changed to: ${this.isFrozen}`);
      const { OKR } = await import('./OKR');
      const result = await OKR.updateMany(
        { parentOKR: this._id },
        { $set: { isFrozen: this.isFrozen } }
      );
      console.log(`Updated ${result.modifiedCount} team OKRs to isFrozen: ${this.isFrozen}`);
    }
});

CorporateOKRSchema.post('findOneAndUpdate', async function() {
    const doc = await this.model.findOne(this.getQuery());
    const update = this.getUpdate() as { $set?: { isFrozen?: boolean } };
    if (doc && update?.$set?.isFrozen !== undefined) {
        console.log(`CorporateOKR ${doc._id} isFrozen changed to: ${update.$set.isFrozen}`);
        const { OKR } = await import('./OKR');
        const result = await OKR.updateMany(
            { parentOKR: doc._id },
            { $set: { isFrozen: update.$set.isFrozen } }
        );
        console.log(`Updated ${result.modifiedCount} team OKRs to isFrozen: ${update.$set.isFrozen}`);
    }
});

export const CorporateOKR = model<CorporateOKRDocument>('CorporateOKR', CorporateOKRSchema);
