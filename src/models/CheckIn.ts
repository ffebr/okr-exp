// CheckIn.ts  
import { Schema, model, Types } from 'mongoose';

const KeyResultUpdateSchema = new Schema({
  index:             { type: Number, required: true }, // номер KR в OKR.keyResults
  previousActualValue:{ type: Number, required: true },
  newActualValue:    { type: Number, required: true },
  previousProgress:  { type: Number, required: true },
  newProgress:       { type: Number, required: true }
}, { _id: false });

const CheckInSchema = new Schema({
  okr:     { type: Types.ObjectId, ref: 'OKR', required: true },
  user:    { type: Types.ObjectId, ref: 'User', required: true },
  comment: String,
  date:    { type: Date, default: Date.now },
  updates: { type: [KeyResultUpdateSchema], required: true }
}, { timestamps: true });

// После чек-ина обновляем actualValue + progress в OKR, а дальше корпоративный KR через OKR.pre('save')
CheckInSchema.post('save', async function(doc) {
  const { OKR } = await import('./OKR');
  const okr = await OKR.findById(doc.okr);
  if (!okr) return;

  doc.updates.forEach(u => {
    const kr = okr.keyResults[u.index];
    kr.actualValue = u.newActualValue;
    kr.progress    = u.newProgress;
  });
  // пересчитываем общий progress команды
  const total = okr.keyResults.reduce((s, k) => s + k.progress, 0);
  okr.progress = okr.keyResults.length
    ? Math.round(total / okr.keyResults.length)
    : 0;

  await okr.save();
});

// Блокируем чек-ин, если OKR (team или corporate через каскад) заморожена
CheckInSchema.pre('save', async function(next) {
  const { OKR } = await import('./OKR');
  const okr = await OKR.findById(this.okr);
  if (okr?.isFrozen) {
    return next(new Error('Cannot create check-in: OKR is frozen.'));
  }

  // Проверяем, не пытаемся ли мы уменьшить прогресс с 100%
  for (const update of this.updates) {
    const kr = okr?.keyResults[update.index];
    if (kr?.progress === 100 && update.newProgress < 100) {
      return next(new Error('Cannot decrease progress of a completed key result.'));
    }
  }

  // Проверяем, не пытаемся ли мы создать чек-ин для уже завершенного OKR
  // (кроме случая, когда чек-ин завершает OKR)
  const willCompleteOKR = this.updates.every(update => {
    const kr = okr?.keyResults[update.index];
    return kr && update.newProgress === 100;
  });

  if (okr?.progress === 100 && !willCompleteOKR) {
    return next(new Error('Cannot create check-in: OKR progress is already 100%.'));
  }
  next();
});

export const CheckIn = model('CheckIn', CheckInSchema);
