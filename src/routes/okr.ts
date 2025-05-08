import express, { Response } from 'express';
import { auth, hasTeamAccess, canManageOKR } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import OKRService from '../services/okrService';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

/**
 * @swagger
 * /api/teams/{teamId}/okrs:
 *   post:
 *     summary: Create OKR in team
 *     tags: [OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *             properties:
 *               objective:
 *                 type: string
 *               description:
 *                 type: string
 *               keyResults:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *     responses:
 *       201:
 *         description: OKR created successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       403:
 *         description: User does not have access to this team
 */
router.post('/teams/:teamId/okrs', hasTeamAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { objective, description, keyResults } = req.body;
    const userId = req.user.id;

    const okr = await OKRService.createOKR(teamId, userId, objective, description, keyResults);
    res.status(201).json({
      message: 'OKR created successfully',
      okr
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have access to this team') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Create OKR error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/okrs:
 *   get:
 *     summary: Get all OKRs in team
 *     tags: [OKRs]
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
 *         description: List of OKRs in team
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 okrs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       team:
 *                         type: string
 *                       createdBy:
 *                         type: string
 *                       objective:
 *                         type: string
 *                       description:
 *                         type: string
 *                       keyResults:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             description:
 *                               type: string
 *                             progress:
 *                               type: number
 *                       progress:
 *                         type: number
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                       updatedAt:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       403:
 *         description: User does not have access to this team
 */
router.get('/teams/:teamId/okrs', hasTeamAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const okrs = await OKRService.getTeamOKRs(teamId, userId);
    res.json({ okrs });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have access to this team') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Get team OKRs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/okrs/{okrId}/key-results:
 *   post:
 *     summary: Add key result to OKR
 *     tags: [OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: okrId
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Key result added successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: OKR not found
 *       403:
 *         description: User does not have permission to manage this OKR
 */
router.post('/okrs/:okrId/key-results', canManageOKR, async (req: AuthRequest, res: Response) => {
  try {
    const { okrId } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const okr = await OKRService.addKeyResult(okrId, title, description);
    res.status(201).json({
      message: 'Key result added successfully',
      okr
    });
  } catch (error) {
    console.error('Add key result error:', error);
    if (error instanceof Error) {
      if (error.message === 'OKR not found') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/okrs/{okrId}/status:
 *   patch:
 *     summary: Update OKR status
 *     description: Update the status of an OKR (draft, active, done)
 *     tags: [OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: okrId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the OKR to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, active, done]
 *                 description: New status for the OKR
 *     responses:
 *       200:
 *         description: OKR status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 okr:
 *                   $ref: '#/components/schemas/OKR'
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid status value. Must be one of: draft, active, done"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have permission to update this OKR
 *       404:
 *         description: OKR not found
 */
router.patch('/okrs/:okrId/status', canManageOKR, async (req: AuthRequest, res: Response) => {
  console.log('PATCH /okrs/:okrId/status called with:', req.params, req.body);
  try {
    const { okrId } = req.params;
    const { status } = req.body;

    // Validate status value
    if (!['draft', 'active', 'done'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status value. Must be one of: draft, active, done'
      });
    }

    const okr = await OKRService.updateOKRStatus(okrId, status);
    res.json({
      message: 'OKR status updated successfully',
      okr
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'OKR not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have permission to update this OKR') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Update OKR status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/okrs/{okrId}:
 *   get:
 *     summary: Get OKR by ID
 *     tags: [OKRs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: okrId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the OKR to retrieve
 *     responses:
 *       200:
 *         description: OKR details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OKR'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have permission to view this OKR
 *       404:
 *         description: OKR not found
 */
router.get('/okrs/:okrId', canManageOKR, async (req: AuthRequest, res: Response) => {
  try {
    const { okrId } = req.params;
    const okr = await OKRService.getOKRById(okrId);
    res.json(okr);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'OKR not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have permission to view this OKR') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Get OKR error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 