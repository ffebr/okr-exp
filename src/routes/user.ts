import express, { Response } from 'express';
import { auth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import UserService from '../services/userService';
import { User } from '../models/User';

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

/**
 * @swagger
 * /api/users/email/{email}:
 *   get:
 *     summary: Search users by email (fuzzy search)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Partial email address to search for (case-insensitive)
 *     responses:
 *       200:
 *         description: List of matching users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         company:
 *                           type: string
 *                         role:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No users found
 */
router.get('/email/:email', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.params;
    const users = await UserService.findUserByEmail(email);
    res.json(users);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'No users found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Find users by email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 