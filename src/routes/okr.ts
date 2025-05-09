import express, { Response } from 'express';
import { auth, hasTeamAccess, canManageOKR } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import OKRService from '../services/okrService';
import CorporateOKRService from '../services/corporateOKRService';
import { OKR, IOKR } from '../models/OKR';
import { Document } from 'mongoose';

type OKRDocument = IOKR & Document;

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
 *               - keyResults
 *             properties:
 *               objective:
 *                 type: string
 *               description:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline must be after creation date
 *               keyResults:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - metricType
 *                     - startValue
 *                     - targetValue
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     metricType:
 *                       type: string
 *                       enum: [number, percentage, currency, custom]
 *                     startValue:
 *                       type: number
 *                     targetValue:
 *                       type: number
 *                     unit:
 *                       type: string
 *               parentOKR:
 *                 type: string
 *                 description: ID of the corporate OKR this team OKR is linked to
 *               parentKRIndex:
 *                 type: integer
 *                 description: Index of the key result in the corporate OKR
 *               isFrozen:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: OKR created successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       403:
 *         description: User does not have access to this team
 *       400:
 *         description: Invalid parent OKR or KR index
 */
router.post('/teams/:teamId/okrs', hasTeamAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { 
      objective, 
      description, 
      keyResults, 
      parentOKR, 
      parentKRIndex,
      isFrozen,
      deadline 
    } = req.body;
    const userId = req.user.id;

    // Validate keyResults structure
    if (!Array.isArray(keyResults)) {
      return res.status(400).json({ message: 'keyResults must be an array' });
    }

    // Validate deadline if provided
    if (deadline !== undefined) {
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ message: 'Invalid deadline date format' });
      }
      if (deadlineDate <= new Date()) {
        return res.status(400).json({ message: 'Deadline must be in the future' });
      }
    }

    // Validate each key result
    for (const kr of keyResults) {
      if (!kr.title || !kr.metricType || kr.startValue === undefined || kr.targetValue === undefined) {
        return res.status(400).json({ 
          message: 'Each key result must have title, metricType, startValue, and targetValue' 
        });
      }
      if (!['number', 'percentage', 'currency', 'custom'].includes(kr.metricType)) {
        return res.status(400).json({ 
          message: 'Invalid metricType. Must be one of: number, percentage, currency, custom' 
        });
      }
      // Validate unit if provided
      if (kr.unit !== undefined && typeof kr.unit !== 'string') {
        return res.status(400).json({ 
          message: 'Unit must be a string if provided' 
        });
      }
    }

    // Create OKR with new fields
    const okr = await OKRService.createOKR(
      teamId,
      userId,
      objective,
      description,
      keyResults,
      isFrozen,
      deadline
    );

    // If parentOKR and parentKRIndex are provided, link to corporate OKR
    if (parentOKR && parentKRIndex !== undefined) {
      try {
        await CorporateOKRService.linkTeamOKRToCorporate(
          okr._id?.toString() || '',
          parentOKR,
          parentKRIndex,
          userId
        );
      } catch (error) {
        // If linking fails, delete the created OKR
        await OKR.deleteOne({ _id: okr._id });
        
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
          }
          if (error.message.includes('Team is not assigned')) {
            return res.status(400).json({ message: error.message });
          }
          if (error.message.includes('Only team creator')) {
            return res.status(403).json({ message: error.message });
          }
        }
        throw error;
      }
    }

    // Get updated OKR with link
    const updatedOKR = await OKRService.getOKRById(okr._id?.toString() || '');

    res.status(201).json({
      message: 'OKR created successfully',
      okr: updatedOKR
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
 *                       parentOKR:
 *                         type: string
 *                       parentKRIndex:
 *                         type: number
 *                       deadline:
 *                         type: string
 *                         format: date-time
 *                       isFrozen:
 *                         type: boolean
 *                       keyResults:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             description:
 *                               type: string
 *                             metricType:
 *                               type: string
 *                               enum: [number, percentage, currency, custom]
 *                             startValue:
 *                               type: number
 *                             targetValue:
 *                               type: number
 *                             unit:
 *                               type: string
 *                             actualValue:
 *                               type: number
 *                             progress:
 *                               type: number
 *                       progress:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [draft, active, done]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
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
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 team:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 createdBy:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 objective:
 *                   type: string
 *                 description:
 *                   type: string
 *                 parentOKR:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     objective:
 *                       type: string
 *                     company:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                 parentKRIndex:
 *                   type: number
 *                 deadline:
 *                   type: string
 *                   format: date-time
 *                 isFrozen:
 *                   type: boolean
 *                 keyResults:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       metricType:
 *                         type: string
 *                         enum: [number, percentage, currency, custom]
 *                       startValue:
 *                         type: number
 *                       targetValue:
 *                         type: number
 *                       unit:
 *                         type: string
 *                       actualValue:
 *                         type: number
 *                       progress:
 *                         type: number
 *                 progress:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [draft, active, done]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
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

/**
 * @swagger
 * /api/okrs/{okrId}/link-to-corporate:
 *   post:
 *     summary: Link team OKR to corporate OKR
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
 *               - corporateOKRId
 *               - krIndex
 *             properties:
 *               corporateOKRId:
 *                 type: string
 *               krIndex:
 *                 type: integer
 *     responses:
 *       200:
 *         description: OKR linked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only team creator or OKR creator can link OKRs
 *       404:
 *         description: OKR not found
 */
router.post('/okrs/:okrId/link-to-corporate', canManageOKR, async (req: AuthRequest, res: Response) => {
  try {
    const { okrId } = req.params;
    const { corporateOKRId, krIndex } = req.body;
    const userId = req.user.id;

    const teamOKR = await CorporateOKRService.linkTeamOKRToCorporate(
      okrId,
      corporateOKRId,
      krIndex,
      userId
    );

    res.json({
      message: 'OKR linked successfully',
      teamOKR
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Only team creator') || error.message.includes('Team is not assigned')) {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Link OKR error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/okrs/{okrId}/freeze:
 *   patch:
 *     summary: Freeze or unfreeze an OKR
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
 *               - isFrozen
 *             properties:
 *               isFrozen:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: OKR freeze status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User does not have permission to manage this OKR
 *       404:
 *         description: OKR not found
 */
router.patch('/okrs/:okrId/freeze', canManageOKR, async (req: AuthRequest, res: Response) => {
  try {
    const { okrId } = req.params;
    const { isFrozen } = req.body;

    if (typeof isFrozen !== 'boolean') {
      return res.status(400).json({ message: 'isFrozen must be a boolean value' });
    }

    const okr = await OKRService.updateOKRFreezeStatus(okrId, isFrozen);
    res.json({
      message: `OKR ${isFrozen ? 'frozen' : 'unfrozen'} successfully`,
      okr
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'OKR not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User does not have permission to manage this OKR') {
        return res.status(403).json({ message: error.message });
      }
    }
    console.error('Update OKR freeze status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 