import express, { Response } from 'express';
import { auth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import UserService from '../services/userService';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details including companies and roles
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await UserService.getUserDetails(userId);
    res.json(user);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 