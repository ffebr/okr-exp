import { Schema, model, Types } from 'mongoose';

const CorporateKRSchema = new Schema({
  title:       { type: String, required: true },
  description: String,
  // текущий прогресс всех команд, приводимый к 0–100
  progress:    { type: Number, min: 0, max: 100, default: 0 },
  // какие команды участвуют в выполнении этого KR (для удобства, можно не обязательно)
  teams:       [{ type: Types.ObjectId, ref: 'Team' }]
}, { _id: false });

const CorporateOKRSchema = new Schema({
  company:    { type: Types.ObjectId, ref: 'Company', required: true },
  createdBy:  { type: Types.ObjectId, ref: 'User', required: true },

  objective:  { type: String, required: true },
  description:String,

  // ключевые результаты на уровне компании
  keyResults: { type: [CorporateKRSchema], required: true },

  // суммарный прогресс (среднее по keyResults)
  progress:   { type: Number, min: 0, max: 100, default: 0 },

  status:     {
    type: String,
    enum: ['draft','active','done'],
    default: 'active'
  }

}, { timestamps: true });

// Функция для пересчета прогресса KR на основе связанных OKR
export async function recalculateKRProgress(krIndex: number, corporateOKRId: Types.ObjectId) {
  const { OKR } = await import('./OKR');
  const CorporateOKR = model('CorporateOKR');

  const linkedOKRs = await OKR.find({
    parentOKR: corporateOKRId,
    parentKRIndex: krIndex
  });

  if (linkedOKRs.length > 0) {
    const totalProgress = linkedOKRs.reduce((sum, okr) => sum + okr.progress, 0);
    const averageProgress = Math.round(totalProgress / linkedOKRs.length);

    // Обновляем прогресс KR
    await CorporateOKR.updateOne(
      { _id: corporateOKRId },
      { $set: { [`keyResults.${krIndex}.progress`]: averageProgress } }
    );

    // Получаем обновленный документ для пересчета общего прогресса
    const corporateOKR = await CorporateOKR.findById(corporateOKRId);
    if (corporateOKR) {
      // Пересчитываем общий прогресс
      const totalKRProgress = corporateOKR.keyResults.reduce((sum: number, kr: { progress: number }) => sum + kr.progress, 0);
      const overallProgress = Math.round(totalKRProgress / corporateOKR.keyResults.length);

      // Обновляем общий прогресс
      await CorporateOKR.updateOne(
        { _id: corporateOKRId },
        { $set: { progress: overallProgress } }
      );
    }
  }
}

// Middleware для пересчета прогресса при сохранении
CorporateOKRSchema.pre('save', async function(next) {
  if (this.keyResults.length > 0) {
    // Пересчитываем прогресс для каждого KR
    for (let i = 0; i < this.keyResults.length; i++) {
      await recalculateKRProgress(i, this._id);
    }

    // Пересчитываем общий прогресс
    const total = (this.keyResults as Array<{ progress: number }>)
      .reduce((sum, kr) => sum + kr.progress, 0);
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
        const total = keyResults.reduce((sum: number, kr: any) => sum + (kr.progress || 0), 0);
        setUpdate.progress = Math.round(total / keyResults.length);
      }
    }
  }
  next();
});

export const CorporateOKR = model('CorporateOKR', CorporateOKRSchema);
