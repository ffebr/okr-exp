import { OKRStats } from '../models/OKRStats';
import { Types } from 'mongoose';

export class TeamStatsService {
  async getTeamStats(teamId: string) {
    try {
      const stats = await OKRStats.find({ team: new Types.ObjectId(teamId) })
        .populate('okr')
        .sort({ createdAt: -1 });

      if (!stats.length) {
        return {
          teamId,
          totalOKRs: 0,
          completedOKRs: 0,
          atRiskOKRs: 0,
          frozenOKRs: 0,
          stats: []
        };
      }

      // Подсчет агрегированных значений
      const completedOKRs = stats.filter(stat => stat.status === 'completed').length;
      const atRiskOKRs = stats.filter(stat => stat.status === 'at_risk').length;
      const frozenOKRs = stats.filter(stat => stat.isFrozen).length;

      return {
        teamId,
        totalOKRs: stats.length,
        completedOKRs,
        atRiskOKRs,
        frozenOKRs,
        stats: stats.map(stat => ({
          okrId: stat.okr,
          progress: stat.progress,
          status: stat.status,
          keyResultsProgress: stat.keyResultsStats,
          lastCheckIn: stat.lastCheckIn,
          totalCheckIns: stat.totalCheckIns,
          checkInFrequency: stat.checkInFrequency,
          isFrozen: stat.isFrozen,
          deadline: stat.deadline,
          progressHistory: stat.progressHistory
        }))
      };
    } catch (error: any) {
      throw new Error(`Ошибка при получении статистики команды: ${error.message}`);
    }
  }
} 