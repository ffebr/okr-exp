import express, { Response } from 'express';
import { auth, isCompanyCreator, hasTeamAccess } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import CorporateOKRService from '../services/corporateOKRService';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

/**
 * @swagger
 * /api/companies/{companyId}/corporate-okrs:
 *   post:
 *     summary: Create corporate OKR
 *     tags: [Corporate OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - objective
 *               - keyResults
 *             properties:
 *               objective:
 *                 type: string
 *               description:
 *                 type: string
 *               keyResults:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     teams:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       201:
 *         description: Corporate OKR created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only company creator can create corporate OKRs
 *       404:
 *         description: Company not found
 */
router.post('/companies/:companyId/corporate-okrs', isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const { objective, description, keyResults } = req.body;
    const userId = req.user.id;

    const corporateOKR = await CorporateOKRService.createCorporateOKR(
      companyId,
      userId,
      objective,
      description,
      keyResults
    );

    res.status(201).json({
      message: 'Corporate OKR created successfully',
      corporateOKR
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Only company creator can create corporate OKRs') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Create corporate OKR error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/corporate-okrs/{corporateOKRId}/key-results/{krIndex}/teams:
 *   post:
 *     summary: Assign teams to corporate OKR key result
 *     tags: [Corporate OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: corporateOKRId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: krIndex
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamIds
 *             properties:
 *               teamIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Teams assigned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only company creator can assign teams
 *       404:
 *         description: Corporate OKR or teams not found
 */
router.post('/corporate-okrs/:corporateOKRId/key-results/:krIndex/teams', isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { corporateOKRId, krIndex } = req.params;
    const { teamIds } = req.body;
    const userId = req.user.id;

    const corporateOKR = await CorporateOKRService.assignTeamsToKR(
      corporateOKRId,
      parseInt(krIndex),
      teamIds,
      userId
    );

    res.json({
      message: 'Teams assigned successfully',
      corporateOKR
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Only company creator')) {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Assign teams error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/corporate-okrs:
 *   get:
 *     summary: Get all corporate OKRs for a company
 *     tags: [Corporate OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of corporate OKRs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have access to this company
 *       404:
 *         description: Company not found
 */
router.get('/companies/:companyId/corporate-okrs', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const userId = req.user.id;

    const corporateOKRs = await CorporateOKRService.getCorporateOKRs(companyId, userId);
    res.json({ corporateOKRs });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have access to this company') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Get corporate OKRs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/corporate-okrs/{corporateOKRId}/key-results/{krIndex}/team-okrs:
 *   get:
 *     summary: Get all team OKRs linked to a corporate OKR key result
 *     tags: [Corporate OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: corporateOKRId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: krIndex
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of team OKRs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have access to this company
 *       404:
 *         description: Corporate OKR not found
 */
router.get('/corporate-okrs/:corporateOKRId/key-results/:krIndex/team-okrs', async (req: AuthRequest, res: Response) => {
  try {
    const { corporateOKRId, krIndex } = req.params;
    const userId = req.user.id;

    const teamOKRs = await CorporateOKRService.getTeamOKRsForCorporateKR(
      corporateOKRId,
      parseInt(krIndex),
      userId
    );
    res.json({ teamOKRs });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have access to this company') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Get team OKRs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/assigned-key-results:
 *   get:
 *     summary: Get all key results assigned to a team
 *     tags: [Corporate OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned key results
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have access to this team
 *       404:
 *         description: Team not found
 */
router.get('/teams/:teamId/assigned-key-results', hasTeamAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const assignedKeyResults = await CorporateOKRService.getKeyResultsAssignedToTeam(teamId, userId);

    res.json({ assignedKeyResults });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get assigned key results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/corporate-okrs/{okrId}/key-results/{krIndex}:
 *   get:
 *     summary: Get details of a specific key result in a corporate OKR
 *     tags: [Corporate OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: okrId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: krIndex
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Key result details with linked team OKRs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have access to this company
 *       404:
 *         description: Corporate OKR or key result not found
 */
router.get('/corporate-okrs/:okrId/key-results/:krIndex', async (req: AuthRequest, res: Response) => {
  try {
    const { okrId, krIndex } = req.params;
    const userId = req.user.id;

    const krDetails = await CorporateOKRService.getCorporateKRDetails(
      okrId,
      parseInt(krIndex),
      userId
    );

    res.json(krDetails);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have access to this company') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Get corporate KR details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 