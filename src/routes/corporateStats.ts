import { Router } from 'express';
import { CorporateStatsService } from '../services/corporateStats.service';
import { hasCompanyAccess } from '../middleware/auth';

const router = Router();
const corporateStatsService = new CorporateStatsService();

/**
 * @swagger
 * /api/companies/{companyId}/stats:
 *   get:
 *     summary: Получить статистику OKR компании
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID компании
 *     responses:
 *       200:
 *         description: Статистика OKR компании успешно получена
 *       403:
 *         description: Нет доступа к компании
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/:companyId/stats', hasCompanyAccess, async (req, res) => {
  try {
    const { companyId } = req.params;
    const stats = await corporateStatsService.getCorporateStats(companyId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Ошибка при получении статистики компании',
      message: error.message 
    });
  }
});

export default router; 