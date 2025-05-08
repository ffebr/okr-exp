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

// при сохранении пересчитываем общий прогресс
CorporateOKRSchema.pre('save', function(next) {
    if (this.keyResults.length > 0) {
      // Явно указываем тип аккумулятора и элементов
      const total = (this.keyResults as Array<{ progress?: number }>)
        .reduce<number>((sum, kr) => sum + (kr.progress ?? 0), 0);
      this.progress = Math.round(total / this.keyResults.length);
    } else {
      this.progress = 0;
    }
    next();
  });

export const CorporateOKR = model('CorporateOKR', CorporateOKRSchema);
