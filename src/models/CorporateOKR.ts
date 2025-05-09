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
export async function recalculateKRProgress(
  krIndex: number,
  corporateOKRId: Types.ObjectId
) {
  const { OKR } = await import('./OKR');
  const CorporateOKR = model('CorporateOKR');

  // 1) получаем все OKR-команд, связанные с этим KR
  const linked = await OKR.find({
    parentOKR:      corporateOKRId,
    parentKRIndex:  krIndex
  });

  // 2) среднее actualValue команд
  const avgActual = linked.length > 0
    ? linked.reduce((s, o) => s + (o.keyResults[krIndex].actualValue || 0), 0) / linked.length
    : 0;

  // 3) достаём стар/таргет из CorporateOKR
  const corp = await CorporateOKR.findById(corporateOKRId);
  if (!corp) return;
  const kr = corp.keyResults[krIndex];
  const span = kr.targetValue - kr.startValue;
  const pct  = span === 0
    ? 100
    : Math.min(100, Math.max(0, Math.round((avgActual - kr.startValue) / span * 100)));

  // 4) обновляем actualValue и progress для этого KR
  await CorporateOKR.updateOne(
    { _id: corporateOKRId },
    {
      $set: {
        [`keyResults.${krIndex}.actualValue`]: avgActual,
        [`keyResults.${krIndex}.progress`]:    pct
      }
    }
  );

  // 5) пересчитываем общий progress всего CorporateOKR
  const updated = await CorporateOKR.findById(corporateOKRId);
  if (!updated) return;
  const total = updated.keyResults.reduce((s: number, k: CorporateKR) => s + k.progress, 0);
  const overall = Math.round(total / updated.keyResults.length);
  await CorporateOKR.updateOne(
    { _id: corporateOKRId },
    { $set: { progress: overall } }
  );
}

// При сохранении пересчитываем прогресс каждого KR из его actualValue и потом общий
CorporateOKRSchema.pre('save', function(this: CorporateOKRDocument, next) {
  this.keyResults.forEach(kr => {
    const span = kr.targetValue - kr.startValue;
    const raw  = span === 0
      ? 100
      : ((kr.actualValue - kr.startValue) / span) * 100;
    kr.progress = Math.min(100, Math.max(0, Math.round(raw)));
  });
  const total = this.keyResults.reduce((s, k) => s + k.progress, 0);
  this.progress = this.keyResults.length
    ? Math.round(total / this.keyResults.length)
    : 0;
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
