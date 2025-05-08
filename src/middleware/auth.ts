import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Company } from '../models/Company';
import Team from '../models/Team';
import { OKR } from '../models/OKR';
import { Types } from 'mongoose';

export interface AuthRequest extends Request {
  user?: any;
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const isCompanyCreator = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.params.companyId;
    const userId = req.user.id;

    const company = await Company.findOne({ _id: companyId, createdBy: userId });
    
    if (!company) {
      return res.status(403).json({ message: 'Access denied. Only company creator can perform this action' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const hasCompanyAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.params.companyId;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMember = user.companies.some(company => company.toString() === companyId);
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied. User is not a member of this company' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const hasTeamAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.teamId;
    const userId = req.user.id;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is a team member
    const isMember = team.members.some(member => member.userId === userId);
    if (isMember) {
      return next();
    }

    // Check if user has required roles
    const userRoles = user.roles
      .filter(role => role.company.toString() === team.companyId)
      .map(role => role.role);
    
    const hasRequiredRole = team.requiredRoles.some(role => userRoles.includes(role));
    if (hasRequiredRole) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. User does not have access to this team' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const canManageOKR = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const okrId = req.params.okrId;
    const userId = req.user.id;

    const okr = await OKR.findById(okrId);
    if (!okr) {
      return res.status(404).json({ message: 'OKR not found' });
    }

    const team = await Team.findById(okr.team);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check if user is the OKR creator
    if (okr.createdBy && okr.createdBy.toString() === userId) {
      return next();
    }

    // Check if user is the team creator
    if (team.createdBy.toString() === userId) {
      return next();
    }

    // Check if user is a team member
    const isMember = team.members.some(member => member.userId === userId);
    if (isMember) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. Only OKR creator, team creator, or team member can manage this OKR' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const hasOKRAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const okrId = req.body.okrId || req.params.okrId;
    const userId = req.user.id;

    // Convert string IDs to ObjectId
    const okrObjectId = new Types.ObjectId(okrId);
    const userObjectId = new Types.ObjectId(userId);

    const okr = await OKR.findById(okrObjectId);
    if (!okr) {
      return res.status(404).json({ message: 'OKR not found' });
    }

    const team = await Team.findById(okr.team);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check if user is a team member
    const isMember = team.members.some(member => member.userId.toString() === userObjectId.toString());
    if (isMember) {
      return next();
    }

    // Check if user has required roles
    const user = await User.findById(userObjectId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userRoles = user.roles
      .filter(role => role.company.toString() === team.companyId)
      .map(role => role.role);
    
    const hasRequiredRole = team.requiredRoles.some(role => userRoles.includes(role));
    if (hasRequiredRole) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. User does not have access to this OKR' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const isTeamCreator = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.teamId;
    const userId = req.user.id;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (team.createdBy !== userId) {
      return res.status(403).json({ message: 'Only team creator can perform this action' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
}; 