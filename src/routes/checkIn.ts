import express, { Response } from 'express';
import { auth, hasOKRAccess } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import CheckInService from '../services/checkInService';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

/**
 * @swagger
 * /api/check-ins:
 *   post:
 *     summary: Create a new check-in for an OKR
 *     tags: [Check-ins]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - okrId
 *               - updates
 *             properties:
 *               okrId:
 *                 type: string
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - index
 *                     - newProgress
 *                   properties:
 *                     index:
 *                       type: number
 *                       description: Index of the key result to update
 *                     newProgress:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: New progress value (0-100)
 *               comment:
 *                 type: string
 *                 description: Optional comment about the check-in
 *     responses:
 *       201:
 *         description: Check-in created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 okr:
 *                   type: string
 *                 user:
 *                   type: string
 *                 comment:
 *                   type: string
 *                 updates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:
 *                         type: number
 *                       previousProgress:
 *                         type: number
 *                       newProgress:
 *                         type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid key result index or progress value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have access to this OKR
 *       404:
 *         description: OKR not found
 */
router.post('/', hasOKRAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { okrId, updates, comment } = req.body;
    const userId = req.user.id;

    const checkIn = await CheckInService.createCheckIn(okrId, userId, updates, comment);
    res.status(201).json(checkIn);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'OKR not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'You do not have access to this OKR') {
        return res.status(403).json({ message: error.message });
      }
      if (error.message === 'Invalid key result index' || error.message === 'Invalid progress value') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Create check-in error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/check-ins/{okrId}:
 *   get:
 *     summary: Get all check-ins for an OKR
 *     tags: [Check-ins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: okrId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the OKR
 *     responses:
 *       200:
 *         description: List of check-ins
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   okr:
 *                     type: string
 *                   user:
 *                     type: string
 *                   comment:
 *                     type: string
 *                   updates:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         index:
 *                           type: number
 *                         previousProgress:
 *                           type: number
 *                         newProgress:
 *                           type: number
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have access to this OKR
 *       404:
 *         description: OKR not found
 */
router.get('/:okrId', hasOKRAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { okrId } = req.params;
    const checkIns = await CheckInService.getCheckIns(okrId);
    res.json(checkIns);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'OKR not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'You do not have access to this OKR') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Get check-ins error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 