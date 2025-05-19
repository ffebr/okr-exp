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
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
}, { timestamps: true });

// Функция агрегации actualValue и пересчёта progress по связям команд → CorporateOKR
export async function recalculateKRProgress(krIndex: number, corporateOKRId: Types.ObjectId) {
  const { OKR } = await import('./OKR');
  const { CorporateOKRStats } = await import('./CorporateOKRStats');
  const CorporateOKR = model('CorporateOKR');

  const linkedOKRs = await OKR.find({
    parentOKR: corporateOKRId,
    parentKRIndex: krIndex
  });

  if (linkedOKRs.length > 0) {
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

        // Обновляем статистику
        const stats = await CorporateOKRStats.findOne({ corporateOKR: corporateOKRId });
        if (stats) {
          stats.progress = overallProgress;
          stats.isFrozen = corporateOKR.isFrozen;
          stats.keyResultsStats = corporateOKR.keyResults.map((kr: CorporateKR, index: number) => ({
            index,
            title: kr.title,
            progress: kr.progress,
            actualValue: kr.actualValue,
            targetValue: kr.targetValue,
            metricType: kr.metricType,
            unit: kr.unit,
            teams: kr.teams || []
          }));

          // Добавляем запись в историю прогресса
          stats.progressHistory.push({
            date: new Date(),
            value: overallProgress,
            keyResultsProgress: corporateOKR.keyResults.map((kr: CorporateKR, index: number) => ({
              index,
              value: kr.progress
            }))
          });

          // Обновляем статус
          if (overallProgress === 100) {
            stats.status = 'completed';
            stats.completedAt = new Date();
          } else if (overallProgress >= 75) {
            stats.status = 'on_track';
          } else if (overallProgress < 50 && corporateOKR.deadline instanceof Date) {
            const daysUntilDeadline = Math.ceil((corporateOKR.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilDeadline <= 5) {
              stats.status = 'at_risk';
            } else {
              stats.status = 'on_track';
            }
          } else {
            stats.status = 'on_track';
          }

          await stats.save();
        }
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

// Middleware для синхронизации статуса заморозки
CorporateOKRSchema.pre('save', async function(this: CorporateOKRDocument, next) {
  if (this.isModified('isFrozen')) {
    const { CorporateOKRStats } = await import('./CorporateOKRStats');
    const { OKR } = await import('./OKR');
    
    // Обновляем статистику
    const stats = await CorporateOKRStats.findOne({ corporateOKR: this._id });
    if (stats) {
      stats.isFrozen = this.isFrozen;
      await stats.save();
    }

    // Обновляем все связанные командные OKR
    await OKR.updateMany(
      { parentOKR: this._id },
      { $set: { isFrozen: this.isFrozen } }
    );
  }
  next();
});

// Middleware для синхронизации при обновлении через findOneAndUpdate
CorporateOKRSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate() as { $set?: { isFrozen?: boolean } };
  if (update?.$set?.isFrozen !== undefined) {
    const { CorporateOKRStats } = await import('./CorporateOKRStats');
    const { OKR } = await import('./OKR');
    
    const doc = await this.model.findOne(this.getQuery());
    if (!doc) return next();

    // Обновляем статистику
    const stats = await CorporateOKRStats.findOne({ corporateOKR: doc._id });
    if (stats) {
      stats.isFrozen = update.$set.isFrozen;
      await stats.save();
    }

    // Обновляем все связанные командные OKR
    await OKR.updateMany(
      { parentOKR: doc._id },
      { $set: { isFrozen: update.$set.isFrozen } }
    );
  }
  next();
});

// после сохранения, если сменилось isFrozen — каскадим на все team OKR
CorporateOKRSchema.post('save', async function(this: CorporateOKRDocument) {
    try {
      const { CorporateOKRStats } = await import('./CorporateOKRStats');
      const { OKR } = await import('./OKR');
      const { OKRStats } = await import('./OKRStats');
      
      // Получаем все связанные командные OKR
      const teamOKRs = await OKR.find({ parentOKR: this._id });
      
      // Ищем существующую статистику
      let stats = await CorporateOKRStats.findOne({ corporateOKR: this._id });
      
      if (!stats) {
        // Создаем новую статистику при первом сохранении
        stats = new CorporateOKRStats({
          corporateOKR: this._id,
          company: this.company,
          progress: this.progress,
          keyResultsStats: this.keyResults.map((kr, index) => ({
            index,
            title: kr.title,
            progress: kr.progress,
            actualValue: kr.actualValue,
            targetValue: kr.targetValue,
            metricType: kr.metricType,
            unit: kr.unit,
            teams: kr.teams || []
          })),
          isFrozen: this.isFrozen,
          deadline: this.deadline,
          totalTeamOKRs: teamOKRs.length,
          activeTeamOKRs: teamOKRs.filter(okr => !okr.isFrozen).length,
          frozenTeamOKRs: teamOKRs.filter(okr => okr.isFrozen).length,
          involvedTeams: this.keyResults.flatMap(kr => kr.teams || [])
        });
      } else {
        // Обновляем существующую статистику
        if (this.isModified('progress') || this.isModified('keyResults')) {
          stats.progress = this.progress;
          stats.keyResultsStats = this.keyResults.map((kr, index) => ({
            index,
            title: kr.title,
            progress: kr.progress,
            actualValue: kr.actualValue,
            targetValue: kr.targetValue,
            metricType: kr.metricType,
            unit: kr.unit,
            teams: kr.teams || []
          }));

          // Добавляем запись в историю прогресса
          stats.progressHistory.push({
            date: new Date(),
            value: this.progress,
            keyResultsProgress: this.keyResults.map((kr, index) => ({
              index,
              value: kr.progress
            }))
          });
        }

        if (this.isModified('isFrozen')) {
          stats.isFrozen = this.isFrozen;
          // Обновляем все связанные OKR
          const result = await OKR.updateMany(
            { parentOKR: this._id },
            { $set: { isFrozen: this.isFrozen } }
          );

          // Обновляем статистику для всех затронутых OKR
          const affectedOKRs = await OKR.find({ parentOKR: this._id });
          for (const okr of affectedOKRs) {
            const okrStats = await OKRStats.findOne({ okr: okr._id });
            if (okrStats) {
              okrStats.isFrozen = this.isFrozen;
              await okrStats.save();
            }
          }
        }

        stats.deadline = this.deadline;
        stats.totalTeamOKRs = teamOKRs.length;
        stats.activeTeamOKRs = teamOKRs.filter(okr => !okr.isFrozen).length;
        stats.frozenTeamOKRs = teamOKRs.filter(okr => okr.isFrozen).length;
        const teams = this.keyResults.flatMap(kr => kr.teams || []);
        await CorporateOKRStats.updateOne(
          { _id: stats._id },
          { $set: { involvedTeams: teams } }
        );
      }

      await stats.save();
    } catch (error) {
      console.error('Error updating CorporateOKRStats:', error);
      throw error;
    }
});

CorporateOKRSchema.post('findOneAndUpdate', async function() {
    try {
        const doc = await this.model.findOne(this.getQuery());
        if (!doc) return;

        const update = this.getUpdate() as { $set?: { isFrozen?: boolean } };
        if (update?.$set?.isFrozen !== undefined) {
            const { OKR } = await import('./OKR');
            const { OKRStats } = await import('./OKRStats');
            
            // Обновляем все связанные OKR
            const result = await OKR.updateMany(
                { parentOKR: doc._id },
                { $set: { isFrozen: update.$set.isFrozen } }
            );

            // Обновляем статистику для всех затронутых OKR
            const affectedOKRs = await OKR.find({ parentOKR: doc._id });
            for (const okr of affectedOKRs) {
                const okrStats = await OKRStats.findOne({ okr: okr._id });
                if (okrStats) {
                    okrStats.isFrozen = update.$set.isFrozen;
                    await okrStats.save();
                }
            }

            console.log(`Updated ${result.modifiedCount} team OKRs and their stats to isFrozen: ${update.$set.isFrozen}`);
        }
    } catch (error) {
        console.error('Error in findOneAndUpdate middleware:', error);
        throw error;
    }
});

export const CorporateOKR = model<CorporateOKRDocument>('CorporateOKR', CorporateOKRSchema);
