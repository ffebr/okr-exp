import { Types } from 'mongoose';
import { OKR } from '../models/OKR';
import Team from '../models/Team';
import { User } from '../models/User';

class OKRService {
  static async createOKR(teamId: string, userId: string, objective: string, description?: string, keyResults?: Array<{ title: string, description?: string }>) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if team exists
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user has access to the team
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in the team or has required roles
    const isMember = team.members.some(member => member.userId === userId);
    const userRoles = user.roles
      .filter(role => role.company.toString() === team.companyId)
      .map(role => role.role);
    
    const hasRequiredRole = team.requiredRoles.some(role => userRoles.includes(role));
    
    if (!isMember && !hasRequiredRole) {
      throw new Error('User does not have access to this team');
    }

    // Create OKR
    const okr = new OKR({
      team: teamId,
      createdBy: userId,
      objective,
      description,
      keyResults: keyResults?.map(kr => ({
        title: kr.title,
        description: kr.description,
        progress: 0
      })) || []
    });

    await okr.save();
    return okr;
  }

  static async getTeamOKRs(teamId: string, userId: string) {
    // Check if team exists
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user has access to the team
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in the team or has required roles
    const isMember = team.members.some(member => member.userId === userId);
    const userRoles = user.roles
      .filter(role => role.company.toString() === team.companyId)
      .map(role => role.role);
    
    const hasRequiredRole = team.requiredRoles.some(role => userRoles.includes(role));
    
    if (!isMember && !hasRequiredRole) {
      throw new Error('User does not have access to this team');
    }

    // Get all OKRs for the team
    const okrs = await OKR.find({ team: teamId })
      .sort({ createdAt: -1 });

    return okrs;
  }

  static async addKeyResult(okrId: string, title: string, description?: string) {
    try {
      if (!okrId) {
        throw new Error('OKR ID is required');
      }

      if (!title) {
        throw new Error('Title is required');
      }

      const okr = await OKR.findById(new Types.ObjectId(okrId));
      if (!okr) {
        throw new Error('OKR not found');
      }

      const newKeyResult = {
        title,
        description,
        progress: 0
      };

      okr.keyResults.push(newKeyResult);
      
      try {
        await okr.save();
        console.log(`Successfully added key result to OKR ${okrId}`);
        return okr;
      } catch (saveError) {
        console.error('Error saving OKR:', saveError);
        throw new Error('Failed to save key result');
      }
    } catch (error) {
      console.error('Error in addKeyResult:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while adding key result');
    }
  }

  static async updateOKRStatus(okrId: string, status: string) {
    console.log('updateOKRStatus', okrId, status);
    try {
      if (!okrId) {
        throw new Error('OKR ID is required');
      }

      if (!['draft', 'active', 'done'].includes(status)) {
        throw new Error('Invalid status value');
      }

      console.log('Looking for OKR with ID:', okrId);
      const okr = await OKR.findById(new Types.ObjectId(okrId));
      console.log('Found OKR:', okr);
      if (!okr) {
        throw new Error('OKR not found');
      }

      // Check if user has permission to update this OKR
      const user = await User.findById(okr.createdBy);
      if (!user) {
        throw new Error('User not found');
      }

      // Update status
      okr.status = status as "draft" | "active" | "done";
      await okr.save();

      return okr;
    } catch (error) {
      console.error('Error in updateOKRStatus:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while updating OKR status');
    }
  }

  static async getOKRById(okrId: string) {
    try {
      if (!okrId) {
        throw new Error('OKR ID is required');
      }

      const okr = await OKR.findById(new Types.ObjectId(okrId));
      if (!okr) {
        throw new Error('OKR not found');
      }

      return okr;
    } catch (error) {
      console.error('Error in getOKRById:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while getting OKR');
    }
  }
}

export default OKRService; 