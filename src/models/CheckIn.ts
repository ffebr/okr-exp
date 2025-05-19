// CheckIn.ts  
import { Schema, model, Types } from 'mongoose';
import { OKRStats } from './OKRStats';

const KeyResultUpdateSchema = new Schema({
  index:             { type: Number, required: true },
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

// После чек-ина обновляем actualValue + progress в OKR и статистику
CheckInSchema.post('save', async function(doc) {
  const { OKR } = await import('./OKR');
  const okr = await OKR.findById(doc.okr);
  if (!okr) return;

  // Обновляем значения в OKR
  doc.updates.forEach(u => {
    const kr = okr.keyResults[u.index];
    kr.actualValue = u.newActualValue;
    kr.progress    = u.newProgress;
  });
  
  // Пересчитываем общий progress команды
  const total = okr.keyResults.reduce((s, k) => s + k.progress, 0);
  okr.progress = okr.keyResults.length
    ? Math.round(total / okr.keyResults.length)
    : 0;

  // Сохраняем OKR без middleware
  await okr.save({ validateBeforeSave: false });

  // Обновляем статистику
  const okrStats = await OKRStats.findOne({ okr: okr._id });
  if (okrStats) {
    // Обновляем общий прогресс
    okrStats.progress = okr.progress;

    // Обновляем статистику по каждому KR
    okrStats.keyResultsStats = okr.keyResults.map((kr, index) => ({
      index,
      title: kr.title,
      progress: kr.progress,
      actualValue: kr.actualValue,
      targetValue: kr.targetValue,
      metricType: kr.metricType,
      unit: kr.unit
    }));

    // Добавляем запись в историю прогресса
    okrStats.progressHistory.push({
      date: new Date(),
      value: okr.progress,
      keyResultsProgress: okr.keyResults.map((kr, index) => ({
        index,
        value: kr.progress
      }))
    });

    // Обновляем статус
    if (okr.progress === 100) {
      okrStats.status = 'completed';
      okrStats.completedAt = new Date();
    } else if (okr.progress >= 75) {
      okrStats.status = 'on_track';
    } else if (okr.progress < 50 && okr.deadline) {
      // Проверяем, осталось ли до дедлайна 5 дней или меньше
      const daysUntilDeadline = Math.ceil((okr.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline <= 5) {
        okrStats.status = 'at_risk';
      }
    } 

    // Увеличиваем счетчик чек-инов
    const currentCheckIns = typeof okrStats.totalCheckIns === 'number' ? okrStats.totalCheckIns : 0;
    okrStats.totalCheckIns = currentCheckIns + 1;
    
    // Обновляем дату последнего чек-ина
    okrStats.lastCheckIn = new Date();

    // Рассчитываем среднюю частоту чек-инов
    if (okrStats.progressHistory.length > 1) {
      const firstCheckIn = okrStats.progressHistory[0].date;
      const lastCheckIn = okrStats.progressHistory[okrStats.progressHistory.length - 1].date;
      const daysBetween = (lastCheckIn.getTime() - firstCheckIn.getTime()) / (1000 * 60 * 60 * 24);
      okrStats.checkInFrequency = daysBetween / (okrStats.progressHistory.length - 1);
    }

    // Добавляем пользователя в список уникальных контрибьюторов
    await OKRStats.updateOne(
      { _id: okrStats._id },
      { $addToSet: { uniqueContributors: doc.user } }
    );

    await okrStats.save();
  }
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
