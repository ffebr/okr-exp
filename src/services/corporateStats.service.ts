import { CorporateOKRStats } from '../models/CorporateOKRStats';
import { Types, Document } from 'mongoose';

interface CorporateOKRStatsDocument extends Document {
  corporateOKR: Types.ObjectId;
  progress: number;
  status: 'on_track' | 'at_risk' | 'completed';
  isFrozen: boolean;
  totalTeamOKRs: number;
  activeTeamOKRs: number;
  frozenTeamOKRs: number;
  keyResultsStats: Array<{
    index: number;
    title: string;
    progress: number;
    actualValue: number;
    targetValue: number;
    metricType: string;
    unit?: string;
    teams: Types.ObjectId[];
  }>;
  progressHistory: Array<{
    date: Date;
    value: number;
    keyResultsProgress: Array<{
      index: number;
      value: number;
    }>;
  }>;
  deadline?: Date;
  involvedTeams: Types.ObjectId[];
}

export class CorporateStatsService {
  async getCorporateStats(companyId: string) {
    try {
      const stats = await CorporateOKRStats.find({ company: new Types.ObjectId(companyId) })
        .populate('corporateOKR')
        .sort({ createdAt: -1 })
        .lean() as unknown as CorporateOKRStatsDocument[];

      if (!stats.length) {
        return {
          companyId,
          totalOKRs: 0,
          completedOKRs: 0,
          atRiskOKRs: 0,
          frozenOKRs: 0,
          totalTeamOKRs: 0,
          activeTeamOKRs: 0,
          frozenTeamOKRs: 0,
          stats: []
        };
      }

      // Подсчет агрегированных значений
      const completedOKRs = stats.filter(stat => stat.status === 'completed').length;
      const atRiskOKRs = stats.filter(stat => stat.status === 'at_risk').length;
      const frozenOKRs = stats.filter(stat => stat.isFrozen).length;
      const totalTeamOKRs = stats.reduce((sum, stat) => sum + stat.totalTeamOKRs, 0);
      const activeTeamOKRs = stats.reduce((sum, stat) => sum + stat.activeTeamOKRs, 0);
      const frozenTeamOKRs = stats.reduce((sum, stat) => sum + stat.frozenTeamOKRs, 0);

      return {
        companyId,
        totalOKRs: stats.length,
        completedOKRs,
        atRiskOKRs,
        frozenOKRs,
        totalTeamOKRs,
        activeTeamOKRs,
        frozenTeamOKRs,
        stats: stats.map(stat => ({
          okrId: stat.corporateOKR,
          progress: stat.progress,
          status: stat.status,
          keyResultsProgress: stat.keyResultsStats,
          isFrozen: stat.isFrozen,
          deadline: stat.deadline,
          progressHistory: stat.progressHistory,
          totalTeamOKRs: stat.totalTeamOKRs,
          activeTeamOKRs: stat.activeTeamOKRs,
          frozenTeamOKRs: stat.frozenTeamOKRs,
          involvedTeams: stat.involvedTeams
        }))
      };
    } catch (error: any) {
      throw new Error(`Ошибка при получении статистики компании: ${error.message}`);
    }
  }
} 