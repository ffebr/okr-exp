import { Router } from 'express';
import { TeamStatsService } from '../services/teamStats.service';
import { hasTeamAccess } from '../middleware/auth';

const router = Router();
const teamStatsService = new TeamStatsService();

/**
 * @swagger
 * /api/teams/{teamId}/stats:
 *   get:
 *     summary: Получить статистику OKR команды
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID команды
 *     responses:
 *       200:
 *         description: Статистика OKR команды успешно получена
 *       403:
 *         description: Нет доступа к команде
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/:teamId/stats', hasTeamAccess, async (req, res) => {
  try {
    const { teamId } = req.params;
    const stats = await teamStatsService.getTeamStats(teamId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Ошибка при получении статистики команды',
      message: error.message 
    });
  }
});

export default router; 