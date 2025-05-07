import express, { Response } from 'express';
import { auth, isCompanyCreator } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { CompanyService } from '../services/companyService';

const router = express.Router();

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Create a new company
 *     tags: [Companies]
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
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Company created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    const company = await CompanyService.createCompany(name, userId);
    res.status(201).json({
      message: 'Company created successfully',
      company
    });
  } catch (error) {
    console.error('Company creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/roles:
 *   post:
 *     summary: Add a new role to company
 *     tags: [Companies]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role added successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only company creator can add roles
 */
router.post('/:companyId/roles', auth, isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const { name, description } = req.body;

    const company = await CompanyService.addRole(companyId, name, description);
    res.status(201).json({
      message: 'Role added successfully',
      company
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Role with this name already exists') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Role addition error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Get all companies related to user
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of companies with user roles
 *       401:
 *         description: Unauthorized
 */
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const companies = await CompanyService.getUserCompanies(userId);
    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/users:
 *   post:
 *     summary: Add user to company
 *     tags: [Companies]
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User added to company successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only company creator can add users
 *       404:
 *         description: Company not found or User not found
 *       400:
 *         description: User is already in this company
 */
router.post('/:companyId/users', auth, isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const { userId } = req.body;

    const user = await CompanyService.addUserToCompany(companyId, userId);
    res.status(201).json({
      message: 'User added to company successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        companies: user.companies
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is already in this company') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Add user to company error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/users/{userId}/roles:
 *   post:
 *     summary: Assign role to user in company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role assigned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only company creator can assign roles
 */
router.post('/:companyId/users/:userId/roles', auth, isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId } = req.params;
    const { role } = req.body;

    const user = await CompanyService.assignRoleToUser(companyId, userId, role);
    res.status(201).json({
      message: 'Role assigned successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        companies: user.companies
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Invalid role for this company' || 
          error.message === 'User is not in this company' ||
          error.message === 'User already has this role in the company') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Assign role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/users/{userId}/roles/{role}:
 *   delete:
 *     summary: Remove role from user in company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only company creator can remove roles
 */
router.delete('/:companyId/users/:userId/roles/:role', auth, isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId, role } = req.params;

    const user = await CompanyService.removeRoleFromUser(companyId, userId, role);
    res.json({
      message: 'Role removed successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        companies: user.companies
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not in this company' || 
          error.message === 'User doesn\'t have this role in the company') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Remove role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/roles/{role}:
 *   delete:
 *     summary: Remove role from company and revoke it from all users
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role removed successfully and revoked from all users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only company creator can remove roles
 */
router.delete('/:companyId/roles/:role', auth, isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, role } = req.params;

    const result = await CompanyService.removeRoleFromCompany(companyId, role);
    res.json({
      message: 'Role removed successfully and revoked from all users',
      affectedUsers: result.affectedUsers
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found' || error.message === 'Role not found in company') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Remove role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/users/{userId}:
 *   delete:
 *     summary: Remove user from company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
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
 *         description: User removed from company successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only company creator can remove users
 */
router.delete('/:companyId/users/:userId', auth, isCompanyCreator, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId } = req.params;

    const user = await CompanyService.removeUserFromCompany(companyId, userId);
    res.json({
      message: 'User removed from company successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        companies: user.companies
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found' || error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not in this company') {
        return res.status(400).json({ message: error.message });
      }
    }
    console.error('Remove user from company error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/users:
 *   get:
 *     summary: Get all users in company
 *     tags: [Companies]
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
 *         description: List of users in company
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
 *         description: Company not found
 */
router.get('/:companyId/users', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const users = await CompanyService.getCompanyUsers(companyId);
    res.json({ users });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get company users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}/roles:
 *   get:
 *     summary: Get all roles in company
 *     tags: [Companies]
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
 *         description: List of roles in company
 *       401:
 *         description: Unauthorized
 */
router.get('/:companyId/roles', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const roles = await CompanyService.getCompanyRoles(companyId);
    res.json({ roles });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get company roles error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/companies/{companyId}:
 *   get:
 *     summary: Get detailed company information including roles and users
 *     tags: [Companies]
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
 *         description: Detailed company information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 createdBy:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       roles:
 *                         type: array
 *                         items:
 *                           type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 */
router.get('/:companyId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const companyDetails = await CompanyService.getCompanyDetails(companyId);
    res.json(companyDetails);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ message: error.message });
      }
    }
    console.error('Get company details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 