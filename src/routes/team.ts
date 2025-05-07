import express, { Response } from 'express';
import { auth, hasTeamAccess } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import TeamService from '../services/teamService';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - companyId
 *             properties:
 *               name:
 *                 type: string
 *               companyId:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Team created successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, companyId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !companyId) {
      return res.status(400).json({ 
        message: 'Name and companyId are required' 
      });
    }

    // Validate field types
    if (typeof name !== 'string' || typeof companyId !== 'string') {
      return res.status(400).json({ 
        message: 'Name and companyId must be strings' 
      });
    }

    // Validate name length
    if (name.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Name cannot be empty' 
      });
    }

    const team = await TeamService.createTeam(name, companyId, userId);
    res.status(201).json({
      message: 'Team created successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not in this company') {
        return res.status(400).json({ message: error.message });
      }
      // Add validation for invalid ObjectId
      if (error.message.includes('ObjectId')) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
    }
    console.error('Team creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Apply team access middleware to all team-specific routes
router.use('/:teamId', hasTeamAccess);

/**
 * @swagger
 * /api/teams/{teamId}/users:
 *   post:
 *     summary: Add user to team
 *     tags: [Teams]
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User added to team successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found or User not found
 *       400:
 *         description: User is already in this team
 */
router.post('/:teamId/users', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;

    const team = await TeamService.addUserToTeam(teamId, userId);
    res.status(201).json({
      message: 'User added to team successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not in this company' || 
          error.message === 'User is already in this team' ||
          error.message === 'User does not have any of the required roles for this team') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Add user to team error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/users/{userId}:
 *   delete:
 *     summary: Remove user from team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User removed from team successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/:teamId/users/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId, userId } = req.params;

    const team = await TeamService.removeUserFromTeam(teamId, userId);
    res.json({
      message: 'User removed from team successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not in this team') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Remove user from team error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/roles:
 *   post:
 *     summary: Add required role to team
 *     tags: [Teams]
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
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role added successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/:teamId/roles', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { roleName } = req.body;

    const team = await TeamService.addRequiredRole(teamId, roleName);
    res.status(201).json({
      message: 'Role added successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found' || 
          error.message === 'Company not found' || 
          error.message === 'Role not found in company') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Role is already required for this team') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Add role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/roles/{roleName}:
 *   delete:
 *     summary: Remove required role from team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role removed successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/:teamId/roles/:roleName', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId, roleName } = req.params;

    const team = await TeamService.removeRequiredRole(teamId, roleName);
    res.json({
      message: 'Role removed successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Role is not required for this team') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Remove role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of teams
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   company:
 *                     type: string
 *                   users:
 *                     type: array
 *                     items:
 *                       type: string
 *                   requiredRoles:
 *                     type: array
 *                     items:
 *                       type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.query;
    const userId = req.user.id;

    if (!companyId) {
      return res.status(400).json({ message: 'Company ID is required' });
    }

    const teams = await TeamService.getUserTeams(userId, companyId as string);
    res.json({ teams });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get teams error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}:
 *   get:
 *     summary: Get team details
 *     tags: [Teams]
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
 *         description: Team details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 company:
 *                   type: string
 *                 users:
 *                   type: array
 *                   items:
 *                     type: string
 *                 requiredRoles:
 *                   type: array
 *                   items:
 *                     type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 */
router.get('/:teamId', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const team = await TeamService.getTeamDetails(teamId);
    res.json(team);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get team details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}:
 *   delete:
 *     summary: Delete team
 *     tags: [Teams]
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
 *         description: Team deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 */
router.delete('/:teamId', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const team = await TeamService.deleteTeam(teamId);
    res.json({
      message: 'Team deleted successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Delete team error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/members:
 *   get:
 *     summary: Get team members
 *     tags: [Teams]
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
 *         description: List of team members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 */
router.get('/:teamId/members', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const members = await TeamService.getTeamMembers(teamId);
    res.json({ members });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get team members error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/roles/bulk:
 *   post:
 *     summary: Add multiple required roles to team
 *     tags: [Teams]
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
 *               - roles
 *             properties:
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role names to add
 *     responses:
 *       201:
 *         description: Roles added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       400:
 *         description: Invalid roles or all roles already required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found or Company not found
 */
router.post('/:teamId/roles/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ message: 'Roles array is required and must not be empty' });
    }

    const team = await TeamService.addRequiredRoles(teamId, roles);
    res.status(201).json({
      message: 'Roles added successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found' || error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.startsWith('Roles not found in company') || 
          error.message === 'All roles are already required for this team') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Add roles error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/teams/{teamId}/users/bulk:
 *   post:
 *     summary: Add multiple users to team
 *     tags: [Teams]
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
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add
 *     responses:
 *       201:
 *         description: Users added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       400:
 *         description: Invalid user IDs or all users already in team
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found or some users not found
 */
router.post('/:teamId/users/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required and must not be empty' });
    }

    const team = await TeamService.addUsersToTeam(teamId, userIds);
    res.status(201).json({
      message: 'Users added successfully',
      team
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Team not found' || error.message === 'Some users were not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.startsWith('Users not in company') || 
          error.message.startsWith('Users without required roles') ||
          error.message === 'All users are already in this team') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Add users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 